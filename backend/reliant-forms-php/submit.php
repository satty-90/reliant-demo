<?php
/**
 * submit.php: receives the Reliant RFQ, Contact and Careers forms (assets/js/forms.js) and emails the team through Postmark (or Brevo).
 *
 *   POST multipart/form-data -> 200 {ok:true,id} | 422 {errors:{field:message}} | 429 (+Retry-After)
 *                               413 too large   | 400 bad request / bot check    | 502 email provider failed
 * Files are stored OUTSIDE the public web folder and reached only through signed, expiring links (download.php).
 * Only RFQs get a short fixed confirmation to the visitor (contact and careers send nothing). A copy of every lead is saved before emailing.
 */
require __DIR__ . '/forms-lib.php';
$cfg = rf_config();
$origin = rf_cors_origin($cfg);
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method === 'OPTIONS') { if ($origin === '') { http_response_code(403); exit; } http_response_code(204); rf_send_headers($origin); exit; }
if ($method !== 'POST') rf_reply(405, ['ok' => false, 'error' => 'method'], $origin, ['Allow' => 'POST, OPTIONS']);
if ($origin === '') { http_response_code(403); header('Content-Type: application/json'); echo json_encode(['ok' => false, 'error' => 'origin']); exit; }
if (stripos(isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '', 'multipart/form-data') !== 0) rf_reply(400, ['ok' => false, 'error' => 'bad_request'], $origin);
if (empty($_POST) && empty($_FILES) && (int) (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 0) > 0) rf_reply(413, ['ok' => false, 'error' => 'too_large'], $origin);

$kinds = rf_kinds();
$kind = isset($_POST['form_kind']) && is_string($_POST['form_kind']) ? $_POST['form_kind'] : '';
if (!isset($kinds[$kind])) rf_reply(400, ['ok' => false, 'error' => 'bad_request'], $origin);
$id = isset($_POST['submission_id']) && is_string($_POST['submission_id']) ? $_POST['submission_id'] : '';
if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) rf_reply(400, ['ok' => false, 'error' => 'bad_request'], $origin);
$ref = 'REL-' . strtoupper(substr(hash('sha256', $id), 0, 8));

if (rf_clean(isset($_POST['website']) && is_scalar($_POST['website']) ? $_POST['website'] : '') !== '') rf_reply(200, ['ok' => true, 'id' => $ref], $origin);   // spam trap: look successful, do nothing
$elapsed = isset($_POST['elapsed_ms']) && ctype_digit((string) $_POST['elapsed_ms']) ? (int) $_POST['elapsed_ms'] : 0;
if ($elapsed < 1500) rf_reply(400, ['ok' => false, 'error' => 'too_fast'], $origin);

$ip = rf_ip($cfg);
$wait = rf_rate_limited($cfg, $ip);
if ($wait) rf_reply(429, ['ok' => false, 'error' => 'rate_limited'], $origin, ['Retry-After' => (string) $wait]);
$idemFile = rf_dir($cfg, 'idem') . '/' . sha1($id) . '.json';
if (is_file($idemFile)) { $done = json_decode((string) file_get_contents($idemFile), true); if (is_array($done)) rf_reply(200, $done, $origin); }   // a retry of a send that already worked
$token = isset($_POST['cf-turnstile-response']) && is_string($_POST['cf-turnstile-response']) ? $_POST['cf-turnstile-response'] : '';
if (!rf_turnstile_ok($cfg, $token, $ip, $id)) rf_reply(400, ['ok' => false, 'error' => 'bot_check'], $origin);

list($vals, $errors) = rf_validate($kind, $_POST);
if (!$errors) {   // abuse limits that need a valid email, plus a site-wide ceiling (stops a spread-out attack)
    $w = rf_rate_limited($cfg, 'email:' . strtolower($vals['email']), $cfg['limit_email'], $cfg['limit_email_day']);
    if (!$w) $w = rf_rate_limited($cfg, 'all', $cfg['limit_all10'], $cfg['limit_all']);
    if ($w) rf_reply(429, ['ok' => false, 'error' => 'rate_limited'], $origin, ['Retry-After' => (string) $w]);
}
list($files, $fileError) = rf_check_files($kind);
if ($fileError !== '') $errors[$kinds[$kind]['files']['errkey']] = $fileError;
if ($errors) rf_reply(422, ['ok' => false, 'errors' => $errors], $origin);

/* store files privately, outside the public folder */
$ym = gmdate('Y-m'); $links = []; $stored = [];
$days = max(1, $cfg['link_days']); $exp = time() + $days * 86400;
foreach ($files as $i => $f) {
    $safe = substr(preg_replace('/^\.+/', '', preg_replace('/[^A-Za-z0-9._-]+/', '_', $f['name'])), -80); if ($safe === '' || $safe === false) $safe = 'file.' . $f['ext'];
    $rel = $kind . '/' . $ym . '/' . $ref . '/' . ($i + 1) . '-' . $safe;
    $dir = rf_dir($cfg, 'files/' . dirname($rel));
    if (!is_dir($dir) || !move_uploaded_file($f['tmp'], $cfg['storage'] . '/files/' . $rel)) { error_log('forms: could not store upload ' . $ref); rf_reply(500, ['ok' => false, 'error' => 'server'], $origin); }
    @chmod($cfg['storage'] . '/files/' . $rel, 0640);
    $stored[] = $rel;
    $links[] = ['name' => $safe, 'size' => max(1, (int) round($f['size'] / 1024)) . ' KB',
                'url' => rf_public_base($cfg) . '/download.php?k=' . rf_b64u($rel) . '&e=' . $exp . '&s=' . rf_sign($cfg, $rel, $exp)];
}
/* a durable copy of the lead BEFORE emailing, so nothing is lost if the email provider is down */
$subDir = rf_dir($cfg, 'submissions/' . $kind . '/' . $ym);
file_put_contents($subDir . '/' . $ref . '.json', json_encode(['ref' => $ref, 'kind' => $kind, 'received' => gmdate('c'), 'fields' => $vals, 'files' => $stored]), LOCK_EX);

$sentMark = $subDir . '/' . $ref . '.sent';
if (!rf_notify_team($cfg, $kind, $vals, $ref, $links)) { error_log('forms: email failed for ' . $ref . ' (saved; retry.php will resend)'); rf_reply(502, ['ok' => false, 'error' => 'mail'], $origin); }
@touch($sentMark);
if ($kind === 'rfq') { try { rf_confirm_rfq($cfg, $vals, $ref); } catch (\Throwable $e) { error_log('forms: confirmation failed ' . $ref); } }   // a failed confirmation never loses or fails the lead

$result = ['ok' => true, 'id' => $ref];
file_put_contents($idemFile, json_encode($result), LOCK_EX);
rf_reply(200, $result, $origin);
