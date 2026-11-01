/*
 * Progressive accordion form (multi-step / stepper).
 * Mark a form with  data-stepper  and each section with  data-step  (a <fieldset> with a <legend>).
 * Each step collapses into a one-line summary once completed; the next step opens.
 * - Continue (or Enter) validates the step, then moves on; steps ahead stay locked until earlier ones are done.
 * - Optional steps (no required fields) offer "Skip".
 * - Submit re-checks every step and reopens the first one that needs attention.
 * - Without JavaScript the form simply stays fully open.
 */
(function () {
    'use strict';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var uid = 0;
    var CHEV = '<svg class="stp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="square" d="M6 9l6 6 6-6"/></svg>';
    var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="square" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7.5v5.5M12 16.5v.01"/></svg>';

    function qsa(root, sel) { return [].slice.call(root.querySelectorAll(sel)); }
    function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

    function controls(step) {
        return qsa(step, 'input, select, textarea').filter(function (c) {
            return c.type !== 'hidden' && c.type !== 'button' && c.type !== 'submit' && !c.closest('[aria-hidden="true"]');
        });
    }
    function labelText(c) {
        var l = c.labels && c.labels[0];
        if (!l) return c.getAttribute('aria-label') || '';
        var clone = l.cloneNode(true);
        qsa(clone, 'span, .req').forEach(function (s) { s.remove(); });
        return text(clone).replace(/[*?]/g, '').trim();
    }
    function messageFor(c) {
        var v = c.validity;
        if (v.valueMissing) {
            if (c.tagName === 'SELECT') return 'Please choose an option.';
            var n = labelText(c).toLowerCase();
            return (n && n.split(' ').length <= 3) ? 'Please enter your ' + n + '.' : 'Please fill in this field.';
        }
        if (v.typeMismatch && c.type === 'email') return 'Please enter a valid email address, like name@company.com.';
        return c.validationMessage || 'Please check this field.';
    }
    function fieldBox(c) { return c.closest('.rfq-field, .contact-form-group') || c.parentNode; }

    function clearError(c) {
        c.removeAttribute('aria-invalid');
        var id = c.getAttribute('data-err');
        if (id) { var e = document.getElementById(id); if (e) e.remove(); c.removeAttribute('data-err'); }
        var d = (c.getAttribute('aria-describedby') || '').split(' ').filter(function (x) { return x && x !== id; }).join(' ');
        if (d) c.setAttribute('aria-describedby', d); else c.removeAttribute('aria-describedby');
    }
    function showError(c) {
        clearError(c);
        var id = 'stp-err-' + (++uid);
        var p = document.createElement('p');
        p.className = 'stp-err'; p.id = id; p.innerHTML = WARN + '<span></span>';
        p.lastChild.textContent = messageFor(c);
        fieldBox(c).appendChild(p);
        c.setAttribute('aria-invalid', 'true'); c.setAttribute('data-err', id);
        c.setAttribute('aria-describedby', ((c.getAttribute('aria-describedby') || '') + ' ' + id).trim());
    }

    function build(form) {
        var fields = qsa(form, '[data-step]');
        if (fields.length < 2) return;
        var last = fields[fields.length - 1];
        form.noValidate = true;
        form.classList.add('is-stepper');
        var total = fields.length;
        var open = 0;
        var steps = [];

        /* whatever follows the last step (NDA, note, submit) lives inside the last step */
        var tail = [];
        var n = last.nextSibling;
        while (n) { var nx = n.nextSibling; tail.push(n); n = nx; }

        var status = document.createElement('p');
        status.className = 'stp-sr'; status.setAttribute('aria-live', 'polite');

        var prog = document.createElement('div');
        prog.className = 'stp-progress';
        prog.innerHTML = '<p class="stp-count"></p><div class="stp-bar" aria-hidden="true"></div>';
        form.insertBefore(prog, fields[0]);
        var countEl = prog.querySelector('.stp-count');
        var barEl = prog.querySelector('.stp-bar');
        form.insertBefore(status, prog);

        fields.forEach(function (fs, i) {
            var id = ++uid;
            var legend = fs.querySelector('legend');
            var title = fs.getAttribute('data-step-title') || (legend ? text(legend) : 'Step ' + (i + 1));
            var isLast = i === total - 1;
            var optional = !controls(fs).some(function (c) { return c.required; });

            var wrap = document.createElement('div'); wrap.className = 'stp';
            wrap.innerHTML =
                '<h3 class="stp-head"><button type="button" class="stp-btn" id="stp-h-' + id + '" aria-expanded="false" aria-controls="stp-p-' + id + '">' +
                '<span class="stp-num" aria-hidden="true"><span class="n">' + (i + 1) + '</span>' + CHECK + '</span>' +
                '<span class="stp-text"><span class="stp-title"></span><span class="stp-meta"></span></span>' +
                '<span class="stp-edit" aria-hidden="true">Edit</span>' + CHEV +
                '<span class="stp-sr stp-state"></span></button></h3>' +
                '<div class="stp-panel" id="stp-p-' + id + '" role="region" aria-labelledby="stp-h-' + id + '"><div class="stp-inner"></div></div>';
            fs.parentNode.insertBefore(wrap, fs);
            var inner = wrap.querySelector('.stp-inner');
            inner.appendChild(fs);
            wrap.querySelector('.stp-title').textContent = title;

            var s = { el: wrap, fs: fs, i: i, title: title, optional: optional, done: false, isLast: isLast,
                      btn: wrap.querySelector('.stp-btn'), meta: wrap.querySelector('.stp-meta'), state: wrap.querySelector('.stp-state'),
                      panel: wrap.querySelector('.stp-panel'), next: null };
            if (isLast) {
                var foot = document.createElement('div'); foot.className = 'stp-footer';
                tail.forEach(function (t) { foot.appendChild(t); });
                inner.appendChild(foot);
            } else {
                var act = document.createElement('div'); act.className = 'stp-actions';
                act.innerHTML = '<button type="button" class="stp-next cobalt-btn"><span></span>' + ARROW + '</button>';
                inner.appendChild(act);
                s.next = act.querySelector('.stp-next');
                s.next.addEventListener('click', function () { complete(s); });
            }
            s.btn.addEventListener('click', function () { toggle(s); });
            steps.push(s);
            var seg = document.createElement('i'); barEl.appendChild(seg); s.seg = seg;
        });

        function hasValue(s) {
            return controls(s.fs).some(function (c) {
                if (c.type === 'checkbox' || c.type === 'radio') return c.checked;
                if (c.type === 'file') return c.files && c.files.length > 0;
                return (c.value || '').trim() !== '' && !(c.tagName === 'SELECT' && c.selectedIndex === 0 && c.options[0].disabled);
            });
        }
        function summary(s) {
            var parts = [], chips = [];
            controls(s.fs).forEach(function (c) {
                if (c.type === 'checkbox') { if (c.checked) { var l = c.closest('label'); chips.push(l ? text(l) : c.value); } return; }
                if (c.type === 'file') { if (c.files && c.files.length) parts.push(c.files.length === 1 ? c.files[0].name : c.files.length + ' files'); return; }
                var v = (c.value || '').trim(); if (!v) return;
                if (c.tagName === 'SELECT') { v = text(c.options[c.selectedIndex]); if (c.options[c.selectedIndex].disabled || c.selectedIndex === 0 && c.options[0].value === '') return; }
                if (c.tagName === 'TEXTAREA' && v.length > 70) v = v.slice(0, 70) + '\u2026';
                parts.push(v);
            });
            if (chips.length) parts.push(chips.join(', '));
            return parts.join(' \u00b7 ');
        }
        function validate(s, show) {
            var bad = [];
            controls(s.fs).forEach(function (c) {
                if (show) clearError(c);
                if (!c.checkValidity()) { bad.push(c); if (show) showError(c); }
            });
            return bad;
        }
        function firstNotDone() {
            for (var k = 0; k < total; k++) if (!steps[k].done) return k;
            return total - 1;
        }
        function render() {
            var fnd = firstNotDone();
            steps.forEach(function (s, k) {
                var locked = k > fnd;
                var isOpen = k === open;
                s.el.setAttribute('data-open', isOpen ? 'true' : 'false');
                s.el.setAttribute('data-state', s.done ? 'done' : (locked ? 'locked' : 'todo'));
                s.btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                s.btn.disabled = locked;
                if (s.panel.inert !== undefined) s.panel.inert = !isOpen;
                var sum = s.done ? summary(s) : '';
                if (s.done) s.meta.textContent = sum || (s.optional ? 'Skipped' : '');
                else if (s.optional) s.meta.innerHTML = '<span class="stp-opt">Optional</span>';
                else s.meta.textContent = '';
                s.meta.style.display = s.meta.textContent === '' && !s.meta.firstChild ? 'none' : '';
                s.state.textContent = s.done ? ' (completed)' : (locked ? ' (locked until the previous step is complete)' : '');
                if (s.next) s.next.firstChild.textContent = (s.optional && !hasValue(s)) ? 'Skip' : 'Continue';
                s.seg.className = s.done ? 'on' : (isOpen ? 'cur' : '');
            });
            var cur = open >= 0 ? open : fnd;
            countEl.innerHTML = 'Step <b>' + (cur + 1) + '</b> of ' + total + ' \u00b7 ' + steps[cur].title;
        }
        function announce(msg) { status.textContent = ''; setTimeout(function () { status.textContent = msg; }, 40); }
        function focusFirst(s) {
            var f = controls(s.fs).filter(function (c) { return c.type !== 'checkbox' && c.type !== 'radio' && c.type !== 'file'; })[0];
            try { (f || s.btn).focus({ preventScroll: true }); } catch (e) { (f || s.btn).focus(); }
        }
        function reveal(s) {
            var go = function () {
                var r = s.el.getBoundingClientRect();
                if (r.top < 100 || r.top > window.innerHeight * 0.55) s.el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
            };
            if (reduce) go(); else setTimeout(go, 120);
        }
        function openStep(k, opts) {
            opts = opts || {};
            leave();
            k = Math.min(k, firstNotDone());
            open = k;
            render();
            if (opts.focus) focusFirst(steps[k]);
            if (opts.scroll !== false) reveal(steps[k]);
            announce('Step ' + (k + 1) + ' of ' + total + ': ' + steps[k].title);
        }
        /* a completed step that was edited into an invalid state stops counting as complete */
        function leave() {
            if (open < 0) return;
            var s = steps[open];
            if (s.done && validate(s, false).length) s.done = false;
        }
        function complete(s) {
            var bad = validate(s, true);
            if (bad.length) {
                render();
                bad[0].focus();
                announce(bad.length + (bad.length === 1 ? ' field needs' : ' fields need') + ' attention in step ' + (s.i + 1) + ': ' + s.title);
                return false;
            }
            s.done = true;
            openStep(firstNotDone(), { focus: true });
            return true;
        }
        function toggle(s) {
            if (s.btn.disabled) return;
            if (open === s.i) { open = -1; render(); return; }
            openStep(s.i, { focus: true });
        }

        /* editing keeps state honest; typing clears that field's error */
        form.addEventListener('input', onEdit); form.addEventListener('change', onEdit);
        function onEdit(e) {
            var c = e.target;
            if (c.getAttribute && c.getAttribute('aria-invalid') === 'true' && c.checkValidity()) clearError(c);
            var s = steps.filter(function (x) { return x.fs.contains(c); })[0];
            if (!s) return;
            if (s.done && validate(s, false).length) { s.done = false; render(); }
            else if (s.next) s.next.firstChild.textContent = (s.optional && !hasValue(s)) ? 'Skip' : 'Continue';
        }
        /* Enter moves to the next step instead of submitting early */
        form.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || e.isComposing) return;
            var t = e.target;
            if (t.tagName !== 'INPUT' || /^(checkbox|radio|file|button|submit)$/.test(t.type)) return;
            var s = steps.filter(function (x) { return x.fs.contains(t); })[0];
            if (!s || s.isLast) return;
            e.preventDefault(); complete(s);
        });
        /* final check on submit: reopen the first step that needs attention */
        form.addEventListener('submit', function (e) {
            for (var k = 0; k < total; k++) {
                var bad = validate(steps[k], true);
                if (bad.length) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    steps[k].done = false;
                    open = k; render();
                    bad[0].focus(); reveal(steps[k]);
                    announce(bad.length + (bad.length === 1 ? ' field needs' : ' fields need') + ' attention in step ' + (k + 1) + ': ' + steps[k].title);
                    return;
                }
                if (k < total - 1) steps[k].done = true;
            }
            render();
        }, true);

        render();
    }

    function init() { qsa(document, 'form[data-stepper]').forEach(build); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
