<?php
/**
 * purge.php: run daily from cron (CLI only). Deletes stored uploads after FORMS_KEEP_FILES_DAYS (default 180) and saved lead
 * records after FORMS_KEEP_LEADS_DAYS (default 730), plus stale rate-limit and duplicate-check files.
 *   Dry run: php purge.php --dry
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/forms-lib.php';
$cfg = rf_config(); $dry = in_array('--dry', $argv, true); $n = ['files' => 0, 'leads' => 0, 'misc' => 0];
$root = $cfg['storage'];
$sweep = function ($dir, $days, $key) use (&$sweep, $dry, &$n) {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) ?: [] as $e) {
        if ($e === '.' || $e === '..') continue; $p = $dir . '/' . $e;
        if (is_dir($p)) { $sweep($p, $days, $key); if (!$dry && !array_diff(scandir($p) ?: [], ['.', '..'])) @rmdir($p); continue; }
        if (filemtime($p) < time() - $days * 86400) { if (!$dry) @unlink($p); $n[$key]++; }
    }
};
$sweep($root . '/files', max(1, $cfg['keep_days_files']), 'files');
$sweep($root . '/submissions', max(1, $cfg['keep_days_leads']), 'leads');
$sweep($root . '/idem', 2, 'misc');
$sweep($root . '/ratelimit', 2, 'misc');
echo ($dry ? 'would delete' : 'deleted') . ": {$n['files']} uploaded files, {$n['leads']} lead records, {$n['misc']} temporary files\n";
