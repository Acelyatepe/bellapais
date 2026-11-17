/* Search, category and sorting share one view of the original menu. */
document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector(".menu-grid");
    if (!grid) return;
    const original = [...grid.querySelectorAll(".menu-card")];
    const search = document.getElementById("menuSearch");
    const sort = document.getElementById("sortMenu");
    const filters = [...document.querySelectorAll(".filter-btn")];
    const empty = document.createElement("p");
    empty.textContent = "Aramanıza uygun ürün bulunamadı.";
    empty.className = "empty-cart";
    empty.setAttribute("role", "status");
    empty.hidden = true;
    grid.after(empty);
    search?.setAttribute("aria-label", "Menüde ara");
    sort?.setAttribute("aria-label", "Menüyü sırala");
    const normalize = text => text.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i");
    let category = "all";
    function render() {
        const query = normalize(search?.value.trim() || "");
        const cards = [...original];
        const mode = sort?.value;
        if (mode === "name") cards.sort((a, b) => a.querySelector("h3").textContent.localeCompare(b.querySelector("h3").textContent, "tr"));
        if (mode === "low" || mode === "high") cards.sort((a, b) => (Number(a.dataset.price) - Number(b.dataset.price)) * (mode === "low" ? 1 : -1));
        let visible = 0;
        cards.forEach(card => {
            const match = (category === "all" || card.classList.contains(category)) && normalize(card.textContent).includes(query);
            card.style.display = match ? "" : "none";
            if (match) visible++;
            grid.append(card);
        });
        empty.hidden = visible !== 0;
    }
    filters.forEach(button => {
        button.setAttribute("aria-pressed", String(button.classList.contains("active")));
        button.addEventListener("click", () => {
            category = button.dataset.filter;
            filters.forEach(item => {
                item.classList.toggle("active", item === button);
                item.setAttribute("aria-pressed", String(item === button));
            });
            render();
        });
    });
    search?.addEventListener("input", render);
    sort?.addEventListener("change", render);
});
