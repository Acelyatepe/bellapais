/* Shared persistence and accessible dialogs. */
"use strict";
const Bellapais = (() => {
    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch { return fallback; }
    }
    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            alert("Kayıt yapılamadı. Tarayıcı depolamasına izin verip yeniden deneyin.");
            return false;
        }
    }
    function money(cents) {
        return "₺" + (cents / 100).toLocaleString("tr-TR", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
    }
    function price(value) {
        if (typeof value === "number") return Math.round(value * 100);
        const normalized = String(value ?? "").replace(/[₺\s]/g, "").replace(/\./g, "").replace(",", ".");
        return normalized && /^\d+(\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : NaN;
    }
    // Every read-modify-write uses the same lock across pages and tabs.
    function transaction(name, action) {
        if (navigator.locks) return navigator.locks.request(name, action);
        return Promise.resolve(action());
    }
    const stack = [];
    let originalOverflow = "";
    function open(panel, trigger = document.activeElement, overlay = null) {
        if (!panel || stack.some(entry => entry.panel === panel)) return;
        if (!stack.length) originalOverflow = document.body.style.overflow;
        const previous = [...document.body.children].map(node => [node, node.inert]);
        for (const [node] of previous) {
            if (node !== panel && !node.contains(panel) && node !== overlay) node.inert = true;
        }
        panel.inert = false;
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-hidden", "false");
        panel.tabIndex = -1;
        panel.classList.add("active");
        overlay?.classList.add("active");
        document.body.style.overflow = "hidden";
        stack.push({ panel, trigger, overlay, previous });
        (panel.querySelector("button:not(:disabled), input, [tabindex='0']") || panel).focus();
    }
    function close(panel) {
        const entry = stack.at(-1);
        if (!entry || entry.panel !== panel) return;
        stack.pop();
        panel.classList.remove("active");
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
        entry.overlay?.classList.remove("active");
        for (const [node, inert] of entry.previous) node.inert = inert;
        if (!stack.length) document.body.style.overflow = originalOverflow;
        const target = entry.trigger;
        if (target && !target.disabled && !target.closest("[inert]")) target.focus();
        else (stack.at(-1)?.panel.querySelector("button:not(:disabled)") || document.getElementById("cartButton"))?.focus();
    }
    document.addEventListener("keydown", event => {
        const entry = stack.at(-1);
        if (!entry) return;
        if (event.key === "Escape") { event.preventDefault(); close(entry.panel); }
        if (event.key !== "Tab") return;
        const targets = [...entry.panel.querySelectorAll("button:not(:disabled), a[href], input, select, textarea, summary, [tabindex='0']")]
            .filter(node => node.getClientRects().length && !node.closest("[inert]"));
        const first = targets[0] || entry.panel;
        const last = targets.at(-1) || entry.panel;
        if (event.shiftKey && (document.activeElement === first || document.activeElement === entry.panel)) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === entry.panel)) {
            event.preventDefault(); first.focus();
        }
    });
    const popup = document.getElementById("successPopup");
    if (popup) {
        const content = document.createElement("div");
        content.className = "order-success-content";
        content.append(...popup.childNodes);
        const dismiss = document.createElement("button");
        dismiss.id = "closeNotice";
        dismiss.type = "button";
        dismiss.className = "order-btn";
        dismiss.textContent = "Tamam";
        dismiss.addEventListener("click", () => close(popup));
        content.append(dismiss);
        popup.append(content);
        popup.classList.add("order-success-modal");
        popup.inert = true;
        popup.setAttribute("aria-hidden", "true");
        popup.setAttribute("aria-label", "Bilgilendirme");
        popup.addEventListener("click", event => { if (event.target === popup) close(popup); });
        document.body.append(popup);
    }
    function notice(message) {
        if (!popup) { alert(message); return; }
        popup.querySelector("h3").textContent = "Bilgilendirme";
        popup.querySelector("p").textContent = message;
        open(popup);
    }
    return { read, write, money, price, transaction, open, close, notice };
})();


/* Eksik görseller: bozuk resim simgesi yerine sade bir yer tutucu göster. */
(() => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#1b1b1b"/><g fill="none" stroke="#D4AF37" stroke-width="6" stroke-linecap="round" opacity=".75"><path d="M350 230v60a22 22 0 0 0 44 0v-60M372 230v140M440 230c-24 18-24 78 0 92v48"/></g><text x="400" y="430" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#D4AF37" opacity=".85">Bellapais</text></svg>';
    const placeholder = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const apply = img => {
        if (!img || img.dataset.fallback || !img.getAttribute("src")) return;
        img.dataset.fallback = "1";
        img.classList.add("img-missing");
        img.src = placeholder;
    };
    document.addEventListener("error", event => {
        if (event.target instanceof HTMLImageElement) apply(event.target);
    }, true);
    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("img").forEach(img => {
            if (img.complete && img.naturalWidth === 0) apply(img);
        });
    });
})();
