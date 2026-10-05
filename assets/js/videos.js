/*
 * Reliant Industries — video loader
 * - Loads/plays a video only when it is on (or near) the screen, pauses it when it leaves.
 * - Phones / data-saver: swaps in the lightweight "-m" version (data-src-mobile).
 * - Always muted + inline so iOS and Android allow autoplay.
 * - Respects "reduce motion": videos stay on their poster image.
 */
(function () {
    'use strict';

    var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
    if (!videos.length) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var smallScreen  = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    var saveData     = navigator.connection && navigator.connection.saveData;

    function prepare(v) {
        v.muted = true;
        v.defaultMuted = true;
        v.loop = true;
        v.playsInline = true;
        v.setAttribute('muted', '');
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.setAttribute('disablepictureinpicture', '');

        if (!v.getAttribute('data-ready')) {
            var light = v.getAttribute('data-src-mobile');
            if (light && (smallScreen || saveData)) {
                v.src = light; // overrides the <source> child
            }
            v.setAttribute('data-ready', '1');
        }
    }

    function play(v) {
        prepare(v);
        var p = v.play();
        if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay blocked: poster stays */ });
    }

    if (reduceMotion) return; // poster images only

    if (!('IntersectionObserver' in window)) {
        videos.forEach(play);
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var v = entry.target;
            if (entry.isIntersecting) { play(v); } else { v.pause(); }
        });
    }, { rootMargin: '150px 0px', threshold: 0.01 });

    videos.forEach(function (v) { observer.observe(v); });
})();
