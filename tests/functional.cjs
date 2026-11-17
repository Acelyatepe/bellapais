/* Run with NODE_PATH pointing to an installation of playwright.
   Start the static server, then: node tests/functional.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function run(chromium) {
    const browser = await chromium.launch({ executablePath: process.env.BELLAPAIS_BROWSER || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
    const results = [];
    const base = process.env.BELLAPAIS_TEST_URL || 'http://127.0.0.1:8765';
    const context = await browser.newContext();
    // External media must not stall deterministic local functionality checks.
    const assets = process.env.BELLAPAIS_TEST_ASSETS ? JSON.parse(fs.readFileSync(process.env.BELLAPAIS_TEST_ASSETS, 'utf8')) : {};
    await context.route('https://**/*', route => {
        const asset = assets[route.request().url()];
        return asset ? route.fulfill({body:Buffer.from(asset.body,'base64'),contentType:asset.type}) : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    const messages = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
    const check = async (name, fn) => { await fn(); results.push(name); console.log('PASS', name); };
    const go = async name => { await page.goto(`${base}/${name}`, { waitUntil: 'load' }); await page.locator('#loader').waitFor({ state: 'hidden' }); };
    const cart = () => page.evaluate(() => JSON.parse(localStorage.getItem('bellapaisCart')));
    const add = async index => { await page.locator('.menu-card .order-btn').nth(index).click(); await page.waitForFunction(() => Number(document.getElementById('cartCount').textContent) > 0); };
    const open = async () => { await page.locator('#cartButton').click(); await page.locator('#cartPanel.active').waitFor(); };
    const close = async () => { await page.locator('#closeCart').click(); };
    try {
        await go('index.html');
        await check('Empty cart and disabled checkout', async () => { await open(); assert.equal(await page.locator('#checkoutBtn').isDisabled(), true); assert.match(await page.locator('#cartItems').innerText(), /Sepetiniz boş/); await close(); });
        await check('Same product merges with correct price and quantity', async () => {
            await add(0); await add(0); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '2');
            await open(); assert.equal((await cart()).items.length, 1); assert.equal((await cart()).items[0].cents, 179000);
            assert.equal(await page.locator('#cartTotal').textContent(), '₺3.580'); assert.match(await page.locator('#cartItems').innerText(), /Ara toplam: ₺3.580/);
        });
        await check('Increase, decrease, delete and focus retention', async () => {
            await page.locator('.increase-btn').click(); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '3');
            assert.equal(await page.locator('#cartTotal').textContent(), '₺5.370');
            assert.equal(await page.locator('.increase-btn').evaluate(node => node === document.activeElement), true);
            await page.locator('.decrease-btn').click(); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '2');
            await page.locator('.remove-btn').click(); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '0');
            assert.equal(await page.locator('#cartTotal').textContent(), '₺0'); await close();
        });
        await check('Cart survives reload and navigation', async () => {
            await add(1); await go('index.html'); assert.equal(await page.locator('#cartCount').textContent(), '1');
            await go('menu.html'); await open(); assert.equal(await page.locator('#cartTotal').textContent(), '₺4.250');
        });
        await check('Checkout is atomic and ignores double click', async () => {
            await page.locator('#checkoutBtn').evaluate(node => { node.click(); node.click(); });
            await page.locator('#orderSuccessModal.active').waitFor();
            const saved = await cart(); assert.deepEqual(saved.items, []); assert.equal(saved.lastOrder.total, 425000);
            await page.locator('#closeOrderSuccess').click(); assert.equal(await page.locator('#checkoutBtn').isDisabled(), true);
            await page.locator('#checkoutBtn').evaluate(node => node.click()); assert.equal((await cart()).lastOrder.id, saved.lastOrder.id);
            await close(); await go('menu.html'); assert.equal(await page.locator('#cartCount').textContent(), '0');
        });
        await check('Legacy duplicate cart migrates, decimal prices stay accurate', async () => {
            await page.evaluate(() => localStorage.setItem('bellapaisCart', JSON.stringify([{title:'Eski ürün',price:'₺1.234,50'}, {title:'Eski ürün',price:'₺1.234,50',quantity:2}])));
            await go('menu.html'); await open(); assert.equal(await page.locator('#cartTotal').textContent(), '₺3.703,50'); assert.equal(await page.locator('.cart-item').count(),1);
            await page.locator('.decrease-btn').click(); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '2');
            await page.locator('.decrease-btn').click(); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '1');
            await page.locator('.decrease-btn').click(); await page.waitForFunction(() => document.getElementById('cartCount').textContent === '0'); await close();
        });
        await check('Corrupt storage cannot crash page; saved strings are not HTML', async () => {
            await page.evaluate(() => { localStorage.setItem('bellapaisCart','broken'); localStorage.setItem('bellapaisFavorites','broken'); });
            await go('menu.html'); assert.equal(await page.locator('#cartCount').textContent(),'0');
            await page.evaluate(() => localStorage.setItem('bellapaisCart', JSON.stringify([{title:'<img src=x onerror=alert(1)>',price:'₺10',quantity:1}])));
            await go('menu.html'); await open(); assert.equal(await page.locator('.cart-item h4 img').count(),0); await page.locator('.remove-btn').click(); await close();
        });
        await check('Category and Turkish search combine; empty results recover', async () => {
            await page.locator('[data-filter="pizza"]').click(); await page.locator('#menuSearch').fill('TRÜF');
            assert.equal(await page.locator('.menu-card:visible').count(),2);
            assert.equal(await page.locator('.menu-card:visible:not(.pizza)').count(),0);
            await page.locator('#menuSearch').fill('zzzzzz'); assert.equal(await page.locator('.menu-card:visible').count(),0);
            assert.match(await page.getByRole('status').first().innerText(), /Aramanıza uygun/);
            await page.locator('#menuSearch').fill(''); await page.locator('[data-filter="all"]').click(); assert.equal(await page.locator('.menu-card:visible').count(),54);
        });
        await check('Price, alphabetic and original sorting', async () => {
            const original = await page.locator('.menu-card h3').allTextContents();
            await page.locator('#sortMenu').selectOption('low');
            const values = await page.locator('.menu-card').evaluateAll(nodes => nodes.map(node => +node.dataset.price)); assert.deepEqual(values,[...values].sort((a,b)=>a-b));
            await page.locator('#sortMenu').selectOption('high');
            const high = await page.locator('.menu-card').evaluateAll(nodes => nodes.map(node => +node.dataset.price)); assert.deepEqual(high,[...high].sort((a,b)=>b-a));
            await page.locator('#sortMenu').selectOption('name'); assert.deepEqual(await page.locator('.menu-card h3').allTextContents(),[...original].sort((a,b)=>a.localeCompare(b,'tr')));
            await page.locator('#sortMenu').selectOption('default'); assert.deepEqual(await page.locator('.menu-card h3').allTextContents(),original);
        });
        await check('Favorites persist', async () => { await page.locator('.favorite-btn').first().click(); await go('menu.html'); assert.match(await page.locator('.favorite-btn').first().getAttribute('class'), /active/); });
        await check('Gallery, Escape and focus return', async () => {
            const link = page.locator('.gallery-item').first(); await link.click(); await page.locator('#lightbox.active').waitFor();
            assert.equal(await page.locator('#lightboxImage').getAttribute('alt'), await link.locator('img').getAttribute('alt'));
            await page.keyboard.press('Escape'); assert.equal(await page.locator('#lightbox').getAttribute('aria-hidden'),'true'); assert.equal(await link.evaluate(node=>node===document.activeElement),true);
        });
        await check('Table is required; all six requests, duplicate prevention and completion', async () => {
            await open(); await page.locator('#tableService summary').click();
            assert.equal(await page.locator('[data-request="water"]').isDisabled(),true);
            await page.locator('#tableNumber').fill('0'); assert.equal(await page.locator('[data-request="water"]').isDisabled(),true);
            await page.locator('#tableNumber').fill('012');
            let sent = 0;
            for (const type of ['waiter','bill','water','cutlery','cleaning','help']) {
                await page.locator(`[data-request="${type}"]`).click(); await page.waitForFunction(count => document.querySelectorAll('#serviceRequests li:not(.service-empty)').length === count, ++sent);
            }
            assert.equal(await page.locator('#serviceRequests li:not(.service-empty)').count(),6);
            await page.locator('[data-request="water"]').evaluate(node=>node.click()); assert.equal(await page.locator('#serviceRequests li:not(.service-empty)').count(),6);
            await page.locator('#serviceRequests button').first().click(); await page.waitForFunction(()=>document.getElementById('serviceRequests').textContent.includes('Tamamlandı'));
            assert.equal(await page.locator('[data-request="help"]').isDisabled(),true);
            await page.locator('#tableNumber').fill('13'); assert.equal(await page.locator('#serviceRequests li:not(.service-empty)').count(),0);
            assert.equal(await page.locator('[data-request="water"]').isDisabled(),false);
            await close(); await go('menu.html'); await open(); await page.locator('#tableService summary').click();
            await page.locator('#tableNumber').fill('12'); assert.equal(await page.locator('#serviceRequests li:not(.service-empty)').count(),6); await close();
        });
        await check('Reservation validation, optional note and persistent local record', async () => {
            await go('index.html');
            await page.locator('#fullname').fill('Test Misafir'); await page.locator('#email').fill('test@example.com'); await page.locator('#phone').fill('05321234567');
            await page.locator('#date').fill('2020-01-01'); await page.locator('#time').fill('19:00'); await page.locator('#person').selectOption({label:'2 Kişi'});
            await page.locator('#reservationForm button').click(); assert.equal(await page.locator('#reservationForm').evaluate(form => form.checkValidity()),false);
            await page.locator('#date').fill('2099-01-01'); await page.locator('#time').fill('19:30'); await page.locator('#reservationForm button').click();
            await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bellapaisForms')||'[]').length===1);
            assert.equal(await page.locator('#fullname').inputValue(),''); assert.match(await page.locator('#successPopup p').innerText(), /otomatik iletilmedi/); await page.locator('#closeNotice').click();
        });
        await check('Contact, newsletter and cookie acceptance', async () => {
            await page.locator('#contactName').fill('Test'); await page.locator('#contactEmail').fill('test@example.com'); await page.locator('#contactSubject').fill('Test'); await page.locator('#contactMessage').fill('Test mesajı');
            await page.locator('#contactForm button').click(); await page.locator('#closeNotice').click();
            await page.locator('.newsletter input').fill('test@example.com'); await page.locator('.newsletter button').click(); await page.locator('#closeNotice').click();
            await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bellapaisForms')||'[]').length===3);
            await page.locator('#acceptCookie').click(); await go('index.html'); assert.equal(await page.locator('#cookiePopup').isVisible(),false);
        });
        await check('Theme changes appearance and persists without altering the original dark palette', async () => {
            const dark = await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor);
            await page.locator('#darkMode').click(); assert.match(await page.locator('body').getAttribute('class'),/light-mode/);
            assert.notEqual(await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor),dark);
            await go('index.html'); assert.match(await page.locator('body').getAttribute('class'),/light-mode/); await page.locator('#darkMode').click();
        });
        await check('Concurrent tabs create only one order', async () => {
            await add(0); const other = await context.newPage(); await other.goto(`${base}/menu.html`,{waitUntil:'load'});
            await page.evaluate(()=>document.getElementById('checkoutBtn').click()); await other.evaluate(()=>document.getElementById('checkoutBtn').click());
            await page.locator('#orderSuccessModal.active').waitFor(); const id = (await cart()).lastOrder.id;
            await other.waitForFunction(()=>document.getElementById('cartCount').textContent==='0');
            assert.equal(await other.locator('#orderSuccessModal.active').count(),0); assert.equal((await cart()).lastOrder.id,id);
            await other.close(); await page.keyboard.press('Escape');
        });
        if (Object.keys(assets).length) await check('Original slider, reveal animation and back-to-top', async () => {
            await page.setViewportSize({width:768,height:900}); await go('index.html');
            await page.locator('#testimonials').scrollIntoViewIfNeeded();
            await page.waitForFunction(()=>document.querySelector('.testimonialSwiper').swiper);
            const index = await page.locator('.testimonialSwiper').evaluate(node=>node.swiper.realIndex);
            await page.locator('.swiper-pagination-bullet').nth((index+1)%3).click();
            await page.waitForFunction(index=>document.querySelector('.testimonialSwiper').swiper.realIndex!==index,index);
            assert.ok(await page.locator('[data-aos].aos-init').count()>0);
            await page.locator('#topBtn').click(); await page.waitForFunction(()=>scrollY<5);
        });
        fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
        for (const width of [320,360,768,1440]) await check(`Cart and service fit ${width}px viewport`,async()=>{
            await page.setViewportSize({width,height:900}); await go('index.html'); await add(0); await open();
            await page.locator('#tableService summary').click(); await page.locator('#tableNumber').fill('25');
            const box = await page.locator('#cartPanel').boundingBox(); assert.ok(box.x>=-1 && box.x+box.width<=width+1);
            assert.equal(await page.locator('#cartPanel').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
            await page.locator('[data-request="water"]').click(); await page.waitForFunction(()=>document.getElementById('serviceFeedback').textContent.includes('Bekliyor')); assert.match(await page.locator('#serviceFeedback').innerText(),/Bekliyor/);
            await page.screenshot({path:path.join(__dirname,`screenshots/cart-${width}.png`)});
            await page.keyboard.press('Escape'); assert.equal(await page.locator('#cartPanel').getAttribute('aria-hidden'),'true');
            if(width<993){await page.locator('#menuButton').click(); assert.equal(await page.locator('#menuButton').getAttribute('aria-expanded'),'true'); await page.keyboard.press('Escape'); assert.equal(await page.locator('#menuButton').getAttribute('aria-expanded'),'false');}
            await page.evaluate(()=>localStorage.removeItem('bellapaisService'));
        });
        assert.deepEqual(errors,[]); results.push('No JavaScript errors');
        fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({passed:results.length,checks:results},null,2));
        console.log(`All ${results.length} checks passed.`);
    } finally { await browser.close(); }
}
module.exports = run;
if(require.main===module) run(require('playwright').chromium).catch(error=>{console.error(error);process.exitCode=1;});
