/* Table requests are local until a restaurant backend is connected. */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tableServiceForm");
    if (!form) return;
    const input = document.getElementById("tableNumber");
    const list = document.getElementById("serviceRequests");
    const feedback = document.getElementById("serviceFeedback");
    const key = "bellapaisService";
    const labels = { waiter: "Garson çağır", bill: "Hesap iste", water: "Su iste", cutlery: "Çatal/bıçak iste", cleaning: "Masanın temizlenmesini iste", help: "Sipariş hakkında yardım iste" };
    const buttons = [...form.querySelectorAll("button[data-request]")];
    let busy = false;
    function table() {
        return /^\d{1,3}$/.test(input.value.trim()) && Number(input.value) > 0 ? String(Number(input.value)) : "";
    }
    function state() {
        const saved = Bellapais.read(key, {});
        return { table: saved?.table || "", requests: (Array.isArray(saved?.requests) ? saved.requests : []).filter(row => row && labels[row.type] && /^\d{1,3}$/.test(row.table) && ["Bekliyor", "Tamamlandı"].includes(row.status)) };
    }
    function blocked(row, number, type) {
        return row.table === number && row.type === type && (row.status === "Bekliyor" || Date.now() - row.createdAt < 30000);
    }
    function render() {
        const current = state();
        const number = table();
        buttons.forEach(button => {
            button.disabled = busy || !number || current.requests.some(row => blocked(row, number, button.dataset.request));
        });
        list.replaceChildren();
        const requests = current.requests.filter(row => row.table === number).slice().reverse();
        if (!requests.length) {
            const empty = document.createElement("li");
            empty.className = "service-empty";
            empty.textContent = number ? "Bu masa için henüz talep yok." : "Önce masa numaranızı yazın.";
            list.append(empty);
        }
        requests.forEach(row => {
            const item = document.createElement("li");
            const title = document.createElement("p");
            title.textContent = `Masa ${row.table} · ${labels[row.type]}`;
            const status = document.createElement("p");
            status.textContent = `${row.status} · ${new Date(row.createdAt).toLocaleString("tr-TR")}`;
            item.append(title, status);
            if (row.status === "Bekliyor") {
                const complete = document.createElement("button");
                complete.type = "button"; complete.className = "order-btn";
                complete.textContent = "Hizmet alındı";
                complete.setAttribute("aria-label", `${labels[row.type]}: tamamlandı olarak işaretle`);
                complete.addEventListener("click", async () => {
                    await Bellapais.transaction(key, () => {
                        const latest = state();
                        const request = latest.requests.find(entry => entry.id === row.id);
                        if (!request || request.status !== "Bekliyor") return;
                        request.status = "Tamamlandı"; request.completedAt = Date.now();
                        if (!Bellapais.write(key, latest)) return;
                        feedback.textContent = "Talebiniz Tamamlandı olarak işaretlendi.";
                        render();
                        document.querySelector("#tableService summary").focus();
                    });
                });
                item.append(complete);
            }
            list.append(item);
        });
    }
    input.value = state().table;
    input.addEventListener("input", () => { input.setCustomValidity(""); feedback.textContent = ""; render(); });
    input.addEventListener("change", () => {
        if (table()) Bellapais.transaction(key, () => {
            const current = state(); current.table = table(); Bellapais.write(key, current);
        });
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const type = event.submitter?.dataset.request;
        if (busy || !labels[type]) return;
        const number = table();
        input.setCustomValidity(number ? "" : "1 ile 999 arasında bir masa numarası yazın.");
        if (!form.reportValidity()) return;
        busy = true; render();
        try {
            await Bellapais.transaction(key, () => {
                const current = state();
                if (current.requests.some(row => blocked(row, number, type))) {
                    feedback.textContent = "Bu talep zaten kaydedildi. Lütfen mevcut talebin durumunu kontrol edin."; return;
                }
                current.table = number;
                current.requests.push({ id: crypto.randomUUID(), table: number, type, status: "Bekliyor", createdAt: Date.now() });
                if (!Bellapais.write(key, current)) return;
                feedback.textContent = `Masa ${number}: ${labels[type]} talebiniz bu cihazda kaydedildi. Durum: Bekliyor. Lütfen görevliye gösterin.`;
            });
        } finally { busy = false; render(); input.focus(); }
    });
    window.addEventListener("storage", event => { if (event.key === key || event.key === null) render(); });
    // Refresh only button availability when the short repeat protection expires.
    setInterval(() => {
        const current = state();
        buttons.forEach(button => { button.disabled = busy || !table() || current.requests.some(row => blocked(row, table(), button.dataset.request)); });
    }, 1000);
    render();
});
