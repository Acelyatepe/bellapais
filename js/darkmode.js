/*=========================================
DARK MODE
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    const darkButton = document.getElementById("darkMode");

    if (!darkButton) return;

    const body = document.body;

    const setTheme = (theme) => {

        if (theme === "light") {

            body.classList.add("light-mode");

            darkButton.innerHTML =
                '<i class="fa-solid fa-sun"></i>';

        } else {

            body.classList.remove("light-mode");

            darkButton.innerHTML =
                '<i class="fa-solid fa-moon"></i>';

        }

        try { localStorage.setItem("theme", theme); } catch {}
        darkButton.setAttribute("aria-pressed", String(theme !== "light"));
        darkButton.setAttribute("aria-label", theme === "light" ? "Karanlık moda geç" : "Açık moda geç");

    };

    let savedTheme = "dark";
    try { savedTheme = localStorage.getItem("theme") || "dark"; } catch {}

    setTheme(savedTheme);

    darkButton.addEventListener("click", () => {

        const newTheme =
            body.classList.contains("light-mode")
                ? "dark"
                : "light";

        setTheme(newTheme);

    });

});