/* Careers page: resume file list (submission is handled by forms.js) */
(function () {
    'use strict';
    var input = document.getElementById('cr-files');
    var list  = document.getElementById('cr-filelist');
    var drop  = document.getElementById('cr-drop');
    function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
    if (input && list && drop) {
        input.addEventListener('change', function () {
            list.innerHTML = '';
            Array.prototype.forEach.call(input.files, function (f) {
                var li = document.createElement('li');
                var a = document.createElement('span'); a.textContent = f.name;
                var b = document.createElement('span'); b.textContent = size(f.size);
                li.appendChild(a); li.appendChild(b); list.appendChild(li);
            });
        });
        ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.add('is-over'); }); });
        ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.remove('is-over'); }); });
    }
})();
