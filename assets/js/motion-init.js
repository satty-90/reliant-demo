/* Runs first, in <head>: turns the reveal effects on only when it is safe. No class = everything simply visible. */
(function () {
    var d = document.documentElement, ok = 'IntersectionObserver' in window;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) ok = false; } catch (e) {}
    if (!ok) return;
    d.classList.add('mo');
    // safety net: if motion.js never loads, show everything after 3.5 s instead of leaving it hidden
    window.__moT = setTimeout(function () { d.classList.remove('mo'); }, 3500);
})();
