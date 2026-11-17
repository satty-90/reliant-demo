/* Home page RFQ: file list and NDA pop-up. */
(function () {
    var input = document.getElementById('rfq-files');
    if (!input) return;
    var list = document.getElementById('rfq-filelist');
    var drop = document.getElementById('rfq-drop');
    function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
    function render() {
        list.innerHTML = '';
        Array.prototype.forEach.call(input.files, function (f) {
            var li = document.createElement('li');
            var a = document.createElement('span'); a.textContent = f.name;
            var b = document.createElement('span'); b.textContent = size(f.size);
            li.appendChild(a); li.appendChild(b); list.appendChild(li);
        });
    }
    input.addEventListener('change', render);
    ['dragenter', 'dragover'].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (e) { drop.addEventListener(e, function () { drop.classList.remove('is-over'); }); });
})();
/* NDA pop-up: ticking the box opens the agreement; the box only stays ticked after "I Agree". */
(function () {
    var box   = document.getElementById('rfq-nda');
    var modal = document.getElementById('ndaModal');
    if (!box || !modal) return;
    var agree = document.getElementById('ndaAgreeBtn');
    var cancel = document.getElementById('ndaCancelBtn');
    var close = document.getElementById('ndaModalClose');
    var status = document.getElementById('rfq-nda-status');

    function open() {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        agree.focus();
    }
    function finish(agreed) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        box.checked = agreed;
        if (status) status.hidden = !agreed;
        box.focus();
    }

    box.addEventListener('click', function (e) {
        if (box.checked) {            // being ticked -> show the NDA first
            e.preventDefault();
            box.checked = false;
            open();
        } else if (status) {          // being un-ticked
            status.hidden = true;
        }
    });
    agree.addEventListener('click',  function () { finish(true);  });
    cancel.addEventListener('click', function () { finish(false); });
    close.addEventListener('click',  function () { finish(false); });
    modal.addEventListener('click',  function (e) { if (e.target === modal) finish(false); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) finish(false);
    });
})();
