# djziza.com

Static site for DJ Ziza. Plain HTML, CSS and JS, no build step. Hosted on AWS Amplify from this repo.

## Pages
- `index.html`: home (welcome, mixes, about, packages, booking form)
- `creative-brief.html`: creative brief form + PDF download
- `404.html`: not-found page
- `events.html`, `services.html`, `CREATIVE_BRIEF.html`: redirects so old links keep working

## Files
- `assets/css/site.css`: all styles; brand colors are CSS variables at the top
- `assets/js/site.js`: menu, mixes, forms. Settings are at the very top of the file.
- `assets/img/`, `assets/docs/`: images, logos, the printable brief
- `amplify.yml`: Amplify build settings (static, no build)
- `customHttp.yml`: security headers + caching (see "Security" below)
- `site.webmanifest`, favicons, `robots.txt`, `sitemap.xml`

## Deploy
1. Push this folder's contents to the repo root (`main` branch). Amplify deploys automatically.
2. Amplify > Hosting > Rewrites and redirects: source `/<*>`, target `/404.html`, type `404 (Rewrite)`.
3. Amplify > Hosting > Custom domains: add djziza.com and set `www` as the main address
   (the site's canonical URL is https://www.djziza.com/; Amplify redirects the bare domain to it).

## Everyday updates
- **New mix:** just upload to Mixcloud. The site lists the 13 newest automatically.
  If Mixcloud is ever unreachable, the site shows the backup list in `FALLBACK_MIXES` (top of `site.js`).
- **Forms:** set `FORM_ENDPOINT` at the top of `site.js` to the forms Function URL (see GO-LIVE.md, part 3).
  While it's empty, forms open the visitor's email app instead.
- **After editing CSS or JS:** change the `?v=20261002` on the `site.css` / `site.js` links in all three pages
  (index, creative-brief, 404) to today's date, so returning visitors get the new version.
- **Packages:** edit the table in `index.html` (`#packages`). For VIP, add a third column and remove the "coming soon" note.

## Security
`customHttp.yml` sets a Content-Security-Policy that only allows this site, Google Fonts, Mixcloud and
AWS Lambda Function URLs (`*.on.aws`). If you embed something new (YouTube, Instagram, a booking widget),
add its domain to the policy or the browser will block it.
