<?php
/**
 * forms-lib.php: shared helpers + configuration for the Reliant forms endpoint (submit.php / download.php).
 * PHP 7.4+. Secrets come from the project's .env (already loaded by ../api/config.php).
 *
 * Optional .env additions (all have safe defaults):
 *   RFQ_NOTIFY_EMAIL=...            default inbox (falls back to ADMIN_EMAIL)
 *   FORMS_MAIL_TO_RFQ / FORMS_MAIL_TO_CONTACT / FORMS_MAIL_TO_CAREERS    per-form inboxes
 *   FORMS_ALLOWED_ORIGINS=https://www.reliantindustries.com,https://satty-90.github.io
 *   FORMS_LINK_SECRET=<long random string>     signs the file links (derived from the Brevo key if absent)
 *   FORMS_STORAGE_DIR=/path/outside/public     (default: <project>/storage/reliant-forms)
 *   FORMS_PUBLIC_URL=https://www.cevamobility.com/reliant-demo     (base of download links)
 *   TURNSTILE_SECRET=...            enables the Cloudflare Turnstile bot check
 */
const RF_MB = 1048576;

function rf_env($key, $default = null) {
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') return $_ENV[$key];
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') return $_SERVER[$key];
    $v = getenv($key);
    return ($v !== false && $v !== '') ? $v : $default;
}

function rf_config() {
    static $c = null;
    if ($c !== null) return $c;
    $base = [];
    $f = __DIR__ . '/../api/config.php';          // the project's existing config (loads .env through Dotenv)
    if (is_file($f)) { $base = require $f; }
    $brevo  = isset($base['brevo_api_key']) ? $base['brevo_api_key'] : rf_env('BREVO_API_KEY', '');
    $admin  = isset($base['admin_email'])   ? $base['admin_email']   : rf_env('ADMIN_EMAIL', '');
    $site   = isset($base['site_email'])    ? $base['site_email']    : rf_env('SITE_EMAIL', '');
    $notify = rf_env('RFQ_NOTIFY_EMAIL', $admin);
    $pm     = rf_env('POSTMARK_TOKEN', '');
    $prov   = strtolower((string) rf_env('EMAIL_PROVIDER', $pm !== '' ? 'postmark' : 'brevo'));
    $from   = rf_env('MAIL_FROM', $site);
    $c = [
        'provider'    => in_array($prov, ['postmark', 'log'], true) ? $prov : 'brevo',
        'postmark_token' => $pm,
        'postmark_url'   => rf_env('POSTMARK_API_URL', 'https://api.postmarkapp.com/email'),
        'postmark_stream'=> rf_env('POSTMARK_STREAM', 'outbound'),
        'from'        => $from,
        'confirm_from'=> rf_env('MAIL_FROM_CONFIRM', $from),
        'confirm_reply_to' => rf_env('RFQ_CONFIRM_REPLY_TO', rf_env('FORMS_MAIL_TO_RFQ', $notify)),
        'confirm_rfq' => rf_env('RFQ_CONFIRMATION', '1') !== '0',
        'phone'       => rf_env('COMPANY_PHONE', '586-275-0479'),
        'response_time' => rf_env('RFQ_RESPONSE_TIME', ''),
        'brevo_key'   => $brevo,
        'brevo_url'   => rf_env('BREVO_API_URL', 'https://api.brevo.com/v3/smtp/email'),
        'site_email'  => $site,
        'sender_name' => rf_env('FORMS_SENDER_NAME', 'Reliant Website'),
        'to'          => ['rfq' => rf_env('FORMS_MAIL_TO_RFQ', $notify), 'contact' => rf_env('FORMS_MAIL_TO_CONTACT', $notify), 'careers' => rf_env('FORMS_MAIL_TO_CAREERS', $notify)],
        'origins'     => array_values(array_filter(array_map(function ($s) { return rtrim(trim($s), '/'); }, explode(',', (string) rf_env('FORMS_ALLOWED_ORIGINS', ''))))),
        'storage'     => rtrim(rf_env('FORMS_STORAGE_DIR', dirname(__DIR__, 2) . '/storage/reliant-forms'), '/'),
        'link_secret' => rf_env('FORMS_LINK_SECRET', hash_hmac('sha256', 'reliant-forms-links', (string) ($pm !== '' ? $pm : $brevo))),
        'link_days'   => (int) rf_env('FORMS_LINK_DAYS', 7),
        'turnstile'   => rf_env('TURNSTILE_SECRET', ''),
        'turnstile_url' => rf_env('TURNSTILE_VERIFY_URL', 'https://challenges.cloudflare.com/turnstile/v0/siteverify'),
        'clamscan'    => rf_env('CLAMSCAN_PATH', ''),
        'limit_email' => (int) rf_env('FORMS_LIMIT_EMAIL_10MIN', 3),
        'limit_email_day' => (int) rf_env('FORMS_LIMIT_EMAIL_DAY', 10),
        'limit_all'   => (int) rf_env('FORMS_LIMIT_ALL_DAY', 300),
        'limit_all10' => (int) rf_env('FORMS_LIMIT_ALL_10MIN', 40),
        'keep_days_files' => (int) rf_env('FORMS_KEEP_FILES_DAYS', 180),
        'keep_days_leads' => (int) rf_env('FORMS_KEEP_LEADS_DAYS', 730),
        'trust_cf'    => rf_env('FORMS_TRUST_CF', '') === '1',
        'public_url'  => rtrim((string) rf_env('FORMS_PUBLIC_URL', ''), '/'),
    ];
    $GLOBALS['RF_CFG'] = $c;
    return $c;
}

function rf_kinds() {
    return [
        'rfq' => ['label' => 'Quote request', 'required' => ['name', 'company', 'email'],
                  'order' => ['name', 'company', 'email', 'phone', 'part_name', 'annual_volume', 'material', 'process', 'details', 'nda'],
                  'files' => ['field' => 'files', 'errkey' => 'files[]', 'max' => 5, 'maxBytes' => 25 * RF_MB, 'total' => 60 * RF_MB, 'ext' => ['step', 'stp', 'dwg', 'dxf', 'pdf'], 'required' => false]],
        'contact' => ['label' => 'Contact message', 'required' => ['first_name', 'last_name', 'company', 'email', 'inquiry_type', 'message'],
                  'order' => ['first_name', 'last_name', 'company', 'job_title', 'email', 'phone', 'inquiry_type', 'message']],
        'careers' => ['label' => 'Job application', 'required' => ['name', 'email', 'phone', 'position'],
                  'order' => ['name', 'email', 'phone', 'position', 'about'],
                  'files' => ['field' => 'resume', 'errkey' => 'resume', 'max' => 1, 'maxBytes' => 5 * RF_MB, 'total' => 5 * RF_MB, 'ext' => ['pdf', 'doc', 'docx'], 'required' => true]],
    ];
}
function rf_limits() {
    return ['name' => 120, 'first_name' => 80, 'last_name' => 80, 'company' => 120, 'job_title' => 120, 'email' => 254, 'phone' => 30, 'part_name' => 120,
            'annual_volume' => 60, 'material' => 60, 'details' => 5000, 'message' => 5000, 'about' => 5000, 'position' => 80, 'inquiry_type' => 60];
}
const RF_INQUIRY = ['capabilities', 'existing_customer', 'supplier', 'careers', 'company_information', 'other'];
const RF_POSITIONS = ['Press Operator', 'Material Handler / Hi-Lo Driver', 'Die Setter', 'Quality Inspector', 'Die Repairman', 'Shipping / Receiving', 'Another role / general application'];

/* ---------- output ---------- */
function rf_cors_origin($cfg) {
    $o = isset($_SERVER['HTTP_ORIGIN']) ? rtrim($_SERVER['HTTP_ORIGIN'], '/') : '';
    if ($o === '') return '';
    $allowed = $cfg['origins'];
    if (!empty($_SERVER['HTTP_HOST'])) {                       // the site this script itself is served from
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
        $allowed[] = ($https ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
    }
    return in_array($o, $allowed, true) ? $o : '';
}
function rf_send_headers($origin, $extra = []) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS'); header('Access-Control-Allow-Headers: Content-Type, Idempotency-Key, Accept');
        header('Access-Control-Expose-Headers: Retry-After'); header('Access-Control-Max-Age: 86400');
    }
    foreach ($extra as $k => $v) header($k . ': ' . $v);
}
function rf_reply($status, $body, $origin, $extra = []) {
    http_response_code($status); rf_send_headers($origin, $extra);
    echo json_encode($body); exit;
}

/* ---------- text + validation helpers ---------- */
function rf_clean($v, $multiline = false) {
    $v = (string) $v;
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u', '', $v);
    if ($v === null) $v = '';
    if (!$multiline) $v = preg_replace('/[\r\n]+/', ' ', $v);
    return trim($v);
}
function rf_len($s) { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s); }
function rf_esc($s) { return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function rf_label($f) { $m = ['name' => 'name', 'first_name' => 'first name', 'last_name' => 'last name', 'company' => 'company', 'email' => 'email', 'phone' => 'phone number', 'position' => 'position', 'message' => 'message']; return isset($m[$f]) ? $m[$f] : 'details'; }

function rf_validate($kind, $post) {
    $K = rf_kinds()[$kind]; $lim = rf_limits(); $vals = []; $errors = [];
    foreach ($K['order'] as $f) {
        if ($f === 'process') {
            $p = isset($post['process']) && is_array($post['process']) ? $post['process'] : [];
            $vals['process'] = array_slice(array_values(array_filter(array_map(function ($x) { return rf_clean(is_scalar($x) ? $x : ''); }, $p))), 0, 8); continue;
        }
        if ($f === 'nda') { $vals['nda'] = !empty($post['nda']) ? 'Yes, requested' : ''; continue; }
        $raw = isset($post[$f]) && is_scalar($post[$f]) ? $post[$f] : '';
        $multi = in_array($f, ['details', 'message', 'about'], true);
        $v = rf_clean($raw, $multi);
        if (rf_len($v) > (isset($lim[$f]) ? $lim[$f] : 200)) { $errors[$f] = 'This is too long.'; continue; }
        $vals[$f] = $v;
    }
    foreach ($K['required'] as $f) if (empty($vals[$f])) $errors[$f] = ($f === 'inquiry_type' || $f === 'position') ? 'Please choose an option.' : 'Please enter your ' . rf_label($f) . '.';
    if (!empty($vals['email']) && empty($errors['email']) && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', $vals['email'])) $errors['email'] = 'Please enter a valid email address.';
    if (!empty($vals['phone']) && empty($errors['phone']) && !preg_match('/^[0-9+().\-\sxXeEtT#]{7,30}$/', $vals['phone'])) $errors['phone'] = 'Please enter a valid phone number.';
    if ($kind === 'contact' && !empty($vals['inquiry_type']) && !in_array($vals['inquiry_type'], RF_INQUIRY, true)) $errors['inquiry_type'] = 'Please choose an option.';
    if ($kind === 'careers' && !empty($vals['position']) && !in_array($vals['position'], RF_POSITIONS, true)) $errors['position'] = 'Please choose an option.';
    return [$vals, $errors];
}

/* ---------- uploads ---------- */
function rf_uploaded($field) {
    if (!isset($_FILES[$field])) return [];
    $f = $_FILES[$field]; $out = [];
    if (is_array($f['name'])) { foreach ($f['name'] as $i => $n) $out[] = ['name' => (string) $n, 'tmp' => $f['tmp_name'][$i], 'size' => (int) $f['size'][$i], 'error' => (int) $f['error'][$i]]; }
    else $out[] = ['name' => (string) $f['name'], 'tmp' => $f['tmp_name'], 'size' => (int) $f['size'], 'error' => (int) $f['error']];
    return array_values(array_filter($out, function ($x) { return $x['error'] !== UPLOAD_ERR_NO_FILE; }));
}
function rf_sniff($path, $ext) {
    $b = (string) @file_get_contents($path, false, null, 0, 512); $h = substr($b, 0, 16);
    if (strncmp($h, 'MZ', 2) === 0 || strncmp($h, "\x7fELF", 4) === 0 || strncmp($h, '#!', 2) === 0 || preg_match('/^\s*<(\?php|html|script|svg)/i', $b)) return false;
    switch ($ext) {
        case 'pdf': return strncmp($h, '%PDF-', 5) === 0;
        case 'dwg': return (bool) preg_match('/^AC\d{4}/', $h);
        case 'step': case 'stp': return (bool) preg_match('/^\s*ISO-10303-21/', $b);
        case 'dxf': return (bool) preg_match('/^\s*0\s*\r?\n\s*SECTION/', $b) || strncmp($h, 'AutoCAD Binary DXF', 18) === 0;
        case 'docx': return strncmp($h, "PK\x03\x04", 4) === 0;
        case 'doc': return strncmp($h, "\xD0\xCF\x11\xE0", 4) === 0;
    }
    return false;
}
function rf_check_files($kind) {
    $K = rf_kinds()[$kind]; if (!isset($K['files'])) return [[], ''];
    $r = $K['files']; $all = rf_uploaded($r['field']);
    if (!$all) return [[], $r['required'] ? 'Please attach your resume.' : ''];
    if (count($all) > $r['max']) return [[], 'Please attach no more than ' . $r['max'] . ($r['max'] === 1 ? ' file.' : ' files.')];
    $total = 0; $out = [];
    foreach ($all as $f) {
        if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) return [[], $f['name'] . ' is larger than the server allows.'];
        if ($f['error'] !== UPLOAD_ERR_OK) return [[], $f['name'] . ' could not be uploaded. Please try again.'];
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $r['ext'], true)) return [[], 'Only ' . strtoupper(implode(', ', $r['ext'])) . ' files are accepted.'];
        if ($f['size'] > $r['maxBytes']) return [[], $f['name'] . ' is larger than ' . round($r['maxBytes'] / RF_MB) . ' MB.'];
        $total += $f['size']; if ($total > $r['total']) return [[], 'The files are larger than ' . round($r['total'] / RF_MB) . ' MB in total.'];
        if (!is_uploaded_file($f['tmp']) || !rf_sniff($f['tmp'], $ext)) return [[], $f['name'] . ' does not look like a real ' . strtoupper($ext) . ' file.'];
        if (rf_infected($GLOBALS['RF_CFG'], $f['tmp'])) return [[], $f['name'] . ' was blocked by our security scan. Please check the file and try again.'];
        $f['ext'] = $ext; $out[] = $f;
    }
    return [$out, ''];
}

/* ---------- storage, abuse controls, signing ---------- */
function rf_dir($cfg, $sub) { $d = $cfg['storage'] . '/' . $sub; if (!is_dir($d)) @mkdir($d, 0750, true); return $d; }
function rf_ip($cfg) { if ($cfg['trust_cf'] && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) return $_SERVER['HTTP_CF_CONNECTING_IP']; return isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown'; }
function rf_rate_limited($cfg, $key, $per10 = 5, $perDay = 30) {   // returns seconds to wait, or 0 when allowed
    $fh = @fopen(rf_dir($cfg, 'ratelimit') . '/' . sha1($key) . '.json', 'c+'); if (!$fh) return 0;
    flock($fh, LOCK_EX); $t = json_decode((string) stream_get_contents($fh), true); if (!is_array($t)) $t = [];
    $now = time(); $t = array_values(array_filter($t, function ($x) use ($now) { return $x > $now - 86400; }));
    $ten = count(array_filter($t, function ($x) use ($now) { return $x > $now - 600; })); $wait = 0;
    if (count($t) >= $perDay) $wait = 3600; elseif ($ten >= $per10) $wait = 600; else $t[] = $now;
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($t)); flock($fh, LOCK_UN); fclose($fh);
    return $wait;
}
/* optional virus scan: only runs when ClamAV is installed on the host and CLAMSCAN_PATH points at it. Returns true = infected. */
function rf_infected($cfg, $path) {
    $bin = $cfg['clamscan']; if ($bin === '' || !is_executable($bin) || !function_exists('exec')) return false;
    $out = []; $code = 0; @exec(escapeshellarg($bin) . ' --no-summary --stdout ' . escapeshellarg($path) . ' 2>&1', $out, $code);
    if ($code === 1) return true;
    if ($code !== 0) error_log('forms: virus scanner error code ' . $code);   // scanner trouble must not block real customers
    return false;
}
/* never write visitor email addresses or long provider messages into server logs */
function rf_logsafe($s) { return substr(preg_replace('/[^\s@<>"\']+@[^\s@<>"\']+/', '[email]', (string) $s), 0, 160); }
function rf_turnstile_ok($cfg, $token, $ip, $id) {
    if ($cfg['turnstile'] === '') return true; if ($token === '') return false;
    $ch = curl_init($cfg['turnstile_url']);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 10,
        CURLOPT_POSTFIELDS => http_build_query(['secret' => $cfg['turnstile'], 'response' => $token, 'remoteip' => $ip, 'idempotency_key' => $id])]);
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = json_decode((string) $res, true);
    if ($code !== 200 || empty($j['success'])) return false;
    if (!empty($j['hostname'])) { $hosts = []; foreach ($cfg['origins'] as $o) { $h = parse_url($o, PHP_URL_HOST); if ($h) $hosts[] = $h; } if (!empty($_SERVER['HTTP_HOST'])) $hosts[] = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST']); return in_array($j['hostname'], $hosts, true); }
    return true;
}
function rf_b64u($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function rf_unb64u($s) { return base64_decode(strtr($s, '-_', '+/')); }
function rf_sign($cfg, $key, $exp) { return hash_hmac('sha256', $key . '.' . $exp, $cfg['link_secret']); }
function rf_public_base($cfg) {
    if ($cfg['public_url'] !== '') return $cfg['public_url'];
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    return ($https ? 'https://' : 'http://') . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost') . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
}

/* ---------- email through an HTTPS API (Postmark, or Brevo as the fallback). No SMTP. ----------
 * $m = [from, from_name, to[], reply_to, reply_name, subject, text, html, tag]. Returns true only if the provider accepted it. */
function rf_mail_ready($cfg) {
    if ($cfg['provider'] === 'log') return $cfg['from'] !== '';   // dry-run: no provider needed
    return $cfg['from'] !== '' && ($cfg['provider'] === 'postmark' ? $cfg['postmark_token'] !== '' : $cfg['brevo_key'] !== '');
}
function rf_post_json($url, $headers, $payload) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 15, CURLOPT_POSTFIELDS => json_encode($payload), CURLOPT_HTTPHEADER => array_merge(['accept: application/json', 'content-type: application/json'], $headers)]);
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    return [$code, (string) $res, $err];
}
function rf_send($cfg, $m) {
    if ($cfg['provider'] === 'log') {
        /* DRY-RUN MODE (EMAIL_PROVIDER=log): nothing is sent. The email is written to <storage>/outbox/ so the whole flow can be tested
         * on the real server before Postmark's DNS records / token are ready. Switch to postmark for go-live. */
        $dir = $cfg['storage'] . '/outbox';
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return false;
        $f = $dir . '/' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '-' . preg_replace('/[^a-z0-9-]/i', '', isset($m['tag']) ? $m['tag'] : 'mail') . '.json';
        return @file_put_contents($f, json_encode(['to' => $m['to'], 'from' => $m['from_name'] . ' <' . $m['from'] . '>', 'reply_to' => isset($m['reply_to']) ? $m['reply_to'] : '', 'subject' => $m['subject'], 'text' => $m['text']], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX) !== false;
    }
    $name = preg_replace('/[\r\n"<>]+/', ' ', (string) $m['from_name']);
    $rname = mb_substr(preg_replace('/[\r\n"<>]+/', ' ', (string) (isset($m['reply_name']) ? $m['reply_name'] : '')), 0, 70);
    if ($cfg['provider'] === 'postmark') {
        $p = ['From' => $name . ' <' . $m['from'] . '>', 'To' => implode(',', array_map('trim', $m['to'])), 'Subject' => $m['subject'], 'TextBody' => $m['text'], 'HtmlBody' => $m['html'],
              'MessageStream' => $cfg['postmark_stream'], 'Tag' => isset($m['tag']) ? $m['tag'] : 'website'];
        if (!empty($m['reply_to'])) $p['ReplyTo'] = ($rname !== '' ? $rname . ' <' . $m['reply_to'] . '>' : $m['reply_to']);
        list($code, $res, $err) = rf_post_json($cfg['postmark_url'], ['X-Postmark-Server-Token: ' . $cfg['postmark_token']], $p);
        $j = json_decode($res, true);
        if ($err || $code < 200 || $code >= 300 || (is_array($j) && isset($j['ErrorCode']) && (int) $j['ErrorCode'] !== 0)) { error_log('forms: Postmark send failed HTTP ' . $code . ' ' . rf_logsafe($err . ' ' . $res)); return false; }
        return true;
    }
    $p = ['sender' => ['name' => $name, 'email' => $m['from']], 'to' => array_map(function ($e) { return ['email' => trim($e)]; }, $m['to']), 'subject' => $m['subject'], 'textContent' => $m['text'], 'htmlContent' => $m['html']];
    if (!empty($m['reply_to'])) $p['replyTo'] = ['email' => $m['reply_to'], 'name' => $rname];
    list($code, $res, $err) = rf_post_json($cfg['brevo_url'], ['api-key: ' . $cfg['brevo_key']], $p);
    if ($err || $code < 200 || $code >= 300) { error_log('forms: Brevo send failed HTTP ' . $code . ' ' . rf_logsafe($err . ' ' . $res)); return false; }
    return true;
}
function rf_reply_name($vals) { return !empty($vals['name']) ? $vals['name'] : trim((isset($vals['first_name']) ? $vals['first_name'] : '') . ' ' . (isset($vals['last_name']) ? $vals['last_name'] : '')); }

/* team notification for one saved lead; Reply-To is the visitor so "Reply" answers them */
function rf_notify_team($cfg, $kind, $vals, $ref, $links) {
    list($subject, $text, $html) = rf_build_email($cfg, $kind, $vals, $ref, $links);
    $to = array_values(array_filter(array_map('trim', explode(',', (string) $cfg['to'][$kind]))));
    if (!$to || !rf_mail_ready($cfg)) return false;
    return rf_send($cfg, ['from' => $cfg['from'], 'from_name' => $cfg['sender_name'], 'to' => $to, 'reply_to' => $vals['email'], 'reply_name' => rf_reply_name($vals), 'subject' => $subject, 'text' => $text, 'html' => $html, 'tag' => 'team-' . $kind]);
}

/* RFQ-only "we got it" email: fixed wording, nothing the visitor typed is echoed back. Never throws, never blocks the lead. */
function rf_confirm_rfq($cfg, $vals, $ref) {
    if (!$cfg['confirm_rfq'] || empty($vals['email']) || !rf_mail_ready($cfg)) return false;
    $when = $cfg['response_time'] !== '' ? ' We aim to respond within ' . $cfg['response_time'] . '.' : '';
    $text = "Thank you for your request for quote.\n\nWe have received it and a member of the Reliant team will review it and get back to you." . $when . "\n\nYour reference: $ref\n\nIf it is urgent, call us at " . $cfg['phone'] . ". You can also reply to this email.\n\nReliant Industries\nSterling Heights, Michigan\n";
    $html = '<p>Thank you for your request for quote.</p><p>We have received it and a member of the Reliant team will review it and get back to you.' . rf_esc($when) . '</p><p>Your reference: <b>' . rf_esc($ref) . '</b></p><p>If it is urgent, call us at ' . rf_esc($cfg['phone']) . '. You can also reply to this email.</p><p>Reliant Industries<br>Sterling Heights, Michigan</p>';
    $to = array_values(array_filter(array_map('trim', explode(',', (string) $cfg['confirm_reply_to']))));
    return rf_send($cfg, ['from' => $cfg['confirm_from'], 'from_name' => 'Reliant Industries', 'to' => [$vals['email']], 'reply_to' => $to ? $to[0] : '', 'reply_name' => 'Reliant Industries', 'subject' => 'We received your request for quote (' . $ref . ')', 'text' => $text, 'html' => $html, 'tag' => 'rfq-confirmation']);
}
function rf_link($cfg, $rel, $exp) {
    $f = $cfg['storage'] . '/files/' . $rel; $name = preg_replace('/^\d+-/', '', basename($rel));
    return ['name' => $name, 'size' => max(1, (int) round((is_file($f) ? filesize($f) : 0) / 1024)) . ' KB', 'url' => rf_public_base($cfg) . '/download.php?k=' . rf_b64u($rel) . '&e=' . $exp . '&s=' . rf_sign($cfg, $rel, $exp)];
}
function rf_build_email($cfg, $kind, $vals, $ref, $links) {
    $K = rf_kinds()[$kind]; $company = !empty($vals['company']) ? $vals['company'] : (!empty($vals['name']) ? $vals['name'] : trim((isset($vals['first_name']) ? $vals['first_name'] : '') . ' ' . (isset($vals['last_name']) ? $vals['last_name'] : '')));
    $rows = [];
    foreach ($K['order'] as $f) { $v = isset($vals[$f]) ? $vals[$f] : ''; if (is_array($v)) $v = implode(', ', $v); if ($v !== '') $rows[] = [str_replace('_', ' ', $f), $v]; }
    $text = "New " . strtolower($K['label']) . " from the website\nReference: $ref\nReceived: " . gmdate('c') . "\n\n";
    foreach ($rows as $r) $text .= $r[0] . ': ' . $r[1] . "\n";
    $html = '<h2>New ' . rf_esc(strtolower($K['label'])) . ' from the website</h2><p>Reference: <b>' . rf_esc($ref) . '</b></p><table cellpadding="6" style="border-collapse:collapse">';
    foreach ($rows as $r) $html .= '<tr><td style="color:#555;vertical-align:top">' . rf_esc($r[0]) . '</td><td style="white-space:pre-wrap">' . rf_esc($r[1]) . '</td></tr>';
    $html .= '</table>';
    if ($links) {
        $text .= "\nFiles (links expire in " . $cfg['link_days'] . " days):\n"; $html .= '<p>Files (links expire in ' . (int) $cfg['link_days'] . ' days):</p><ul>';
        foreach ($links as $l) { $text .= ' - ' . $l['name'] . ' (' . $l['size'] . ') ' . $l['url'] . "\n"; $html .= '<li><a href="' . rf_esc($l['url']) . '">' . rf_esc($l['name']) . '</a> (' . rf_esc($l['size']) . ')</li>'; }
        $html .= '</ul>';
    }
    $subject = mb_substr(preg_replace('/[\r\n]+/', ' ', '[Reliant website] ' . $K['label'] . ': ' . $company), 0, 150);
    return [$subject, $text, $html];
}
