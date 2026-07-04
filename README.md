# FicsitPrints

A local prototype for a Satisfactory blueprint catalogue.

Current features:

- Browse uploaded blueprints
- Upload `.sbp` and `.sbpcfg` files
- Rename a blueprint before publishing
- Save local test uploads in the browser
- Click uploaded blueprints to download them

Later Cloudflare version:

- Cloudflare Workers for the app and API
- D1 for blueprint metadata
- R2 for blueprint files

## Local Preview

```bash
node server.js
```

Then open `http://127.0.0.1:4173`.

## GitHub Pages

This prototype can run directly from GitHub Pages because it is static HTML, CSS, and JavaScript.

## Cloudflare

See `CLOUDFLARE.md` for the Cloudflare Pages handoff checklist.
