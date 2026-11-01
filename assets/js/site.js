/*
 * Shared behaviour for every page (small, dependency-free):
 *  - marks the current page in the navigation (aria-current)
 *  - Escape closes the mobile menu and returns focus to its button
 *  - back-to-top button on long pages
 *  - "jump bar" highlight (capabilities)
 */
(function () {
    'use strict';
    var doc = document;

    /* clickjacking guard: this site is never meant to be shown inside another site's frame */
    try {
        if (window.top !== window.self) {
            doc.documentElement.style.display = 'none';
            window.top.location.replace(window.self.location.href);
        }
    } catch (e) { doc.documentElement.style.display = 'none'; }


    /* current page */
    var here = (location.pathname.split('/').pop() || 'index.html');
    doc.querySelectorAll('header nav a, #mobileMenu a, footer .ft-links a').forEach(function (a) {
        var href = a.getAttribute('href') || '';
        if (href.indexOf('#') !== -1) return;
        var file = href.split('/').pop();
        if (file && file === here) a.setAttribute('aria-current', 'page');
    });

    /* mobile menu (single source of truth for every page) */
    var btn = doc.getElementById('mobileMenuBtn');
    var menu = doc.getElementById('mobileMenu');
    var hamburger = doc.getElementById('hamburgerIcon');
    var closeIcon = doc.getElementById('closeIcon');
    function setMenu(open) {
        if (!btn || !menu) return;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.classList.toggle('hidden', !open);
        if (hamburger) hamburger.classList.toggle('hidden', open);
        if (closeIcon) closeIcon.classList.toggle('hidden', !open);
    }
    if (btn && menu) {
        btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
        menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });          /* tapping a link closes it */
        doc.addEventListener('click', function (e) {                                                            /* tapping outside closes it */
            if (btn.getAttribute('aria-expanded') === 'true' && !menu.contains(e.target) && !btn.contains(e.target)) setMenu(false);
        });
        doc.addEventListener('keydown', function (e) {                                                          /* Escape closes it */
            if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { setMenu(false); btn.focus(); }
        });
        window.addEventListener('resize', function () { if (window.innerWidth >= 768) setMenu(false); });
    }

    /* back to top */
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (doc.documentElement.scrollHeight > window.innerHeight * 3) {
        var top = doc.createElement('button');
        top.type = 'button'; top.className = 'to-top'; top.setAttribute('aria-label', 'Back to top');
        top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="square" d="M12 19V5M5 12l7-7 7 7"/></svg>';
        top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
        doc.body.appendChild(top);
        /* appears only when scrolling back UP (when you'd want it), so it never covers content while reading down */
        var ticking = false, lastY = window.scrollY;
        var toggle = function () {
            ticking = false;
            var y = window.scrollY, up = y < lastY - 6, down = y > lastY + 6;
            if (y < 900) top.classList.remove('show');
            else if (up) top.classList.add('show');
            else if (down) top.classList.remove('show');
            if (up || down) lastY = y;
        };
        window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(toggle); } }, { passive: true });
    }

    /* jump bar: highlight the section being read */
    var links = [].slice.call(doc.querySelectorAll('.cap-jump a[href^="#"]'));
    if (links.length && 'IntersectionObserver' in window) {
        var map = {};
        links.forEach(function (a) { var t = doc.getElementById(a.getAttribute('href').slice(1)); if (t) map[t.id] = a; });
        var current = null;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                var a = map[en.target.id]; if (!a || a === current) return;
                links.forEach(function (l) { l.removeAttribute('aria-current'); });
                a.setAttribute('aria-current', 'true'); current = a;
                var bar = a.closest('ul'); if (bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: a.offsetLeft - 24, behavior: reduce ? 'auto' : 'smooth' });
            });
        }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
        Object.keys(map).forEach(function (id) { io.observe(doc.getElementById(id)); });
    }
})();
