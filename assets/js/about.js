/*
 * About page — reveals, timeline arrows, photo lightbox.
 * Everything degrades gracefully: without JS the page is fully visible and readable.
 */
(function () {
    'use strict';
    var doc = document;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- scroll reveals ---------- */
    var items = [].slice.call(doc.querySelectorAll('.reveal'));
    if (reduce || !('IntersectionObserver' in window)) {
        items.forEach(function (el) { el.classList.add('in'); });
    } else {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        items.forEach(function (el) { io.observe(el); });
    }

    /* ---------- timeline arrows (desktop scroller) ---------- */
    var tl = doc.querySelector('.ab-tl');
    var prev = doc.getElementById('abPrev');
    var next = doc.getElementById('abNext');
    if (tl && prev && next) {
        var step = function () {
            var item = tl.querySelector('.ab-tl-item');
            return item ? item.getBoundingClientRect().width + 32 : 400;
        };
        var update = function () {
            prev.disabled = tl.scrollLeft <= 4;
            next.disabled = tl.scrollLeft + tl.clientWidth >= tl.scrollWidth - 4;
        };
        prev.addEventListener('click', function () { tl.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }); });
        next.addEventListener('click', function () { tl.scrollBy({ left: step(),  behavior: reduce ? 'auto' : 'smooth' }); });
        tl.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ---------- lightbox ---------- */
    var tiles = [].slice.call(doc.querySelectorAll('.ab-tile[data-full]'));
    var lb = doc.getElementById('abLb');
    if (!tiles.length || !lb) return;
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('p');
    var current = 0;
    var lastFocus = null;

    function show(i) {
        current = (i + tiles.length) % tiles.length;
        var t = tiles[current];
        lbImg.src = t.getAttribute('data-full');
        lbImg.alt = t.getAttribute('data-alt') || '';
        lbCap.textContent = t.getAttribute('data-cap') || '';
    }
    function open(i) {
        lastFocus = doc.activeElement;
        show(i);
        lb.classList.add('open');
        doc.body.style.overflow = 'hidden';
        lb.querySelector('.x').focus();
    }
    function close() {
        lb.classList.remove('open');
        doc.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    tiles.forEach(function (t, i) { t.addEventListener('click', function () { open(i); }); });
    lb.querySelector('.x').addEventListener('click', close);
    lb.querySelector('.prev').addEventListener('click', function () { show(current - 1); });
    lb.querySelector('.next').addEventListener('click', function () { show(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    doc.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') show(current - 1);
        else if (e.key === 'ArrowRight') show(current + 1);
    });
})();
