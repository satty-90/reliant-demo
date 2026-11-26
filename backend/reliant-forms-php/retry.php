<?php
/**
 * retry.php: run from cron (CLI only) to resend team emails for leads that were saved but never delivered
 * (provider outage). Safe to run often: a lead is skipped once its .sent marker exists.
  *   cron every 10 minutes: see README * * * * /usr/local/bin/php /home/USER/reliant-forms/retry.php
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/forms-lib.php';
$cfg = rf_config(); $n = 0; $left = 0;
foreach (glob($cfg['storage'] . '/submissions/*/*/*.json') ?: [] as $f) {
    $mark = substr($f, 0, -5) . '.sent';
    if (is_file($mark) || filemtime($f) > time() - 120 || filemtime($f) < time() - 14 * 86400) continue;   // wait 2 min (the live request may still be running); give up after 14 days
    $d = json_decode((string) file_get_contents($f), true);
    if (!is_array($d) || !isset($d['kind'], $d['ref'], $d['fields'])) continue;
    $exp = time() + max(1, $cfg['link_days']) * 86400;
    $links = array_map(function ($rel) use ($cfg, $exp) { return rf_link($cfg, $rel, $exp); }, isset($d['files']) ? $d['files'] : []);
    if (rf_notify_team($cfg, $d['kind'], $d['fields'], $d['ref'], $links)) { touch($mark); $n++; echo "resent {$d['ref']}\n"; } else { $left++; }
}
echo "done: $n resent, $left still failing\n";
