# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BuildBot: a SaaS widget that lets PC-parts e-commerce stores embed an AI-style "recommend me a PC build"
tool for their customers. Stores connect either a custom product catalog or a WooCommerce store (via the
bundled WordPress plugin), and the widget suggests Budget/Balanced/Max builds from that store's own
inventory and prices.

Three independent parts, no root `package.json` — always `cd` into `client/` or `server/` first:

- **`client/`** — React 19 + Vite SPA. Marketing site, store dashboard, and admin panel in one app.
- **`server/`** — Express API (ESM, `"type": "module"`) + Turso/libSQL database. Deployed to Railway.
- **`plugin/buildbot-woocommerce/`** — WordPress/WooCommerce plugin (PHP) that syncs a store's products
  to the BuildBot API and injects the widget via `wp_footer`. Not a Node project; edited directly as PHP.

## Commands

Run from `client/`:
- `npm run dev` — Vite dev server (localhost:5173)
- `npm run build` — production build
- `npm run lint` — Oxlint (`.oxlintrc.json`; react + oxc plugins, rules-of-hooks enforced)

Run from `server/`:
- `npm run dev` — API with `node --watch` (localhost:3001)
- `npm run start` — production start
- `npm run build-plugin` — zips `plugin/buildbot-woocommerce/` into `server/public/buildbot-woocommerce.zip`
  and writes `server/public/plugin-update.json`, patching `BUILDBOT_API_BASE` in the PHP file to
  `PUBLIC_API_URL`/`APP_URL`. Run this after changing anything under `plugin/` so the downloadable
  plugin and the in-app update feed stay in sync.

There is no unit test runner (no Jest/Vitest configured). Testing is done via live HTTP smoke/regression
scripts that hit a running server and exercise real signup/login/recommend flows end-to-end:
- `node server/scripts/regression-p0-p10.js` — full regression across earlier phases; defaults to hitting
  the deployed Railway URL (`API_URL` env var overrides it).
- `node server/scripts/phase11-smoke.js` — plugin-API smoke test, hardcoded to `http://127.0.0.1:3001`
  (start `npm run dev` in `server/` first).

Local dev database: set `TURSO_URL=file:local.db` in `server/.env` for a local SQLite file instead of a
Turso cloud DB (see `server/.env.example`).

## Architecture

### Server (`server/`)

- `index.js` — app entrypoint. Boots DB, mounts routers under `/api`, serves static widget assets
  (`/widget.js`, `/widget.css`, `/widget-test`) and the plugin zip/update feed, starts cron.
- `database.js` — single libSQL client (`getDb()`), schema creation (`CREATE TABLE IF NOT EXISTS`),
  ad-hoc column migrations in `migrateStores()` (no migration framework — new columns are added via
  try/catch `ALTER TABLE`), and platform_config/admin seeding on boot.
- `routes/*.js` — one router per domain (`auth`, `store`, `products`, `recommend`, `billing`, `admin`,
  `adminAdvanced`, `plugin`), all mounted at `/api` in `index.js`. Two parallel identity systems:
  **stores** (dashboard users, `authStore`/store JWT) and **admins** (platform operators,
  `authAdmin`/admin JWT) — see `lib/auth.js`.
- `lib/pluginAuth.js` — separate auth scheme (`authPlugin`) for the WooCommerce plugin: shop-issued
  `X-BuildBot-Store-ID` + `X-BuildBot-Secret` headers, not JWT. Used only by `routes/plugin.js`.
- `lib/storePlan.js` — single source of truth for plan/trial state (`widgetPauseReason`, `planLimit`,
  `isTrialExpired`, etc.); both `routes/recommend.js` (gating widget requests) and the client dashboard
  logic mirror this.
- **CORS is split in `index.js`**: widget-facing endpoints (`/api/recommend`, `/api/store-config/*`,
  `/api/widget-ping/*`) are called from arbitrary shop domains and go through open CORS; everything else
  is restricted to `APP_URL`/`EXTRA_ORIGINS`. The `smartCors` middleware picks one or the other per
  request — don't merge them.
- `routes/recommend.js` — recommendations are AI-generated via the official `@anthropic-ai/sdk`
  (`output_config.format` structured outputs, guaranteeing valid JSON matching `BUILD_SCHEMA`) when
  `ANTHROPIC_API_KEY` is set, with a **rule-based heuristic fallback** (`pickProducts`, buckets a store's
  in-stock products by category and picks cheapest/median/most-expensive per category) used whenever no
  key is configured or the Anthropic call fails for any reason — so the widget always returns a build.
  Model/max_tokens are admin-configurable (`platform_config.anthropic_model`/`max_tokens`, edited via
  `AdminApiModel.jsx`); per-model USD pricing for the cost/profit dashboard lives in
  `MODEL_PRICING_PER_TOKEN`. Requests are cached per `(storeId, budget, purpose, extras)` for 24h and
  metered against the store's plan limit (`planLimit`/`countUsage`).
- `cron.js` / `email.js` — drip/reminder emails (trial ending, plan expiring) gated by
  `trial_emails_sent` dedup table; only runs when `CRON_ENABLED=true`.
- `scripts/build-plugin.js` — hand-rolled ZIP writer (no archiver dependency) that patches and packages
  the WordPress plugin; falls back to PowerShell `Compress-Archive` if the pure-JS zip fails.

### Client (`client/`)

- Plain React Router SPA (`src/App.jsx`), no framework/meta-framework. Three route groups sharing one
  app shell: public marketing (`landing/`), the authenticated store dashboard (`dashboard/`, gated by
  `ProtectedRoute` + `AuthContext`), and a separately-authenticated admin panel (`admin/`, its own
  `AdminAuthContext`/`bb_admin_token` in localStorage, parallel to the store's `bb_token`).
- `lib/api.js` — the only place fetches happen. Wraps `fetch` with JSON handling, bearer token injection,
  and a global in-flight-request counter (`subscribeLoading`) that drives `components/GlobalLoading.jsx`.
  Always route new API calls through `api()`/`apiUpload()` rather than calling `fetch` directly.
  `VITE_API_URL` picks the backend (defaults to `http://127.0.0.1:3001`).
- `context/AuthContext.jsx` — store session; token in `localStorage['bb_token']`, hydrated via
  `GET /api/me`. `context/AdminAuthContext.jsx` is the admin-side equivalent — these are intentionally
  separate contexts/tokens, not a shared "user" abstraction.
- `lib/catalogMode.js` — persists whether a store manages products manually ("custom") or via WooCommerce
  sync ("woo") in localStorage; several dashboard tabs (`ProductsTab`, `StoreSyncTab`) branch on this.
- `dashboard/ui/` — small shared presentational primitives (Card, Badge, StatCard, Skeleton, etc.) used
  across dashboard tabs; prefer reusing these over new ad hoc styles.
- Deployed to Vercel as a static SPA — `vercel.json` rewrites everything to `/index.html`.

### Plugin (`plugin/buildbot-woocommerce/`)

Standalone WooCommerce plugin. Hooks WooCommerce product save/delete events to push catalog changes to
the BuildBot API using the `X-BuildBot-Store-ID`/`X-BuildBot-Secret` scheme, and injects the widget
script into `wp_footer`. `BUILDBOT_API_BASE` is a compile-time constant patched by
`server/scripts/build-plugin.js` at zip time — don't hardcode a different API base by hand.

## Conventions

- Server responses are `{ success: boolean, ... }` (or `{ ok: boolean, ... }` for the health check);
  errors are `{ success: false, error: string }` with an appropriate HTTP status — follow this shape for
  new endpoints so `client/src/lib/api.js`'s error handling keeps working.
- UI theme is defined in `.cursor/rules/buildbot-theme.mdc`: light theme only (Ashreitech-inspired), navy
  text (`--navy #0A1A2D`), blue primary CTA (`--blue #2A5EE8`), green success (`--green #10B981`), no
  full-app dark mode. Keep new UI in sync with the CSS variables in `client/src/index.css`. Per-store
  widget branding (`brandColor`, `widgetBg`) is the one place custom colors are expected.
