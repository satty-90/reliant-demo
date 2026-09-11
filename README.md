# Reliant Industries — Website Demo

Static HTML/CSS/JS export of the Reliant Industries website draft, built for client review via GitHub Pages.

## Structure
- `index.html` — homepage
- `pages/` — About, Capabilities, Industries, Quality, Contact
- `assets/` — images, videos, css, js

## Hosting on GitHub Pages
1. Push this folder to a GitHub repo.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save — the site will publish at `https://<username>.github.io/<repo-name>/`.

## Notes
- This is a static export: the RFQ form (homepage) and Contact form both had PHP handlers (`rfq-handler.php`, `contact-handler.php`) that don't run on static hosting. Both forms are still visible and styled, but submitting shows a "demo site" message instead of sending anywhere. Wire them up to a form service (e.g. Formspree) or a real backend before this goes live for real.
- `equipment.php`, `rfq.php`, and `services.php` were empty stub files in the source project (not yet built) and aren't included here. Nothing in the site links to them.
- Tailwind is loaded via CDN and Google Fonts is loaded externally — both need an internet connection to render correctly (this is already how the PHP version worked).
