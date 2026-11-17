/* One persistent cart shared by both pages, with atomic checkout. */
document.addEventListener("DOMContentLoaded", () => {
    const panel = document.getElementById("cartPanel");
    const items = document.getElementById("cartItems");
    const count = document.getElementById("cartCount");
    const total = document.getElementById("cartTotal");
    const checkout = document.getElementById("checkoutBtn");
    const success = document.getElementById("orderSuccessModal");
    const trigger = document.getElementById("cartButton");
    if (!panel || !items || !total || !checkout) return;
    const key = "bellapaisCart";
    let busy = false;
    const catalog = new Map([...document.querySelectorAll(".menu-card, .featured-card")].map(card => [
        card.querySelector("h3").textContent.trim(), card
    ]));
    function state() {
        const raw = Bellapais.read(key, []);
        const rows = Array.isArray(raw) ? raw : raw?.items;
        const merged = new Map();
        for (const row of Array.isArray(rows) ? rows : []) {
            if (!row || typeof row.title !== "string" || !row.title.trim()) continue;
            const title = row.title.trim();
            const cents = row.cents ?? Bellapais.price(row.price);
            const quantity = Number(row.quantity ?? 1);
            if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 999) continue;
            const existing = merged.get(title);
            if (existing) existing.quantity = Math.min(999, existing.quantity + quantity);
            else merged.set(title, { title, cents, quantity, image: catalog.get(title)?.querySelector("img")?.getAttribute("src") || row.image || "" });
        }
        return { items: [...merged.values()], lastOrder: !Array.isArray(raw) ? raw?.lastOrder || null : null };
    }
    function button(label, symbol, action, title) {
        const node = document.createElement("button");
        node.type = "button";
        node.textContent = symbol;
        node.className = action + "-btn";
        node.dataset.title = title;
        node.dataset.action = action;
        node.setAttribute("aria-label", title + ": " + label);
        return node;
    }
    function render() {
        const cart = state().items;
        const focus = items.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
        items.replaceChildren();
        count.textContent = cart.reduce((sum, row) => sum + row.quantity, 0);
        count.setAttribute("aria-live", "polite");
        trigger.setAttribute("aria-label", `Sepet: ${count.textContent} ürün`);
        checkout.disabled = busy || cart.length === 0;
        let sum = 0;
        for (const row of cart) {
            sum += row.cents * row.quantity;
            const item = document.createElement("div");
            item.className = "cart-item";
            const image = document.createElement("img");
            // Do not interpret saved user content as HTML or executable URLs.
            if (/^(images\/|https?:\/\/)/.test(row.image)) image.src = row.image;
            image.alt = row.title;
            const info = document.createElement("div");
            info.className = "cart-item-info";
            const title = document.createElement("h4"); title.textContent = row.title;
            const price = document.createElement("p"); price.textContent = Bellapais.money(row.cents);
            const controls = document.createElement("div"); controls.className = "quantity-controls";
            const quantity = document.createElement("span"); quantity.textContent = row.quantity;
            quantity.setAttribute("aria-label", `${row.quantity} adet`);
            const increase = button("Adedi artır", "+", "increase", row.title);
            increase.disabled = row.quantity >= 999;
            controls.append(button("Adedi azalt", "−", "decrease", row.title), quantity, increase, button("Sepetten sil", "×", "remove", row.title));
            const subtotal = document.createElement("p");
            subtotal.textContent = "Ara toplam: " + Bellapais.money(row.cents * row.quantity);
            info.append(title, price, controls, subtotal);
            item.append(image, info); items.append(item);
        }
        if (!cart.length) {
            const empty = document.createElement("p"); empty.className = "empty-cart"; empty.textContent = "Sepetiniz boş."; items.append(empty);
        }
        total.textContent = Bellapais.money(sum);
        if (focus) {
            const target = [...items.querySelectorAll("button")].find(node => node.dataset.title === focus.title && node.dataset.action === focus.action && !node.disabled);
            (target || items.querySelector("button") || document.getElementById("closeCart")).focus();
        }
    }
    function change(update) {
        return Bellapais.transaction(key, () => {
            const current = state();
            update(current);
            if (Bellapais.write(key, current)) render();
        });
    }
    document.querySelectorAll(".menu-card .order-btn, .featured-card .order-btn").forEach(button => button.addEventListener("click", event => {
        event.preventDefault();
        const card = button.closest(".menu-card, .featured-card");
        if (!card) return;
        const title = card.querySelector("h3").textContent.trim();
        const cents = Bellapais.price(card.querySelector(".menu-title span, .price")?.textContent);
        if (!Number.isSafeInteger(cents) || cents <= 0) return;
        change(current => {
            const row = current.items.find(item => item.title === title);
            if (row) row.quantity = Math.min(999, row.quantity + 1);
            else current.items.push({ title, cents, quantity: 1, image: card.querySelector("img")?.getAttribute("src") || "" });
        });
    }));
    items.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        change(current => {
            const row = current.items.find(item => item.title === button.dataset.title);
            if (!row) return;
            if (button.dataset.action === "increase") row.quantity = Math.min(999, row.quantity + 1);
            if (button.dataset.action === "decrease") row.quantity--;
            if (button.dataset.action === "remove") row.quantity = 0;
            current.items = current.items.filter(item => item.quantity > 0);
        });
    });
    panel.inert = true;
    panel.setAttribute("aria-label", "Sepetim");
    panel.setAttribute("aria-hidden", "true");
    trigger.addEventListener("click", () => Bellapais.open(panel, trigger, document.getElementById("cartOverlay")));
    document.getElementById("closeCart").addEventListener("click", () => Bellapais.close(panel));
    document.getElementById("cartOverlay").addEventListener("click", () => Bellapais.close(panel));
    if (success) {
        success.inert = true;
        success.setAttribute("aria-label", "Sipariş kaydı");
        document.getElementById("closeOrderSuccess")?.addEventListener("click", () => Bellapais.close(success));
        success.addEventListener("click", event => { if (event.target === success) Bellapais.close(success); });
    }
    checkout.addEventListener("click", async () => {
        if (busy) return;
        busy = true; checkout.disabled = true;
        try {
            await Bellapais.transaction(key, () => {
                const current = state();
                if (!current.items.length) return;
                const order = { id: "#B" + crypto.randomUUID(), createdAt: new Date().toISOString(), items: current.items,
                    total: current.items.reduce((sum, row) => sum + row.cents * row.quantity, 0) };
                if (!Bellapais.write(key, { items: [], lastOrder: order })) return;
                render();
                const number = document.getElementById("orderNumber");
                if (number) number.textContent = order.id;
                Bellapais.open(success, checkout);
            });
        } finally { busy = false; render(); }
    });
    window.addEventListener("storage", event => { if (event.key === key || event.key === null) render(); });
    render();
});
