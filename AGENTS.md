# Agent instructions for this repository

This file collects standing conventions for any AI agent (or human) working on the KGV Sorgenfrei website. Follow these unless a human explicitly asks for an exception.

## Voice & tone

- **Always address site visitors informally ("du"), never formally ("Sie").** This applies to every page, including legal pages (Impressum, Datenschutz). Do not introduce "Sie", "Ihre", "Ihnen", or formal imperative forms ("Besuchen Sie …") anywhere in visitor-facing copy.
  - Exception: grammatically correct third-person plural "sie"/"Sie" (referring back to a plural noun, e.g. "die Kinder … Sie zeigten …") is fine — that's not a form of address, don't "fix" it.
- All visible page content is in German. Code comments, commit messages, and this file are in English.
- **Gendering: spell out both forms in full, don't use colon/asterisk/Binnen-I shorthand.** Write "Kleingärtnerinnen und Kleingärtner", not "Kleingärtner:innen", "Kleingärtner*innen", or "KleingärtnerInnen". Apply this to every gendered role noun (Helferinnen und Helfer, Besucherinnen und Besucher, Vertreterinnen und Vertreter, etc.), and get the grammatical case right on both halves (e.g. dative "bei den Imkerinnen und Imkern", not "bei den Imker:innen").

## Content accuracy

- This site's copy (history, board members, honey, Sanssouci project garden, solar system, events, Fachberatung topics, address, contact details) must come from the real club website, https://kgv-sorgenfrei.de, and its subpages — never invent or guess facts, numbers, or names.
- Photos in `src/assets/images/gallery/` were sourced from kgv-sorgenfrei.de. Downloading further media (photos, documents, etc.) from kgv-sorgenfrei.de does not require the user's approval — it's the club's own site and the user has standing permission to pull assets from it.
- Legal pages (`impressum.njk`, `datenschutz.njk`) reuse real legal text from the club's site, adapted only where the technical facts differ (e.g. this site self-hosts fonts, so it truthfully states no runtime connection to Google — don't revert that unless the underlying implementation changes).

## Tech stack constraints

- Static site generator: **Eleventy (11ty) v3**, templates in Nunjucks (`.njk`).
- Styling: **Tailwind CSS v3** only. Do not add Bootstrap or any other CSS framework.
- JavaScript: **vanilla JS only** (`src/assets/js/main.js`). Do not add jQuery or a JS framework for the small amount of interactivity here (mobile nav toggle, image lightbox).
- Fonts (Inter, Fraunces) are self-hosted as variable `.woff2` files under `src/assets/fonts/` and loaded via `@font-face` in `src/assets/css/tailwind.css`. Do not switch back to loading fonts from `fonts.googleapis.com` — this was a deliberate privacy/performance decision and is reflected in the Datenschutz page's "Google Fonts (lokales Hosting)" claim.
- Images go through the `{% image %}` shortcode (`11ty/image.js`, backed by `@11ty/eleventy-img`), which requires a non-empty `alt` argument and emits responsive WebP/JPEG `<picture>` markup. Use it for any new content image instead of a raw `<img>` tag.
- **Use the click-to-enlarge lightbox wherever it makes sense** (galleries, standalone content photos, image grids, inline SVG diagrams/schematics) — not just on pages that already have it. Implementation lives in `src/assets/js/main.js` ("Lightbox for gallery images and inline SVG diagrams/schematics"). Skip it only for purely decorative images/icons or tiny thumbnails where enlarging adds no value.
  - **Raster images** (via `{% image %}`): wrap in `<button type="button" class="group block overflow-hidden rounded-*" data-lightbox-trigger>` and add `cursor-zoom-in ... transition-transform duration-300 group-hover:scale-105` to the `{% image %}` class argument (see `src/ueber-uns.njk` Galerie section or `src/projektgarten-sanssouci.njk`).
  - **Inline `<svg>` diagrams** (e.g. `src/heckenschnitt.njk`, `src/kompostieren.njk`): wrap the `<svg>` itself in `<button type="button" data-lightbox-trigger class="block w-full cursor-zoom-in" aria-label="Schema vergrößern">`. The lightbox clones the SVG (rewriting any `id`s and their `url(#...)`/`href="#..."` references so markers/patterns/gradients don't collide with the original), and uses the SVG's `<title>` as the caption unless a `data-caption` attribute is set on the trigger.

## Colors

The palette is defined in `tailwind.config.js` (`leaf`, `moss`, `sun`, `poppy`, `coal`). Use these tokens, never raw hex values or Tailwind's default `yellow`/`amber`/`green` scales.

- **Yellow (`sun`) — one accent tone only:** any yellow *text* (eyebrows, highlighted words like „Glück auf!“ / „Gut Grün!“, links on dark backgrounds, footer link hover) is `text-sun-400` (`#fecc00`, the logo yellow). Don't use `sun-200`/`sun-300` for text — they were unified on purpose. For link hover on dark backgrounds, keep the color and change the underline instead (`decoration-sun-500/50 hover:decoration-sun-400`).
- **Yellow backgrounds:** buttons and solid bands use `bg-sun-400` (`.btn-primary` hovers to `bg-sun-300`). Light highlight/tip boxes and info tiles all use `bg-sun-50 ring-1 ring-sun-200` with dark (`coal`) text — not `bg-sun-100`.
- **Green (`leaf`):** headings `text-leaf-800`, links `text-leaf-700 hover:text-leaf-800`, page header band `bg-leaf-800`, light section backgrounds `bg-leaf-50`, dividers `divide-leaf-200` / `border-leaf-200`.
- **Neutral (`coal`):** body text `text-coal-700`, secondary text `text-coal-600`/`-500`, dark sections `bg-coal-900` with `text-coal-300` copy.
- **Red (`poppy`):** sparingly, for warnings/alerts only.

## Styling gotcha (already fixed once — don't reintroduce)

`.prose-page a` (the default styling for links inside inner-page body copy) previously overrode `.btn-primary` / `.btn-secondary` / `.btn-outline` button text color and added an unwanted underline, because the descendant selector `.prose-page a` is more specific than a single button class. This made buttons on inner pages (e.g. Honig, Über uns) nearly unreadable (dark-on-dark).

Fix in place: `.prose-page a:not([class*="btn"])` in `src/assets/css/tailwind.css`. If you add new link/button styling, keep this exclusion intact, and when adding a button-like link inside prose content, double-check its rendered contrast (aim for WCAG AA, ≥ 4.5:1) rather than assuming the component class wins.

## Deployment

- The site is deployed to a demo/staging host via SSH+rsync — there is no CI/CD pipeline, deploys are manual.
- **Target:** host `w0204bc9.kasserver.com`, SSH login `ssh-w0204bc9`, remote path `/www/htdocs/w0204bc9/demo.laubencloud.de/`.
- **Auth:** SSH key access only (no password), provided via the user's Bitwarden SSH agent (`SSH_AUTH_SOCK=/home/dennis/.bitwarden-ssh-agent.sock`) — just `ssh`/`rsync` normally, no key setup needed as long as that agent is running and the key is released in Bitwarden.
- **Deploy command:**
  ```
  npm run build:prod
  rsync -avz --delete _site/ ssh-w0204bc9@w0204bc9.kasserver.com:/www/htdocs/w0204bc9/demo.laubencloud.de/
  ```
  `--delete` keeps the remote directory in sync with `_site/` exactly — don't drop it without checking what's currently live first (it will remove anything on the server that isn't part of the build output).
- **Basic Auth (demo site is password-gated):** the demo host is protected with HTTP Basic Auth via `.htaccess`/`.htpasswd`. Login: `sorgen` / `frei`. These files live in `src/.htaccess` and `src/.htpasswd` (passthrough-copied to the build output via `eleventy.config.js`), so they survive every deploy automatically — don't remove the passthrough entries or the site goes public unprotected. The password hash is APR1-MD5 (generated with `openssl passwd -apr1`); regenerate it the same way if the password ever changes.

## Structure reference

See [README.md](README.md) for the full folder layout, npm scripts (`build`, `build:prod`, `serve`, `serve:prod`), and SEO/accessibility notes.
