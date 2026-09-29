# KGV Sorgenfrei – Website

Static website for the **Kleingärtnerverein Sorgenfrei Wanne-Eickel e.V.** (allotment garden club in Herne-Wanne, founded 1915). All visitor-facing content is in German; code, comments and docs are in English.

Built with [Eleventy (11ty) v3](https://www.11ty.dev/), Nunjucks templates, [Tailwind CSS v3](https://v3.tailwindcss.com/) and a small amount of vanilla JavaScript.

> **Before contributing, read [AGENTS.md](AGENTS.md).** It contains binding conventions for voice ("du", never "Sie"), gendering, content accuracy (all facts come from https://kgv-sorgenfrei.de), the tech stack, image/lightbox usage and deployment.

## Requirements

- Node.js **22** or newer (see `.nvmrc`; run `nvm use` if you use nvm)
- npm

## Getting started

```bash
npm install
npm run serve
```

The dev server runs at http://localhost:8080 with live reload. Changes to templates, data files, `src/assets/css/tailwind.css` and `tailwind.config.js` trigger a rebuild.

## npm scripts

| Script | Description |
| --- | --- |
| `npm run serve` | Build CSS once, then start the Eleventy dev server with live reload (development mode). |
| `npm run build` | Development build: compile Tailwind CSS and render the site into `_site/`. |
| `npm run build:prod` | Production build: minified CSS, minified HTML (`ELEVENTY_ENV=production`). Use this for deploys. |
| `npm run serve:prod` | Production build, then serve `_site/` statically on port 8080 to check the final output. |
| `npm run build:css` | Compile `src/assets/css/tailwind.css` → `src/assets/css/style.css`. |
| `npm run build:css:prod` | Same as above, minified. |
| `npm run watch:css` | Recompile CSS on every change (usually not needed, `serve` watches CSS itself). |
| `npm run clean` | Delete the `_site/` output directory. |

## Project structure

```
.
├── 11ty/                    # Eleventy extensions
│   ├── filters.js           # Nunjucks filters
│   ├── image.js             # {% image %} shortcode (@11ty/eleventy-img → WebP/JPEG <picture>)
│   └── transforms.js        # HTML minification in production
├── src/                     # Eleventy input directory
│   ├── _data/               # Global data: site.js (name, address, nav, contact),
│   │                        #   termine.js, vorstand.js, fachberatung.js, galerie.js
│   ├── _includes/
│   │   ├── layouts/         # base.njk (HTML shell, meta/OG tags), page.njk (inner pages)
│   │   └── partials/        # header.njk, footer.njk
│   ├── chronik/             # Club history articles
│   ├── assets/
│   │   ├── css/             # tailwind.css (source), style.css (generated, git-ignored)
│   │   ├── fonts/           # Self-hosted Inter & Fraunces variable fonts (.woff2)
│   │   ├── images/          # Source images (gallery/, chronik/, fachberatung/, …)
│   │   ├── videos/
│   │   ├── favicons/
│   │   └── js/main.js       # Mobile nav, hash-scroll fix, image/SVG lightbox
│   ├── *.njk                # Pages (index, ueber-uns, honig, termine, fachberatung, …)
│   ├── sitemap.njk          # Generates /sitemap.xml from collections.all
│   ├── robots.txt
│   ├── site.webmanifest
│   ├── .htaccess            # Basic Auth for the demo host (passthrough-copied)
│   └── .htpasswd
├── eleventy.config.js       # Passthrough copies, shortcodes, filters, directories
├── tailwind.config.js       # Theme (colors, fonts), content paths
├── AGENTS.md                # Conventions for contributors and AI agents
└── _site/                   # Build output (generated, git-ignored)
```

## Working with content

- **Pages** are Nunjucks files in `src/`; each one sets `layout`, `title` and `description` in its front matter; inner pages using `layouts/page.njk` can also set `eyebrow` and `lead`, and a page may add `permalink` or a JSON-LD `schema` object.
- **Recurring data** (events, board members, Fachberatung topics, gallery, contact details) lives in `src/_data/` – edit it there rather than in the templates.
- **Images:** put source files under `src/assets/images/` and embed them with the shortcode. `alt` is required:
  ```njk
  {% image "gallery/example.jpg", "Beschreibender Alt-Text", "rounded-lg" %}
  ```
  Optional arguments: `className`, `sizes` (default `100vw`), `widths` (default `[400, 800, 1200, 1600]`), `loading` (default `lazy`). SVGs are emitted as a plain `<img>`.
- **Lightbox:** content images and inline SVG diagrams should be click-to-enlarge – see the lightbox section in [AGENTS.md](AGENTS.md) for the required markup.
- **Styling:** Tailwind utility classes plus a few component classes (`.btn-primary`, `.prose-page`, …) in `src/assets/css/tailwind.css`. Don't add other CSS frameworks.

## SEO & accessibility

- Every page gets a `<title>`, meta description, canonical URL, Open Graph and Twitter card tags from `base.njk` (fallbacks from `src/_data/site.js`).
- Pages can provide structured data via a `schema` front-matter object, rendered as JSON-LD.
- `/sitemap.xml` is generated automatically; `robots.txt` points to it.
- `lang="de"`, a skip link to `#hauptinhalt`, semantic landmarks, and an accessible mobile nav toggle (`aria-expanded`).
- Responsive, lazy-loaded images in WebP with JPEG fallback; fonts are preloaded and self-hosted (no requests to Google).
- Static asset URLs for CSS/JS get a content-hash query string (`{% assetUrl %}`) for cache busting.
- Aim for WCAG AA contrast (≥ 4.5:1), especially for buttons inside `.prose-page` content.

## Deployment

The site is currently deployed manually to a password-protected demo host via rsync (no CI/CD):

```bash
npm run build:prod
rsync -avz --delete _site/ ssh-w0204bc9@w0204bc9.kasserver.com:/www/htdocs/w0204bc9/demo.laubencloud.de/
```

SSH access uses a key from the Bitwarden SSH agent. `--delete` mirrors `_site/` exactly, so anything on the server that isn't part of the build is removed. HTTP Basic Auth is configured through `src/.htaccess` / `src/.htpasswd`, which are copied into every build – see [AGENTS.md](AGENTS.md) for details.

## License

Private project, not licensed for reuse (`UNLICENSED`). Texts and photos belong to the Kleingärtnerverein Sorgenfrei Wanne-Eickel e.V.
