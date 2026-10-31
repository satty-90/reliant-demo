/* Careers page: resume file list + demo submit message (no backend yet) */
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
    document.querySelectorAll('form[data-demo-form]').forEach(function (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var note = form.querySelector('.demo-form-note');
            if (!note) {
                note = document.createElement('div');
                note.className = 'demo-form-note';
                note.style.cssText = 'margin-top:14px;padding:12px 16px;border-radius:0;background:#1b1d21;border:1px solid #2E7BE0;color:#f5f5f5;font-size:13px;';
                note.textContent = 'This is a demo site \u2014 applications are not being sent yet. Contact us directly to reach the team.';
                form.appendChild(note);
            }
        });
    });
})();
