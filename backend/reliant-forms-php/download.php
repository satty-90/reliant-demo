<?php
/** download.php: serves an uploaded file only through a valid, unexpired signed link. */
require __DIR__ . '/forms-lib.php';
$cfg = rf_config();
function rf_deny() { http_response_code(403); header('Content-Type: text/plain'); echo 'Link expired or invalid'; exit; }
$key = rf_unb64u(isset($_GET['k']) && is_string($_GET['k']) ? $_GET['k'] : '');
$exp = isset($_GET['e']) && ctype_digit((string) $_GET['e']) ? (int) $_GET['e'] : 0;
$sig = isset($_GET['s']) && is_string($_GET['s']) ? $_GET['s'] : '';
if ($key === false || $key === '' || $exp < time() || !preg_match('#^(rfq|contact|careers)/[0-9]{4}-[0-9]{2}/REL-[0-9A-F]{8}/[0-9]+-[A-Za-z0-9._-]+$#', $key) || strpos($key, '..') !== false) rf_deny();
if (!hash_equals(rf_sign($cfg, $key, $exp), $sig)) rf_deny();
$path = $cfg['storage'] . '/files/' . $key;
if (!is_file($path)) { http_response_code(404); header('Content-Type: text/plain'); echo 'Not found'; exit; }
$name = preg_replace('/^\d+-/', '', basename($key));
header('Content-Type: application/octet-stream'); header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . filesize($path)); header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store'); header("Content-Security-Policy: default-src 'none'");
readfile($path);
