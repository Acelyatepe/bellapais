/* Validate existing forms and record requests without claiming remote delivery. */
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("input, select, textarea").forEach(input => {
        if (!input.labels?.length && !input.hasAttribute("aria-label")) {
            input.setAttribute("aria-label", input.placeholder || ({ date: "Rezervasyon tarihi", time: "Rezervasyon saati", person: "Kişi sayısı" }[input.id]) || input.name || "E-posta adresi");
        }
        input.addEventListener("input", () => input.setCustomValidity(""));
    });
    const reservation = document.getElementById("reservationForm");
    const date = document.getElementById("date");
    function today() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    if (date) date.min = today();
    for (const form of document.querySelectorAll("#reservationForm, #contactForm, .newsletter")) {
        let busy = false;
        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (busy) return;
            const fields = [...form.querySelectorAll("input, select, textarea")];
            fields.forEach(input => {
                input.setCustomValidity(input.required && !input.value.trim() ? "Lütfen bu alanı doldurun." : "");
            });
            if (form === reservation) {
                date.min = today();
                const time = document.getElementById("time");
                const phone = document.getElementById("phone");
                if (!/^[+\d\s().-]+$/.test(phone.value) || phone.value.replace(/\D/g, "").length < 10) phone.setCustomValidity("Geçerli bir telefon numarası yazın.");
                if (date.value && time.value && new Date(`${date.value}T${time.value}`) <= new Date()) time.setCustomValidity("Gelecekte bir tarih ve saat seçin.");
            }
            if (!form.reportValidity()) return;
            const kind = form === reservation ? "reservation" : form.id === "contactForm" ? "contact" : "newsletter";
            const values = Object.fromEntries(fields.map((input, index) => [input.name || input.id || String(index), input.value.trim()]));
            const fingerprint = JSON.stringify(values);
            const key = "bellapaisForms";
            const submit = form.querySelector("button[type='submit']");
            busy = true; submit.disabled = true;
            try {
                await Bellapais.transaction(key, () => {
                    const saved = Bellapais.read(key, []);
                    const entries = Array.isArray(saved) ? saved : [];
                    if (entries.some(entry => entry.kind === kind && entry.fingerprint === fingerprint && (kind === "newsletter" || Date.now() - entry.createdAt < 60000))) {
                        Bellapais.notice("Bu talep zaten kaydedildi."); return;
                    }
                    const entry = { id: crypto.randomUUID(), kind, values, fingerprint, createdAt: Date.now(), status: "Bekliyor" };
                    if (!Bellapais.write(key, [...entries, entry])) return;
                    Bellapais.notice("Talebiniz bu cihazda kaydedildi. Restorana otomatik iletilmedi; lütfen görevliyle iletişime geçin.");
                    form.reset();
                });
            } finally { busy = false; submit.disabled = false; }
        });
    }
    const lightbox = document.getElementById("lightbox");
    const lightboxImage = document.getElementById("lightboxImage");
    if (lightbox && lightboxImage) {
        document.body.append(lightbox);
        document.querySelectorAll(".gallery-item").forEach(link => link.addEventListener("click", event => {
            event.preventDefault();
            const image = link.querySelector("img");
            lightboxImage.src = image.src;
            lightboxImage.alt = image.alt;
            Bellapais.open(lightbox, link);
        }));
        document.getElementById("lightboxClose").addEventListener("click", () => Bellapais.close(lightbox));
        lightbox.addEventListener("click", event => { if (event.target === lightbox) Bellapais.close(lightbox); });
    }
    const cookie = document.getElementById("cookiePopup");
    if (cookie) {
        cookie.hidden = Bellapais.read("bellapaisCookieAccepted", false) === true;
        document.getElementById("acceptCookie")?.addEventListener("click", () => {
            if (Bellapais.write("bellapaisCookieAccepted", true)) cookie.hidden = true;
        });
    }
    document.querySelectorAll('a[href="#"]:not(.order-btn)').forEach(link => link.addEventListener("click", event => {
        event.preventDefault();
        Bellapais.notice("Bu bağlantının içeriği henüz eklenmedi. Bilgi almak için lütfen restoranla iletişime geçin.");
    }));
    const menuButton = document.getElementById("menuButton");
    const nav = document.querySelector("nav");
    if (menuButton && nav) {
        nav.id ||= "mainNavigation";
        menuButton.setAttribute("aria-controls", nav.id);
        const sync = () => {
            const open = nav.classList.contains("active");
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
            nav.inert = matchMedia("(max-width: 992px)").matches && !open;
        };
        new MutationObserver(sync).observe(nav, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("resize", sync);
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && nav.classList.contains("active")) {
                nav.classList.remove("active"); menuButton.classList.remove("active"); menuButton.focus();
            }
        });
        document.addEventListener("click", event => {
            if (!nav.contains(event.target) && !menuButton.contains(event.target)) {
                nav.classList.remove("active"); menuButton.classList.remove("active");
            }
        });
        sync();
    }
});
