/* Scroll reveal for the home page: each [data-reveal] element fades up once, when it first comes into view.
   [data-reveal-stagger] marks a parent whose children each reveal in turn. */
(function () {
    'use strict';
    var root = document.documentElement;
    if (!root.classList.contains('mo')) return;            // reduced motion / no IntersectionObserver: nothing to do
    clearTimeout(window.__moT);
    Array.prototype.forEach.call(document.querySelectorAll('[data-reveal-stagger]'), function (p) {
        Array.prototype.forEach.call(p.children, function (c) { c.setAttribute('data-reveal', ''); });
    });
    var items = document.querySelectorAll('[data-reveal]');
    var io = new IntersectionObserver(function (entries) {
        var k = 0;
        entries.filter(function (e) { return e.isIntersecting; })
               .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; })
               .forEach(function (e) {
                   e.target.style.animationDelay = Math.min(k, 4) * 90 + 'ms';
                   e.target.classList.add('is-in'); io.unobserve(e.target); k++;
               });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    Array.prototype.forEach.call(items, function (el) { io.observe(el); });
})();
