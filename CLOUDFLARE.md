# Cloudflare Deployment Notes

FicsitPrints is currently a static prototype, so the easiest Cloudflare path is Cloudflare Pages.

## Cloudflare Pages Setup

- Framework preset: None
- Build command: leave blank
- Build output directory: `.`
- Production branch: `main`
- Root directory: repository root

## Manual Deploy

After installing dependencies:

```bash
npm install
npm run deploy:cloudflare
```

## Later Backend Plan

- Store blueprint metadata in Cloudflare D1.
- Store `.sbp` and `.sbpcfg` files in Cloudflare R2.
- Move upload and download logic from browser `localStorage` into Worker API routes.
- Add authentication before public uploads.
