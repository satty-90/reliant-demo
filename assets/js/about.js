/*
 * About page — scroll reveals, the scroll-driven timeline, and the photo lightbox.
 * Without JS the page is fully visible (timeline line fully drawn, photos developed).
 * With "reduce motion" on, nothing animates.
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
        }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
        items.forEach(function (el) { io.observe(el); });
    }

    /* ---------- timeline: the blue line draws as you scroll ---------- */
    var wrap = doc.querySelector('.ab-tl2-wrap');
    if (wrap) {
        var steps = [].slice.call(wrap.querySelectorAll('.ab-step'));
        var ticking = false, target = 0, current = null, raf = 0;
        var anchorFrac = 0.55;                               // the "reading line" on screen
        var paint = function (p) { wrap.style.setProperty('--p', (p * 100).toFixed(2) + '%'); };
        var markSteps = function () {
            var anchor = window.innerHeight * anchorFrac;
            steps.forEach(function (s) {
                var b = s.getBoundingClientRect();
                s.classList.toggle('passed', b.top + 24 < anchor);
            });
        };
        // ease the drawn line toward where the page is, so it glides instead of stepping with each scroll tick
        var glide = function () {
            raf = 0;
            var d = target - current;
            if (Math.abs(d) < 0.0004) { current = target; paint(current); return; }
            current += d * 0.16;
            paint(current);
            raf = window.requestAnimationFrame(glide);
        };
        var update = function () {
            ticking = false;
            if (reduce) {
                wrap.style.setProperty('--p', '100%');
                steps.forEach(function (s) { s.classList.add('passed'); });
                return;
            }
            var r = wrap.getBoundingClientRect();
            target = Math.max(0, Math.min(1, (window.innerHeight * anchorFrac - r.top) / r.height));
            if (current === null) current = target;           // first paint: no animation from zero
            markSteps();
            if (!raf) raf = window.requestAnimationFrame(glide);
        };
        var request = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
        window.addEventListener('scroll', request, { passive: true });
        window.addEventListener('resize', request);
        update();
    }

    /* ---------- lightbox ---------- */
    var tiles = [].slice.call(doc.querySelectorAll('.ab-tile[data-full]'));
    var lb = doc.getElementById('abLb');
    if (!tiles.length || !lb) return;
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('p');
    var current = 0, lastFocus = null;

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
