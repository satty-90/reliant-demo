<?php
/**
 * healthcheck.php: one page that tells you whether the forms are set up correctly. Open it after uploading:
 *   https://www.reliantindustries.com/forms/healthcheck.php?key=<HEALTHCHECK_KEY>          (settings only)
 *   https://www.reliantindustries.com/forms/healthcheck.php?key=<HEALTHCHECK_KEY>&live=1   (also asks Postmark whether the token works)
 * It never prints a token, a secret or a visitor's details. Delete it (or unset HEALTHCHECK_KEY) once you are live if you prefer.
 */
require __DIR__ . '/forms-lib.php';
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
$cfg = rf_config();
$key = (string) rf_env('HEALTHCHECK_KEY', '');
$given = isset($_GET['key']) && is_string($_GET['key']) ? $_GET['key'] : '';
if ($key === '' || !hash_equals($key, $given)) { http_response_code(404); echo json_encode(['ok' => false]); exit; }

$checks = []; $add = function ($name, $ok, $note = '') use (&$checks) { $checks[] = ['check' => $name, 'ok' => (bool) $ok, 'note' => $note]; };
$add('PHP 7.4 or newer', version_compare(PHP_VERSION, '7.4', '>='), PHP_VERSION);
$add('curl extension (needed to reach Postmark)', function_exists('curl_init'));
$add('mbstring extension', function_exists('mb_substr'));
$ul = ini_get('upload_max_filesize'); $pm = ini_get('post_max_size');
$toMb = function ($v) { $n = (float) $v; $u = strtoupper(substr(trim($v), -1)); return $u === 'G' ? $n * 1024 : ($u === 'K' ? $n / 1024 : ($u === 'M' ? $n : $n / 1048576)); };
$add('Upload limit is at least 25 MB per file', $toMb($ul) >= 25, 'upload_max_filesize=' . $ul);
$add('Request limit is at least 64 MB', $toMb($pm) >= 64, 'post_max_size=' . $pm);
$st = $cfg['storage'];
$inWeb = strpos(realpath($st) ?: $st, (string) realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: "\0") === 0;
@mkdir($st, 0700, true);
$add('Storage folder exists and is writable', is_dir($st) && is_writable($st), $st);
$add('Storage folder is OUTSIDE the public web folder', !$inWeb, $inWeb ? 'move FORMS_STORAGE_DIR out of public_html' : '');
$add('Email mode', true, $cfg['provider'] === 'log' ? 'DRY-RUN (log): nothing is emailed. Set EMAIL_PROVIDER=postmark to go live.' : $cfg['provider']);
if ($cfg['provider'] === 'postmark') $add('Postmark token is set', $cfg['postmark_token'] !== '');
$add('Sender address (MAIL_FROM) is set', $cfg['from'] !== '', $cfg['from']);
foreach (['rfq', 'contact', 'careers'] as $k) { $n = count(array_filter(array_map('trim', explode(',', (string) $cfg['to'][$k])))); $add("Recipient for $k form", $n > 0, $n . ' address(es)'); }
$add('Allowed website origins are set', count($cfg['origins']) > 0, implode(', ', $cfg['origins']));
$add('Public forms URL is set (for file links)', $cfg['public_url'] !== '', $cfg['public_url']);
$add('Link secret is set (not the fallback)', rf_env('FORMS_LINK_SECRET', '') !== '');
$add('Bot check (Turnstile) secret', true, $cfg['turnstile'] !== '' ? 'on' : 'off (optional; on is recommended)');
if (!empty($_GET['live']) && $cfg['provider'] === 'postmark' && $cfg['postmark_token'] !== '') {
    $ch = curl_init('https://api.postmarkapp.com/server');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => ['accept: application/json', 'X-Postmark-Server-Token: ' . $cfg['postmark_token']]]);
    $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch); $j = json_decode((string) $res, true);
    $add('Postmark accepts the token', $code === 200, $code === 200 && is_array($j) && isset($j['Name']) ? 'server: ' . $j['Name'] : 'HTTP ' . $code);
}
$bad = count(array_filter($checks, function ($c) { return !$c['ok']; }));
echo json_encode(['ok' => $bad === 0, 'problems' => $bad, 'checks' => $checks], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
