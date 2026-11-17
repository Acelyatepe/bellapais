/*==================================================
BELLAPAIS RESTAURANT
MAIN.JS
==================================================*/

"use strict";

/*==================================================
ELEMENTS
==================================================*/

const body = document.body;

const header = document.getElementById("header");

const topBtn = document.getElementById("topBtn");

const progressBar = document.getElementById("progress-bar");

const loader = document.getElementById("loader");

const menuButton = document.getElementById("menuButton");

const nav = document.querySelector("nav");

const navLinks = document.querySelectorAll("nav a");

const sections = document.querySelectorAll("section[id]");

/*==================================================
AOS
==================================================*/

if (typeof AOS !== "undefined") {

    AOS.init({

        duration: 900,

        once: true,

        easing: "ease"

    });

}

/*==================================================
WINDOW LOAD
==================================================*/

window.addEventListener("load", () => {

    if (loader) {

        setTimeout(() => {

            loader.style.opacity = "0";

            loader.style.visibility = "hidden";

        }, 600);

    }

});

/*==================================================
SCROLL EVENTS
==================================================*/

window.addEventListener("scroll", () => {

    stickyHeader();

    updateProgressBar();

    toggleTopButton();

    activeMenu();

});

/*==================================================
HEADER
==================================================*/

function stickyHeader() {

    if (!header) return;

    if (window.scrollY > 80) {

        header.classList.add("scrolled");

    } else {

        header.classList.remove("scrolled");

    }

}

/*==================================================
PROGRESS BAR
==================================================*/

function updateProgressBar() {

    if (!progressBar) return;

    const scroll = document.documentElement.scrollTop;

    const height =

        document.documentElement.scrollHeight -

        document.documentElement.clientHeight;

    const percent = height > 0 ? scroll / height * 100 : 0;

    progressBar.style.width = percent + "%";

}

/*==================================================
BACK TO TOP
==================================================*/

function toggleTopButton() {

    if (!topBtn) return;

    if (window.scrollY > 400) {

        topBtn.classList.add("active");

    } else {

        topBtn.classList.remove("active");

    }

}

if (topBtn) {

    topBtn.addEventListener("click", () => {

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    });

}

/*==================================================
SMOOTH SCROLL
==================================================*/

document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener("click", function (e) {

        e.preventDefault();

        if (this.classList.contains("order-btn")) return;
        const id = this.getAttribute("href").slice(1);
        if (!id) return;
        const target = document.getElementById(id);

        if (target) {

            target.scrollIntoView({

                behavior: "smooth"

            });

        }

    });

});

/*==================================================
ACTIVE MENU
==================================================*/

function activeMenu() {

    let current = "";

    sections.forEach(section => {

        const top = section.offsetTop - 180;

        const height = section.offsetHeight;

        if (

            window.scrollY >= top &&

            window.scrollY < top + height

        ) {

            current = section.id;

        }

    });

    navLinks.forEach(link => {

        link.classList.remove("active");

        if (

            link.getAttribute("href") === "#" + current

        ) {

            link.classList.add("active");

        }

    });

}

/*==================================================
MOBILE MENU
==================================================*/

if (menuButton && nav) {

    menuButton.addEventListener("click", () => {

        nav.classList.toggle("active");

        menuButton.classList.toggle("active");

    });

}

navLinks.forEach(link => {

    link.addEventListener("click", () => {

        if (nav) nav.classList.remove("active");

        if (menuButton)

            menuButton.classList.remove("active");

    });

});
/*==================================================
COUNTER
==================================================*/

const counters = document.querySelectorAll(".counter");

if (counters.length) {

    const counterObserver = new IntersectionObserver(entries => {

        entries.forEach(entry => {

            if (!entry.isIntersecting) return;

            const counter = entry.target;

            const target = Number(counter.dataset.target);

            let current = 0;

            const increase = target / 80;

            function updateCounter() {

                current += increase;

                if (current < target) {

                    counter.innerText = Math.floor(current);

                    requestAnimationFrame(updateCounter);

                } else {

                    counter.innerText = target.toLocaleString("tr-TR");

                }

            }

            updateCounter();

            counterObserver.unobserve(counter);

        });

    });

    counters.forEach(counter => {

        counterObserver.observe(counter);

    });

}

const menuCards = document.querySelectorAll(".menu-card");

/*==================================================
CARD HOVER
==================================================*/

menuCards.forEach(card => {

    card.addEventListener("mouseenter", () => {

        card.style.transform =

            "translateY(-8px)";

    });

    card.addEventListener("mouseleave", () => {

        card.style.transform =

            "translateY(0)";

    });

});
/*==================================================
FAVORITES
==================================================*/

const favoriteButtons = document.querySelectorAll(".favorite-btn");
function updateFavorites() {
    const saved = Bellapais.read("bellapaisFavorites", []);
    const favorites = Array.isArray(saved) ? saved : [];
    favoriteButtons.forEach(button => {
        const card = button.closest(".menu-card, .featured-card");
        if (!card) return;
        const active = favorites.includes(card.querySelector("h3").textContent.trim());
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-label", active ? "Favorilerden çıkar" : "Favorilere ekle");
        const icon = button.querySelector("i");
        icon.classList.toggle("fa-solid", active);
        icon.classList.toggle("fa-regular", !active);
    });
}
favoriteButtons.forEach(button => button.addEventListener("click", () => {
    const title = button.closest(".menu-card, .featured-card")?.querySelector("h3").textContent.trim();
    if (!title) return;
    Bellapais.transaction("bellapaisFavorites", () => {
        const saved = Bellapais.read("bellapaisFavorites", []);
        const favorites = Array.isArray(saved) ? saved : [];
        const next = favorites.includes(title) ? favorites.filter(item => item !== title) : [...favorites, title];
        if (Bellapais.write("bellapaisFavorites", next)) updateFavorites();
    });
}));
window.addEventListener("storage", event => {
    if (event.key === "bellapaisFavorites" || event.key === null) updateFavorites();
});
updateFavorites();

/*==================================================
LAZY LOAD
==================================================*/

const lazyImages =

document.querySelectorAll("img[data-src]");

if(lazyImages.length){

const lazyObserver=

new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(!entry.isIntersecting) return;

const image=entry.target;

image.src=image.dataset.src;

lazyObserver.unobserve(image);

});

});

lazyImages.forEach(image=>{

lazyObserver.observe(image);

});

}

/*==================================================
REVEAL ANIMATION
==================================================*/

const revealItems=document.querySelectorAll(

".featured-card,.menu-card,.chef-card,.gallery-item,.why-card,.testimonial-card"

);

if(revealItems.length){

const revealObserver=

new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("fade-up");

}

});

},{

threshold:.15

});

revealItems.forEach(item=>{

revealObserver.observe(item);

});

}
/*==================================================
TESTIMONIAL SWIPER
==================================================*/

if (

typeof Swiper !== "undefined" &&

document.querySelector(".testimonialSwiper")

){

new Swiper(".testimonialSwiper",{

loop:true,

speed:800,

spaceBetween:30,

grabCursor:true,

autoplay:{

delay:3500,

disableOnInteraction:false,

pauseOnMouseEnter:true

},

pagination:{

el:".swiper-pagination",

clickable:true

},

navigation:{

nextEl:".swiper-button-next",

prevEl:".swiper-button-prev"

},

keyboard:{

enabled:true

},

breakpoints:{

0:{

slidesPerView:1

},

768:{

slidesPerView:2

},

1200:{

slidesPerView:3

}

}

});

}

