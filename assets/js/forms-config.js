/*
 * Form delivery settings. Edit THIS file when the real form backend is ready; nothing else needs to change.
 *
 *  endpoint          Where the forms are sent (HTTPS URL of your form service / serverless function).
 *                    Leave empty ('') for PREVIEW MODE: the forms behave fully (validation, sending state,
 *                    success screen) but nothing is actually sent, and the visitor is told so.
 *  turnstileSiteKey  Cloudflare Turnstile PUBLIC site key (bot check). Leave empty to switch it off.
 *                    (The matching SECRET key lives only on the server and must never be put in this repo.)
 *
 * Preview helpers for reviewers (preview mode only):  ?simulate=error  ?simulate=ratelimit  ?simulate=invalid
 */
window.RELIANT_FORMS = {
    endpoint: '',
    turnstileSiteKey: '',
    phone: '586-275-0479'
};
