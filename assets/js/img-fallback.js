/* Replaces inline onerror/onload attributes (needed for a strict Content-Security-Policy).
   data-img-error="hide"|"remove"   what to do if the image fails to load
   data-img-loaded="class-name"     class added to the parent once it has loaded */
(function () {
    function ok(img) { return img.complete && img.naturalWidth > 0; }
    function failed(img) { var m = img.getAttribute('data-img-error'); if (m === 'remove') img.remove(); else if (m === 'hide') img.style.display = 'none'; }
    function loaded(img) { var c = img.getAttribute('data-img-loaded'); if (c && img.parentNode) img.parentNode.classList.add(c); }
    document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-img-error')) failed(t); }, true);
    document.addEventListener('load', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-img-loaded')) loaded(t); }, true);
    // images that finished (or failed) before this script ran
    Array.prototype.forEach.call(document.querySelectorAll('img[data-img-error],img[data-img-loaded]'), function (img) {
        if (ok(img)) loaded(img); else if (img.complete) failed(img);
    });
})();
