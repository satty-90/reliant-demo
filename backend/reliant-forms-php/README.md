# Reliant forms endpoint (PHP + Postmark)

Receives the redesigned site's three forms (RFQ, Contact, Careers), checks them, stores uploads privately and emails the team
through Postmark's HTTPS API (no SMTP, works on GoDaddy shared hosting). Brevo is still supported as a fallback (`EMAIL_PROVIDER=brevo`).
Speaks exactly the format `assets/js/forms.js` expects.

## What gets emailed
| Form | Team email goes to | From | Visitor gets |
|---|---|---|---|
| RFQ | `FORMS_MAIL_TO_RFQ` (leads@) | Reliant Website <website@notify.reliantindustries.com> | a short fixed confirmation from "Reliant Industries <quotes@notify...>", Reply-To leads@ |
| Contact | `FORMS_MAIL_TO_CONTACT` (sales@/info@) | same | nothing |
| Careers | `FORMS_MAIL_TO_CAREERS` (hiring address) | same | nothing |

Team emails have Reply-To = the visitor, so "Reply" answers them. The confirmation repeats nothing the visitor typed (only the reference and our phone number),
and if it fails the lead is still delivered. Set `RFQ_CONFIRMATION=0` to switch it off.

## Setup
1. **Postmark** (account in Reliant's name): create a Server, add the Sender Signature/Domain `notify.reliantindustries.com`, add the DKIM + Return-Path
   DNS records Postmark shows (DNS at GoDaddy; additive records only, the Microsoft 365 records stay untouched), wait for the green ticks, copy the Server API token.
2. Copy `submit.php`, `download.php`, `forms-lib.php`, `retry.php`, `.user.ini`, `.htaccess` into a folder on the site (e.g. `public_html/forms/`).
3. Copy `.env.example` to a file **outside public_html** and fill it in, then load it (GoDaddy cPanel: "Setup PHP/Select PHP Version → Options", or a `SetEnv` block in `.htaccess` kept out of git).
   Never commit the real token. Rotating it = change it in Postmark and in this file.
4. Storage: `FORMS_STORAGE_DIR` must be outside `public_html` and writable by PHP (default `<home>/storage/reliant-forms`).
5. PHP limits: `.user.ini` asks for 25 MB per file / 64 MB per request. Check with a phpinfo page that it took; otherwise set them in cPanel "MultiPHP INI Editor".
6. **Cron** (cPanel → Cron Jobs, every 10 minutes): `/usr/local/bin/php /home/USER/public_html/forms/retry.php`. It resends any lead that was saved but not emailed (provider outage). Optional but recommended.
7. **Cron, daily** (retention): `/usr/local/bin/php /home/USER/public_html/forms/purge.php`. Deletes uploads after 180 days and lead records after 730 days (change in `.env`; test with `php purge.php --dry`). **Reliant must confirm the retention periods.**
8. On the website set `endpoint` in `assets/js/forms-config.js` to `https://www.reliantindustries.com/forms/submit.php` and add the live origin(s) to `FORMS_ALLOWED_ORIGINS`.
9. Send a test of each form, check the Postmark "Activity" tab (delivered, opened) and that the team emails arrive in the inbox, not spam.

## Go live in two stages (no DNS needed for stage 1)
**Stage 1: dry-run.** Set `EMAIL_PROVIDER=log` in the `.env`. The whole flow works on the real server (validation, uploads, signed links, rate limits,
saved leads) but nothing is emailed: each email is written as a file in `<FORMS_STORAGE_DIR>/outbox/`, so you can open it and see exactly what the team and the visitor would receive.
Open `forms/healthcheck.php?key=<HEALTHCHECK_KEY>` to see a pass/fail list of the server setup.
**Stage 2: live.** When Postmark shows green ticks for `notify.reliantindustries.com`: put the Server token in `POSTMARK_TOKEN`, set `EMAIL_PROVIDER=postmark`,
open `healthcheck.php?key=...&live=1` (it asks Postmark whether the token works), then submit one real RFQ, contact message and application.
Leads submitted during the dry-run are saved but not emailed; check `outbox/` and `submissions/` if you need them.

## Behaviour worth knowing
- A copy of every lead is saved (`submissions/…json`) **before** emailing; a `.sent` marker is written once the team email is accepted.
- If Postmark is down the visitor sees the site's error message with the phone number, the lead is kept and `retry.php` sends it later.
- Limits: per IP 5 per 10 min / 30 a day, per email address 3 per 10 min / 10 a day, whole site 40 per 10 min / 300 a day (all adjustable in `.env`).
- Virus scan: runs only if ClamAV exists on the host (`CLAMSCAN_PATH`). Shared hosting usually has none; then the protection is the content check, private storage, download-only signed links and no execution of uploads. A scanner error never blocks a customer.
- Logs never contain form contents or visitor email addresses (provider error text is masked and shortened).
- Same `submission_id` twice = one email (idempotent). Rate limit 5 per 10 min / 30 per day per IP; submissions faster than 1.5 s and filled honeypots are dropped.
- Uploads are content-checked (PDF, STEP, DWG, DXF, DOC, DOCX), stored privately, and reached only by signed links that expire after 7 days.
- Postmark's `Tag` is `team-rfq`, `team-contact`, `team-careers`, `rfq-confirmation`, handy for filtering in the Postmark Activity tab.

## Tests
`test/run_all.sh` starts a fake Postmark/Brevo and PHP servers and runs 80 checks (access control, validation, injection, bot checks, hostile files,
RFQ confirmation, per-email and site-wide limits, virus-scan hook, log hygiene, retention purge, provider outage, retry job). `test/run_all.sh integration` runs the real site forms in a browser against it (needs the site folder).
