/*=========================================
TESTIMONIAL SLIDER
=========================================*/

document.addEventListener("DOMContentLoaded", () => {

    const slider = document.querySelector(".testimonialSwiper");

    if (!slider || typeof Swiper === "undefined" || slider.swiper) return;

    const testimonialSwiper = new Swiper(".testimonialSwiper", {

        loop: true,

        speed: 700,

        spaceBetween: 30,

        grabCursor: true,

        autoplay: {

            delay: 3500,

            disableOnInteraction: false,

            pauseOnMouseEnter: true

        },

        pagination: {

            el: ".swiper-pagination",

            clickable: true

        },

        navigation: {

            nextEl: ".swiper-button-next",

            prevEl: ".swiper-button-prev"

        },

        keyboard: {

            enabled: true

        },

        observer: true,

        observeParents: true,

        breakpoints: {

            0: {

                slidesPerView: 1

            },

            768: {

                slidesPerView: 2

            },

            1200: {

                slidesPerView: 2

            }

        }

    });

    let resizeTimer;

    window.addEventListener("resize", () => {

        clearTimeout(resizeTimer);

        resizeTimer = setTimeout(() => {

            testimonialSwiper.update();

        }, 200);

    });

});