# BuildBot → Full React Rebuild Handoff (v2)

> **Paste this + `REACT_REBUILD_PROGRESS.md` into a brand-new empty folder.**  
> Give both to an AI IDE. The human is a **non-coder** (marketing / FYP). Guide them simply.  
> Supervisor requires **React.js**. The new project must be **fully separate** (new Vercel, Railway, Turso).

---

# PART A — RULES FOR THE AI

## A1. Build everything NEW (critical)

Do **NOT** copy-paste the old codebase and “hope it works”.

You must **create from this specification**:

| Piece | Build how? |
|---|---|
| **Client** | Brand-new **React + Vite** app |
| **Server** | Brand-new **Node + Express** API (implement every endpoint below) |
| **Widget** | Brand-new vanilla JS IIFE + CSS (served by the new server) |
| **WooCommerce plugin** | Brand-new PHP plugin (new API URL, clean code) |

Why: Old files are huge single HTML files, have hardcoded production URLs, and small bugs (e.g. widget reads `welcomeMessage` but API returns `welcomeMsg`). A fresh build from this spec reduces hidden errors.

You **may** look at old code **only as reference** if the human pastes it — but still rewrite cleanly into the new structure.

## A2. Work style

1. **One phase at a time** (see Part F). Never build the whole product in one shot.  
2. After every phase: **test → update `REACT_REBUILD_PROGRESS.md` → ask human before next phase**.  
3. When human action is needed (accounts, keys, deploy): **stop** and give click-by-click steps.  
4. Speak simply. Short steps.  
5. No secrets in git.  
6. Match **current product behavior** first; no new features until core works.  
7. Keep `TEST_MODE=true` and `EMAIL_TEST_MODE=true` during development.

## A3. Suggested new repo layout

```
buildbot-react/
├── REACT_REBUILD_HANDOFF.md
├── REACT_REBUILD_PROGRESS.md
├── client/                 ← React + Vite → Vercel
├── server/                 ← Express → Railway
│   ├── index.js
│   ├── database.js
│   ├── email.js
│   ├── widget.js
│   ├── widget.css
│   ├── routes/
│   ├── lib/
│   └── scripts/build-plugin.js
└── plugin/
    └── buildbot-woocommerce/
        └── buildbot-woocommerce.php
```

---

# PART B — WHAT THE PRODUCT IS

**BuildBot** = B2B SaaS for **PC parts stores in Pakistan**.

1. Store owner signs up and adds products (CSV or WooCommerce).  
2. They put a **widget** on their shop site.  
3. Shopper clicks widget → budget + purpose → AI returns **3 builds** from **that store’s catalog**.  
4. Store pays via JazzCash/EasyPaisa → submits transaction ID → **admin approves**.  
5. Admin manages stores, payments, emails, AI limits, support.

**Old live URLs (reference only — do not break / do not point new app at old DB by default):**

- Frontend: https://buildbot-nine.vercel.app/  
- API: https://buildbot-production-3f70.up.railway.app/  
- Admin: https://buildbot-nine.vercel.app/admin.html  

---

# PART C — HOW EVERYTHING WORKS (FLOWS)

Read this section carefully. This is how the **current product** works end-to-end.

---

## C1. Actors

| Actor | Where they work | Auth |
|---|---|---|
| Visitor | Landing page | None |
| Store owner | React dashboard (was `dashboard.html`) | JWT `bb_token` |
| Admin | React admin (was `admin.html`) | JWT `bb_admin_token` with `isAdmin:true` |
| Shopper | Widget on store website | None (only `storeId`) |
| WordPress site | WooCommerce plugin | Headers `X-BuildBot-Store-ID` + `X-BuildBot-Secret` |

---

## C2. Store owner journey (full flow)

```
LANDING
  → Signup (email + strong password)
  → Account NOT created as store yet
  → Row in pending_signups
  → Email with VERIFY LINK + 6-digit OTP

VERIFY (link page OR OTP on site)
  → Create store with temp id: temp-xxxxxxxx
  → email_verified = 1
  → Start trial (trial_started_at, trial_ends)
  → Welcome email to user + notify admin
  → Delete pending_signups row

LOGIN
  → Must be verified
  → JWT (7 days) → localStorage

FIRST LOGIN / STORE SETUP
  → PUT /api/store-setup { name }
  → temp-xxx → permanent id like my-shop-a1b2c3
  → New JWT issued

DASHBOARD ONBOARDING
  → Choose catalog mode: Manual/CSV  OR  WooCommerce
  → Manual: add products / upload CSV
  → Woo: download plugin, generate secret, connect, sync
  → Customize widget settings
  → Install widget (manual mode only) OR plugin injects it (woo mode)
  → Test recommendation on site
  → Billing when trial ends / upgrade
```

### Password rules
Min 8 chars + uppercase + lowercase + number + special character.

### Catalog modes (important UX)

| Mode | Products | Install Widget tab | How widget gets on site |
|---|---|---|---|
| Manual / CSV | Editable in dashboard | **Visible** | Owner pastes `<script>` |
| WooCommerce | Synced from WP; dashboard products mostly read-only | **Hidden** | Plugin injects script in `wp_footer` |

Mode is stored client-side today as `localStorage.bb_store_mode` (`custom` | `woo`) plus server `woo_connected` flag. New React app should keep the same UX: if woo connected, hide embed tab and send user to Store & Sync.

---

## C3. Store owner dashboard — tabs & behavior

Sidebar tabs (in order):

| Tab id | Name | What it does |
|---|---|---|
| `home` | Overview | Stats cards, journey checklist (setup progress), recent recommendations, trial chip, CTA to finish setup |
| `store` | Store & Sync | Store name/id (readonly), catalog mode buttons, Woo plugin download, generate/show plugin secret, connection status, sync status, disconnect |
| `products` | Products | Table: search/filter, add/edit modal, stock toggle, delete, CSV upload. If woo mode: show “managed by WooCommerce” / limited editing |
| `analytics` | Analytics | Total recs, by purpose, avg budget, daily activity, recent list (`GET /api/analytics`) |
| `embed` | Install Widget | Embed code with `data-store-id`, preview instructions, mark-as-live. **Guard: if woo mode → redirect to `store`** |
| `settings` | Widget Settings | brand color, currency, widget title, welcome message, button text, bg color, enable/disable widget, live preview |
| `billing` | Billing | Current plan/limits, plan cards (Starter/Growth/Pro prices from `/api/plans`), JazzCash/EasyPaisa number from config, submit payment form (method + transaction ref), payment history |
| `account` | Account | Profile, change password, marketing email preference, Google link if any, delete account |
| `help` | Help / Support | Support ticket form + list of own tickets + quick links |

Also: mobile bottom nav for key tabs; global loading spinner on API calls; trial/upgrade banners.

---

## C4. Admin journey & panel

```
/admin → Admin login (admins table, NOT stores)
  → JWT with isAdmin:true (1 day)
  → Overview loads stats + pending payments
```

### Admin tabs (all required)

| Tab | Purpose |
|---|---|
| **Overview** | Counts: stores, recs, revenue, pending payments; pending approve/reject shortcuts; recent stores |
| **All Stores** | Searchable table; actions: Activate, Disable, Delete, Manage (plan override, extend trial, notes, pause drip) |
| **Payments** | Pending queue + history; Approve / Reject |
| **Platform Stats** | Trial vs paid, top stores by usage, plan distribution |
| **Settings** | Admin profile/password; Platform config (trial days, prices, payment number, maintenance mode) |
| **API & Model** | Anthropic usage stats, estimated cost/profit, model select, max tokens, plan limits, USD→PKR — saves via platform-config |
| **DB Health** | Audit orphans/counts; cleanup tokens / orphans |
| **Revenue** | MRR, at-risk stores (plan ending soon), remind email |
| **Activity Log** | Client-side log in localStorage (last ~100 admin actions) |
| **Communications** | Broadcast email, send to one store, Run Drip Now, email send log, support tickets inbox + status |

### Admin payment approve flow

```
Store submits payment (pending)
  → Admin sees it
  → Admin checks JazzCash/EasyPaisa statement manually
  → Approve → payment approved + store plan set + plan_ends = now+30 days + email user
  → Reject → status rejected + email user
```

Stale pending (>6 hours) → drip cron emails admin.

---

## C5. Shopper widget flow (critical path)

Embed (manual):

```html
<script src="https://YOUR-RAILWAY-HOST/widget.js" data-store-id="STORE_ID"></script>
```

**Init**

1. Read `data-store-id` from script tag.  
2. Derive API base from script `src` origin (DO NOT hardcode old Railway URL).  
3. `GET /api/store-config/:storeId`  
4. If `active===false` or `widgetEnabled===false` → **exit silently** (no UI).  
5. Apply brandColor, widgetBg, currency, widgetTitle, welcomeMsg, buttonText.  
6. Inject CSS (`/widget.css`) + floating ⚡ launcher + panel.

**Screens**

| Step | Screen | UI |
|---|---|---|
| S1 | Welcome | Title, welcome text, start button |
| S2 | Budget | Number input + quick chips (presets e.g. 50k/80k/120k/200k) |
| S3 | Purpose | Chips: Office, Studies, Coding, Designing, Video Editing, Gaming, Streaming, Mixed Use |
| S4 | Extras | Optional chips (Monitor, Keyboard, Mouse, Headset, Webcam) + free text |
| S5 | Loading | Animated steps while calling API |
| S6 | Results | 3 cards: Budget / Balanced / Max; detail modal; PDF download (html2pdf CDN) |

**API call**

`POST /api/recommend` body:

```json
{ "storeId": "...", "budget": 80000, "purpose": "Gaming", "extras": "Monitor, WiFi card" }
```

**Success response shape**

```json
{
  "success": true,
  "builds": [ /* 3 build objects */ ],
  "canBuild": true,
  "noBuildsReason": "",
  "currency": "PKR",
  "usage": { "used": 1, "limit": 3, "remaining": 2, "period": "day" },
  "cached": false
}
```

**Each build object**

```json
{
  "tier": "Budget Build",
  "tagline": "...",
  "buildName": "...",
  "totalPrice": 60000,
  "withinBudget": true,
  "budgetRemaining": 20000,
  "compatible": true,
  "compatibilityNote": "",
  "parts": [
    {
      "category": "CPU",
      "name": "exact catalog name",
      "price": 15000,
      "quantity": 1,
      "totalPrice": 15000,
      "reason": "short"
    }
  ],
  "missingCategories": [],
  "summary": "...",
  "tips": "...",
  "budgetAdvice": "..."
}
```

**Recommend server logic (must implement)**

1. IP rate limit (~15/hour)  
2. Store exists + active + not disabled + widget enabled  
3. Plan limit check (trial daily / paid monthly)  
4. Products exist; filter price ≤ budget  
5. Cache hit? return cached builds (still log analytics with source `cached`)  
6. If `TEST_MODE=true` → return 3 fake builds (source `test`)  
7. Else call Anthropic with compact catalog lines `[category] name | price` (no descriptions)  
8. Parse JSON → log tokens/cost → return builds  

**store-config response (use consistent field names in NEW build)**

```json
{
  "success": true,
  "active": true,
  "widgetEnabled": true,
  "brandColor": "#7c6af7",
  "currency": "PKR",
  "widgetTitle": "BuildBot",
  "welcomeMsg": "...",
  "buttonText": "Get Started",
  "widgetBg": "#1a1d27",
  "budgetPresets": [50000, 80000, 120000, 200000]
}
```

Widget must read **`welcomeMsg`** (fix old mismatch).

---

## C6. WooCommerce plugin flow

```
Store owner generates plugin_secret in dashboard
  → Installs plugin on WordPress
  → Enters Store ID + Secret
  → Test Connection → POST /api/plugin/ping
  → Sync → POST /api/plugin/sync (bulk products)
  → Real-time hooks: product create/update/delete
  → Cron auto-sync every 6 hours
  → Plugin injects widget.js with data-store-id on frontend
  → Widget toggle → POST /api/plugin/widget-toggle
  → Auto-update checks GET /plugin-update.json
```

Auth on every plugin API call:

```
X-BuildBot-Store-ID: <store_id>
X-BuildBot-Secret: <plugin_secret>
```

Category mapping: map Woo categories/product names → BuildBot categories (CPU, GPU, RAM, Motherboard, Storage, PSU, Case, Cooler, Monitor, etc.) via keyword rules.

**NEW plugin must take API base URL from a constant at top of PHP file** that points to the **new** Railway URL (set during deploy phase — not hardcoded to old production).

---

## C7. Auth / email / drip flows

### Email (Resend only — no Gmail SMTP)

When `EMAIL_TEST_MODE=true`, send all mail to `RESEND_EMAIL_4TEST`.

Templates needed: welcome, verify (link+OTP), password reset, payment approved/rejected, admin new payment, admin new store, trial ending, onboarding day 4/10, plan expired, admin stale payment, admin manual/broadcast, support ticket admin + confirmation.

### Cron (server)

- 30s after boot once, then every 60 minutes  
- Trial ending in 3 days / 1 day  
- Signed up 4 days ago (no woo + no products) → onboarding  
- Signed up 10 days ago → onboarding  
- Plan lapsed 1 / 3 / 7 days → dunning  
- Stale pending payments 6h → admin alert  
- Dedup with `trial_emails_sent` / `email_send_log`  
- Respect `drip_emails_paused` and marketing prefs where applicable  

### Boot cleanup

Delete unverified / pending signups older than 7 days.

---

# PART D — DATA & API (IMPLEMENT IN NEW SERVER)

## D1. Database tables (Turso)

Create on `initDB()`:

- `admins`
- `stores` (+ all columns listed in progress/old docs: plan, widget fields, woo fields, google_id, trial_started_at, marketing/drip flags, abuse flags, etc.)
- `products`
- `recommendations` (+ source, model, input_tokens, output_tokens, est_cost_usd)
- `payments`
- `tokens` (+ attempt_count)
- `trial_emails_sent`
- `platform_config`
- `email_send_log`
- `support_tickets`
- `pending_signups`

Seed admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if admins empty.

Seed platform_config defaults: trial_days=14, trial_daily_limit=3, prices 2999/4999/7999, limits 500/2000, anthropic_model, max_tokens, usd_to_pkr, maintenance_mode, payment_number.

## D2. API endpoints (must all exist)

### Public
`POST /signup`, `POST /resend-verification`, `GET /verify-email`, `POST /verify-email-otp`, `POST /login`, `POST /google-auth`, `POST /forgot-password`, `POST /reset-password`, `GET /store-config/:storeId`, `GET /products/:storeId`, `POST /recommend`, `GET /plans`

Static (no `/api`): `GET /`, `GET /widget.js`, `GET /widget.css`, `GET /buildbot-woocommerce.zip`, `GET /plugin-update.json`

### Store JWT
`GET /me`, `PUT /store-setup`, `PUT /settings`, `PUT /widget-settings`, `PUT /change-password`, `PUT /email-preferences`, `POST /support`, `GET /support`, `DELETE /account`, `POST /upload`, `GET /products/manage/:storeId`, `POST /product`, `PUT /product/:id`, `PUT /product/:id/stock`, `DELETE /product/:id`, `GET /analytics`, `POST /payment/submit`, `GET /payment/history`, `POST /plugin/generate-key`, `GET /plugin/status`, `POST /plugin/disconnect`

### Plugin headers
`POST /plugin/ping`, `/plugin/sync`, `/plugin/product/update`, `/plugin/product/delete`, `/plugin/widget-toggle`, `/plugin/connection-status`, `/plugin/remote-disconnect`, `GET /plugin/widget-config/:storeId`

### Admin JWT
`POST /admin/login`, `GET /admin/me`, `PUT /admin/profile`, `PUT /admin/password`, `POST /admin/forgot-password`, `POST /admin/reset-password`, `GET /admin/overview`, `/admin/stores`, `/admin/payments`, `POST /admin/approve-payment`, `/admin/reject-payment`, `/admin/disable-store`, `/admin/activate-store`, `/admin/delete-store`, `/admin/set-plan`, `/admin/extend-trial`, `/admin/save-notes`, `/admin/set-drip-paused`, `GET /admin/store-products/:storeId`, `POST /admin/send-email`, `/admin/broadcast`, `/admin/run-drip`, `GET /admin/email-log`, `GET /admin/support-tickets`, `POST /admin/support-tickets/:id/status`, `GET /admin/api-usage`, `GET /admin/db-audit`, `POST /admin/db-cleanup`, `GET|POST /admin/platform-config`

## D3. Env vars (new Railway)

Required over time: `TURSO_URL`, `TURSO_TOKEN`, `JWT_SECRET`, `PORT`, `APP_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_MAX_TOKENS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_EMAIL_4TEST`, `EMAIL_TEST_MODE`, `TEST_MODE`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CRON_ENABLED`.

**NOT required:** `GMAIL_USER`, `GMAIL_PASS`, `STRIPE_SECRET_KEY` (unused in product).

Client: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`.

---

# PART E — REACT CLIENT REQUIREMENTS

- React + Vite + React Router  
- AuthContext (store) + AdminAuthContext  
- API helper with Bearer token + loading indicator  
- Pages: Landing, Login, Signup, Verify, Reset Password, Dashboard (all tabs), Admin (all tabs)  
- Protected routes  
- Dark SaaS look similar to current product (functional first; polish later)  
- Responsive (mobile nav for dashboard)

Do **not** put the shopper widget inside React Router as the embeddable script — shoppers load `widget.js` from the API host.

---

# PART F — PHASED BUILD (ONE AT A TIME)

Update `REACT_REBUILD_PROGRESS.md` after each phase.

### Phase 0 — Human accounts
New folder, Node installed, new Turso, plan Railway/Vercel later, collect keys gradually.

### Phase 1 — React shell
Vite app boots; routes placeholders.

### Phase 2 — NEW Express server + Turso
Create server from scratch; `initDB`; health check.

### Phase 3 — Auth API + React auth UI
Signup/verify/login/reset wired.

### Phase 4 — Store setup + dashboard shell
Sidebar + empty tabs + `/me`.

### Phase 5 — Products + CSV (new upload routes)
Full products tab.

### Phase 6 — NEW widget.js/css + settings + embed tab
Widget loads config; launcher shows.

### Phase 7 — Recommend engine + full widget steps
TEST_MODE first; then optional real AI.

### Phase 8 — Analytics + billing UI/API
Payments pending.

### Phase 9 — Admin core (new admin routes + React admin)
Login, overview, stores, approve payments.

### Phase 10 — Admin advanced + drip cron + emails
Config, API&Model, comms, support, cron.

### Phase 11 — NEW WooCommerce plugin + plugin API routes
Build PHP plugin + zip serve + Store & Sync connect flow.

### Phase 12 — Google OAuth + deploy
Vercel + Railway + update APP_URL + plugin API constant + smoke test all flows.

---

# PART G — DEFINITION OF DONE (FYP)

- [ ] React landing + auth + store dashboard + admin  
- [ ] New Express server on Railway with new Turso  
- [ ] New widget works on a test HTML page  
- [ ] Full owner flow: signup → verify → setup → products → widget recommend (test mode)  
- [ ] Admin can approve payment and change store status  
- [ ] New Woo plugin can ping/sync against new API  
- [ ] Progress file shows all phases done  
- [ ] No dependency on old Railway/Vercel/Turso for the new app  

---

# PART H — FIRST MESSAGE TO HUMAN

> I read the BuildBot handoff v2. We will rebuild **everything new**: React client, Express server, widget, and WooCommerce plugin — in small phases, not all at once.  
> First: confirm this is a **new empty folder**, Node works, and you have (or will create) a new Turso database.  
> I will start Phase 1 only after Phase 0 checklist items we need right now are done. I will update `REACT_REBUILD_PROGRESS.md` every step.
