/*
 * Form submission layer for the RFQ, Contact and Careers forms.
 *
 * WHAT THIS DOES
 *  - Sending state, success screen, flash messages (toasts) and an inline banner for errors.
 *  - Abuse deterrents that can run in a browser: honeypot, minimum fill time, cooldown + hourly cap,
 *    double-submit lock, input clean-up (length limits, control characters, header-injection characters),
 *    file checks (type, size, count), optional Cloudflare Turnstile.
 *
 * WHAT THIS CANNOT DO
 *  Browser code is not security: anyone can bypass it. Every one of these checks MUST be repeated on the server
 *  (validation, rate limiting per IP, file scanning, Turnstile verification). See the security checklist.
 */
(function () {
    'use strict';
    var doc = document;
    var CFG = (function () {
        var d = { endpoint: '', turnstileSiteKey: '', timeoutMs: 20000, minFillMs: 3000, cooldownMs: 30000, maxPerHour: 3, phone: '586-275-0479' };
        var u = window.RELIANT_FORMS || {};
        for (var k in u) if (Object.prototype.hasOwnProperty.call(u, k)) d[k] = u[k];
        return d;
    })();
    var MB = 1048576;
    var script = doc.currentScript;
    var ROOT = script && script.src ? new URL('../../', script.src).href : '/';

    var KINDS = {
        rfq:     { noun: 'quote request', title: 'Request received', email: 'sales@reliantindustries.com', next: ['pages/capabilities.html', 'Explore capabilities'],
                   files: { input: 'rfq-files', max: 5, maxBytes: 25 * MB, totalBytes: 60 * MB, ext: ['step', 'stp', 'dwg', 'dxf', 'pdf'] } },
        careers: { noun: 'application', title: 'Application received', email: 'info@reliantindustries.com', next: ['pages/about.html', 'Learn about Reliant'],
                   files: { input: 'cr-files', max: 1, maxBytes: 5 * MB, totalBytes: 5 * MB, ext: ['pdf', 'doc', 'docx'] } },
        contact: { noun: 'message', title: 'Message sent', email: 'sales@reliantindustries.com', next: ['index.html', 'Back to home'] }
    };
    var DANGEROUS = /^(exe|js|jse|bat|cmd|com|scr|msi|dll|vbs|ps1|sh|php|phtml|html?|svg|jar|apk|app|lnk|iso|hta)$/i;

    /* ---------- tiny helpers ---------- */
    function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
        return [].map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    var ICON = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5"/><path stroke-linecap="square" d="M7.5 12.5l3 3 6-6.5"/></svg>',
        error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5"/><path stroke-linecap="round" d="M12 7.5v5.5M12 16.5v.01"/></svg>',
        info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5"/><path stroke-linecap="round" d="M12 11v5.5M12 7.5v.01"/></svg>',
        close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="square" d="M6 6l12 12M18 6L6 18"/></svg>',
        big:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="square" d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
    };

    /* ---------- flash messages (toasts) ---------- */
    var region = null;
    function flash(o) {
        if (!region) { region = el('div', 'fl-region'); doc.body.appendChild(region); }
        var t = el('div', 'fl-toast fl-' + o.type);
        t.setAttribute('role', o.type === 'error' ? 'alert' : 'status');
        t.innerHTML = '<span class="fl-ico" aria-hidden="true">' + ICON[o.type] + '</span><div class="fl-body"><p class="fl-title"></p><p class="fl-msg"></p><div class="fl-actions"></div></div>' +
                      '<button type="button" class="fl-x" aria-label="Dismiss message">' + ICON.close + '</button>';
        t.querySelector('.fl-title').textContent = o.title || '';
        var m = t.querySelector('.fl-msg'); if (o.message) m.textContent = o.message; else m.remove();
        var acts = t.querySelector('.fl-actions');
        (o.actions || []).forEach(function (a) {
            var n = a.href ? el('a') : el('button'); if (!a.href) n.type = 'button';
            if (a.href) n.href = a.href; n.textContent = a.label; if (a.onClick) n.addEventListener('click', a.onClick); acts.appendChild(n);
        });
        if (!acts.children.length) acts.remove();
        var timer = null, gone = false;
        function close() { if (gone) return; gone = true; clearTimeout(timer); t.classList.add('fl-leave'); setTimeout(function () { t.remove(); }, 230); }
        t.querySelector('.fl-x').addEventListener('click', close);
        if (o.type !== 'error') {                       /* errors stay until dismissed */
            var arm = function () { timer = setTimeout(close, o.duration || 9000); };
            t.addEventListener('mouseenter', function () { clearTimeout(timer); }); t.addEventListener('mouseleave', arm);
            t.addEventListener('focusin', function () { clearTimeout(timer); }); arm();
        }
        region.appendChild(t);
        while (region.children.length > 3) region.firstChild.remove();
        return { close: close, el: t };
    }
    window.RelFlash = flash;                            /* available to other scripts */

    /* ---------- rate limit memory (best effort, per browser) ---------- */
    function store(kind) { try { return JSON.parse(localStorage.getItem('rel_sub_' + kind) || '[]').filter(function (x) { return typeof x === 'number'; }); } catch (e) { return []; } }
    function remember(kind) { try { var a = store(kind); a.push(Date.now()); localStorage.setItem('rel_sub_' + kind, JSON.stringify(a.slice(-10))); } catch (e) { /* storage blocked: fine */ } }
    function rateLimited(kind) {
        var a = store(kind), now = Date.now();
        var last = a.length ? a[a.length - 1] : 0;
        if (now - last < CFG.cooldownMs) return 'Please wait ' + Math.ceil((CFG.cooldownMs - (now - last)) / 1000) + ' seconds before sending another.';
        var hour = a.filter(function (x) { return now - x < 3600000; }).length;
        if (hour >= CFG.maxPerHour) return 'You have sent several requests in the last hour. Please try again later, or call us.';
        return '';
    }

    /* ---------- input hygiene ---------- */
    var CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;   /* control + invisible direction/zero-width characters */
    function clean(v, multiline) {
        v = String(v == null ? '' : v).replace(CTRL, '');
        if (!multiline) v = v.replace(/[\r\n]+/g, ' ');                 /* no line breaks in single-line fields (header injection) */
        return v.trim();
    }
    function harden(form) {
        [].forEach.call(form.querySelectorAll('input, textarea'), function (c) {
            var t = c.type;
            if (/^(hidden|checkbox|radio|file|submit|button)$/.test(t)) return;
            if (!c.getAttribute('maxlength')) c.setAttribute('maxlength', c.tagName === 'TEXTAREA' ? '5000' : t === 'email' ? '254' : t === 'tel' ? '30' : '120');
            if (t === 'tel' && !c.getAttribute('pattern')) { c.setAttribute('pattern', '[0-9+().\\-\\sxXeEtT#]{7,30}'); c.setAttribute('title', 'Digits, spaces and + ( ) - . only'); }
        });
    }
    function sanitizeValues(form) {
        [].forEach.call(form.querySelectorAll('input, textarea'), function (c) {
            if (/^(hidden|checkbox|radio|file|submit|button|password)$/.test(c.type)) return;
            var v = clean(c.value, c.tagName === 'TEXTAREA');
            if (v !== c.value) c.value = v;
        });
    }

    /* ---------- file checks ---------- */
    function fileProblems(files, rule) {
        var bad = [], ok = [], total = 0;
        [].forEach.call(files, function (f) {
            var parts = f.name.toLowerCase().split('.'), ext = parts.length > 1 ? parts.pop() : '';
            if (!f.size) { bad.push(f.name + ' is empty.'); return; }
            if (rule.ext.indexOf(ext) === -1) { bad.push(f.name + ': only ' + rule.ext.join(', ').toUpperCase() + ' files are accepted.'); return; }
            if (parts.slice(1).some(function (p) { return DANGEROUS.test(p); })) { bad.push(f.name + ' has a suspicious name.'); return; }
            if (/^(text\/html|image\/svg\+xml|application\/(x-msdownload|x-sh|javascript))/.test(f.type)) { bad.push(f.name + ' is not an allowed file type.'); return; }
            if (f.size > rule.maxBytes) { bad.push(f.name + ' is larger than ' + Math.round(rule.maxBytes / MB) + ' MB.'); return; }
            if (ok.length >= rule.max) { bad.push('Only ' + rule.max + (rule.max === 1 ? ' file is' : ' files are') + ' accepted; ' + f.name + ' was not added.'); return; }
            if (total + f.size > rule.totalBytes) { bad.push(f.name + ' would exceed the ' + Math.round(rule.totalBytes / MB) + ' MB total.'); return; }
            total += f.size; ok.push(f);
        });
        return { ok: ok, bad: bad };
    }
    function watchFiles(form, rule) {
        var input = doc.getElementById(rule.input); if (!input) return;
        input.addEventListener('change', function (e) {
            if (e.detail && e.detail.fromForms) return;
            var r = fileProblems(input.files, rule);
            if (!r.bad.length) return;
            try { var dt = new DataTransfer(); r.ok.forEach(function (f) { dt.items.add(f); }); input.files = dt.files; } catch (err) { input.value = ''; }
            input.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { fromForms: true } }));   /* refresh the on-page file list */
            flash({ type: 'error', title: r.bad.length === 1 ? 'A file was not added' : r.bad.length + ' files were not added', message: r.bad.slice(0, 3).join(' ') });
        }, true);
    }

    /* ---------- Cloudflare Turnstile (only when a site key is configured) ---------- */
    var tsLoading = null;
    function loadTurnstile() {
        if (window.turnstile) return Promise.resolve();
        if (tsLoading) return tsLoading;
        tsLoading = new Promise(function (res, rej) {
            var s = doc.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.defer = true;
            s.onload = res; s.onerror = function () { tsLoading = null; rej(new Error('turnstile')); }; doc.head.appendChild(s);
        });
        return tsLoading;
    }

    /* ---------- one form ---------- */
    function setup(form) {
        var kind = form.getAttribute('data-form'); var K = KINDS[kind]; if (!K) return;
        var st = { busy: false, startedAt: 0, id: uuid(), banner: null, ts: null };
        var submitBtn = form.querySelector('button[type="submit"]');
        var footer = form.querySelector('.stp-footer') || form;
        form.noValidate = true;
        harden(form);
        if (K.files) watchFiles(form, K.files);

        /* honeypot (contact has one already) */
        var hp = form.querySelector('input[name="website"]');
        if (!hp) {
            var w = el('div', 'fl-hp'); w.setAttribute('aria-hidden', 'true');
            w.innerHTML = '<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>';
            form.appendChild(w); hp = w.querySelector('input');
        }
        /* minimum-fill-time clock starts at the first interaction */
        var start = function () { if (!st.startedAt) st.startedAt = Date.now(); };
        form.addEventListener('focusin', start); form.addEventListener('input', start);

        /* Turnstile */
        if (CFG.turnstileSiteKey) {
            var box = el('div', 'fl-turnstile'); box.style.margin = '0 0 18px';
            var row = form.querySelector('.rfq-submit-row, .contact-form-submit') || submitBtn.parentNode;
            row.parentNode.insertBefore(box, row);
            loadTurnstile().then(function () { st.ts = window.turnstile.render(box, { sitekey: CFG.turnstileSiteKey, theme: 'dark', appearance: 'interaction-only' }); }).catch(function () { /* handled at submit */ });
        }

        function clearBanner() { if (st.banner) { st.banner.remove(); st.banner = null; } }
        function setBusy(on) {
            st.busy = on; form.setAttribute('aria-busy', on ? 'true' : 'false'); form.classList.toggle('is-sending', on);
            if (!submitBtn) return;
            if (on) { submitBtn.dataset.label = submitBtn.innerHTML; submitBtn.innerHTML = '<span class="fl-spin" aria-hidden="true"></span>Sending\u2026'; submitBtn.disabled = true; submitBtn.classList.add('fl-submit-busy'); }
            else { if (submitBtn.dataset.label) submitBtn.innerHTML = submitBtn.dataset.label; submitBtn.disabled = false; submitBtn.classList.remove('fl-submit-busy'); }
        }
        function contactActions() {
            return [{ label: 'Call ' + CFG.phone, href: 'tel:' + CFG.phone.replace(/[^0-9+]/g, '') }, { label: 'Email us', href: 'mailto:' + K.email }];
        }
        function fail(title, message, opts) {
            opts = opts || {};
            setBusy(false); clearBanner();
            var b = el('div', 'fl-banner');            /* takes focus below, so it is read aloud once; the toast carries the alert role */
            b.innerHTML = '<span class="fl-ico" aria-hidden="true">' + ICON.error + '</span><div class="fl-body"><p class="fl-title"></p><p class="fl-msg"></p></div>';
            b.querySelector('.fl-title').textContent = title; b.querySelector('.fl-msg').textContent = message;
            var row = footer.querySelector('.rfq-submit-row, .contact-form-submit'); (row || footer).parentNode.insertBefore(b, row || footer); st.banner = b;
            flash({ type: 'error', title: title, message: opts.noContact ? message : '', actions: opts.noContact ? [] : contactActions() });
            if (opts.focusBanner !== false) { b.setAttribute('tabindex', '-1'); b.focus({ preventScroll: false }); }
        }
        function succeed(info) {
            setBusy(false); clearBanner(); remember(kind);
            var first = (form.querySelector('[name="name"], [name="first_name"]') || {}).value || '';
            first = clean(first).split(' ')[0];
            var done = el('div', 'fl-done');
            done.innerHTML = '<div class="fl-badge" aria-hidden="true">' + ICON.big + '</div><h3 tabindex="-1"></h3><p class="fl-lead"></p>' +
                             '<span class="fl-ref"></span><div class="fl-preview" hidden><b>Preview mode</b><br>Nothing was actually sent. Form delivery will be switched on at launch. To reach the team now, call ' + CFG.phone + '.</div>' +
                             '<div class="fl-done-actions"><button type="button" class="fl-again cobalt-btn" style="min-height:52px;padding:0 28px;border:0;color:#fff;cursor:pointer;font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:14px">Send another</button><a class="fl-link"></a></div>';
            done.querySelector('h3').textContent = K.title + (first ? ', ' + first : '') + '.';
            done.querySelector('.fl-lead').textContent = 'Thank you. Your ' + K.noun + ' has been received and the Reliant team will review it.';
            var ref = info.id || ('REL-' + st.id.replace(/-/g, '').slice(0, 8).toUpperCase());
            done.querySelector('.fl-ref').textContent = 'Reference ' + ref;
            if (info.preview) done.querySelector('.fl-preview').hidden = false;
            var lnk = done.querySelector('.fl-link'); lnk.href = ROOT + K.next[0]; lnk.textContent = K.next[1];
            form.classList.add('fl-sent'); form.appendChild(done);
            var h = done.querySelector('h3'); h.focus({ preventScroll: true }); done.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            flash({ type: info.preview ? 'info' : 'success', title: info.preview ? 'Preview: nothing was sent' : (K.noun.charAt(0).toUpperCase() + K.noun.slice(1) + ' sent'), message: info.preview ? 'This is how the confirmation will look once forms are live.' : 'Reference ' + ref + '.' });
            done.querySelector('.fl-again').addEventListener('click', function () {
                done.remove(); form.classList.remove('fl-sent'); form.reset();
                [].forEach.call(form.querySelectorAll('input[type="file"]'), function (f) { f.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { fromForms: true } })); });
                form.dispatchEvent(new CustomEvent('stepper:reset')); st.id = uuid(); st.startedAt = 0;
                var f1 = form.querySelector('input:not([type=hidden]):not([type=checkbox]):not(.fl-hp input)'); if (f1) f1.focus();
            });
        }

        /* preview mode: behaves like the real thing, sends nothing */
        function preview() {
            var q = (location.search.match(/[?&]simulate=([a-z]+)/) || [])[1];
            return new Promise(function (res) {
                setTimeout(function () {
                    if (q === 'error') return res({ status: 0, network: true });
                    if (q === 'ratelimit') return res({ status: 429, retryAfter: 90 });
                    if (q === 'invalid') return res({ status: 422, json: { errors: { email: 'This email address was rejected. Please check it.' } } });
                    res({ status: 200, preview: true, json: {} });
                }, 1100);
            });
        }
        function send(fd) {
            if (!CFG.endpoint) return preview();
            var ctrl = ('AbortController' in window) ? new AbortController() : null;
            var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, CFG.timeoutMs);
            return fetch(CFG.endpoint, { method: 'POST', body: fd, headers: { 'Accept': 'application/json', 'Idempotency-Key': st.id }, credentials: 'omit', mode: 'cors', referrerPolicy: 'no-referrer', signal: ctrl ? ctrl.signal : undefined })
                .then(function (res) { clearTimeout(timer); return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, json: j, retryAfter: parseInt(res.headers.get('Retry-After') || '0', 10) }; }); })
                .catch(function (err) { clearTimeout(timer); return { status: 0, network: true, aborted: err && err.name === 'AbortError' }; });
        }
        function handle(r) {
            if (r.status >= 200 && r.status < 300) return succeed({ id: r.json && typeof r.json.id === 'string' ? r.json.id.slice(0, 40) : '', preview: !!r.preview });
            if (r.status === 400 || r.status === 422) {
                var errs = r.json && r.json.errors;
                if (errs && typeof errs === 'object') { setBusy(false); form.dispatchEvent(new CustomEvent('stepper:errors', { detail: { errors: errs } })); flash({ type: 'error', title: 'Please check your details', message: 'Some information needs attention. We have marked the fields.' }); return; }
                return fail('We could not accept that', 'Please check your details and try again.');
            }
            if (r.status === 413) return fail('Files are too large', 'Please send smaller files, or email them to us directly.');
            if (r.status === 429) return fail('Too many requests', r.retryAfter ? 'Please wait about ' + Math.ceil(r.retryAfter / 60) + ' minute(s) and try again, or call us.' : 'Please wait a few minutes and try again, or call us.');
            if (r.network) return fail(navigator.onLine === false ? 'You appear to be offline' : (r.aborted ? 'That took too long' : 'We could not reach our server'), 'Your details are still here. Check your connection and try again, or contact us directly.');
            return fail('Something went wrong on our side', 'Your details are still here. Please try again in a moment, or contact us directly.');
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (st.busy) return;                                              /* double-submit lock */
            clearBanner();
            if (hp && hp.value.trim() !== '') { return succeed({ preview: !CFG.endpoint }); }          /* bot: look successful, send nothing */
            if (!st.startedAt || Date.now() - st.startedAt < CFG.minFillMs) return fail('Please review your details', 'That was very quick. Take a moment to check everything, then send again.', { noContact: true });
            if (CFG.endpoint) { var rl = rateLimited(kind); if (rl) return fail('Please slow down', rl); }
            var token = '';
            if (CFG.turnstileSiteKey) {
                try { token = window.turnstile && st.ts != null ? window.turnstile.getResponse(st.ts) : ''; } catch (err) { token = ''; }
                if (!token) return fail('Security check needed', 'Please complete the security check, then send again.', { noContact: true });
            }
            sanitizeValues(form);
            var fd = new FormData(form);
            fd.delete('website');
            fd.set('form_kind', kind); fd.set('submission_id', st.id); fd.set('elapsed_ms', String(Date.now() - st.startedAt)); fd.set('page', location.pathname);
            setBusy(true);
            send(fd).then(function (r) { handle(r); if (st.ts != null && !(r.status >= 200 && r.status < 300)) { try { window.turnstile.reset(st.ts); } catch (err) { /* ignore */ } } });
        });
    }

    function init() {
        [].forEach.call(doc.querySelectorAll('form[data-form]'), setup);
        /* people without JavaScript get a clear message instead of a silent dead form */
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
