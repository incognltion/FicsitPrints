# Cloudflare Deployment Notes

FicsitPrints deploys as a Cloudflare Worker with static assets, a D1 database, and an R2 bucket.

## Cloudflare Worker Setup

- Worker entry: `worker.js`
- Static assets directory: `.`
- D1 binding: `DB`
- R2 binding: `BLUEPRINT_FILES`

## Storage Setup

Create the production database and bucket:

```bash
npx wrangler d1 create ficsitprints
npx wrangler r2 bucket create ficsitprints-blueprints
```

Copy the D1 database id into `wrangler.toml`, then run:

```bash
npx wrangler d1 migrations apply ficsitprints
```

The migration creates columns for descriptions, tags, preview images, blueprint file names, and R2 object keys.

## Manual Deploy

After installing dependencies:

```bash
npm install
npm run deploy:cloudflare
```

## Backend Plan

- Blueprint metadata is stored in Cloudflare D1.
- `.sbp` and `.sbpcfg` files are stored in Cloudflare R2.
- Upload and download routes live in `worker.js`.
- Add authentication before public uploads.
