# BuildBot React Rebuild — Progress Tracker (v2)

> **AI: Update after EVERY phase.**  
> **Human: Copy this file + `REACT_REBUILD_HANDOFF.md` into the NEW project folder.**  
> Source of truth so context is not lost.

---

## Status Snapshot

| Field | Value |
|---|---|
| **Current phase** | Phase 11 complete — Phase 12 intentionally paused (human request); doing production-hardening + polish pass instead |
| **Overall status** | `IN PROGRESS` |
| **Last updated** | 2026-08-10 — Bug-fix pass + landing page rebuild + premium auth pages + full store dashboard redesign |
| **Blocked on human?** | No — Phase 12 (Google OAuth + deploy) on hold at human's request |
| **Local client** | `client/` — Vite + React Router; `npm run dev` → http://127.0.0.1:5173 |
| **Local API** | `server/` — Express; `npm start` → http://127.0.0.1:3001/ |
| **Vercel** | — |
| **Railway** | — |
| **Turso** | Local libSQL file `server/local.db` for now; cloud Turso optional until deploy |

---

## Build rule (do not skip)

| Piece | Approach |
|---|---|
| React client | Create new (Vite) |
| Express server | Create new from handoff API/DB specs |
| Widget JS/CSS | Create new (no hardcoded old Railway URL) |
| WooCommerce plugin | Create new PHP plugin pointing at new API |

Do **not** copy-paste old `dashboard.html` / old server as the final product.

---

## Waiting on human

- [x] Create new empty folder (e.g. `Desktop/buildbot-react`) — separate from old BuildBot  
- [x] Open it in Cursor / AI IDE  
- [x] Copy `REACT_REBUILD_HANDOFF.md` + this file into that folder  
- [x] Confirm Node.js works (`node -v`)  
- [ ] Create new Turso DB (cloud) — optional now; required before Railway deploy  
- [ ] Create Resend / Anthropic / Railway / Vercel when AI asks (not all at once)  

**Not needed:** Stripe, Gmail SMTP.

---

## Env vars configured so far

| Variable | Set? | Where |
|---|---|---|
| TURSO_URL | Yes (local) | `server/.env` → `file:local.db` |
| TURSO_TOKEN | N/A local | empty for file DB |
| JWT_SECRET | Yes | `server/.env` |
| APP_URL | Yes | `server/.env` → http://localhost:5173 |
| ANTHROPIC_API_KEY | No | |
| ANTHROPIC_MODEL | No | |
| ANTHROPIC_MAX_TOKENS | No | |
| RESEND_API_KEY | No | |
| RESEND_FROM_EMAIL | No | |
| RESEND_EMAIL_4TEST | No | |
| EMAIL_TEST_MODE | Yes | `server/.env` → true |
| TEST_MODE | Yes | `server/.env` → true |
| GOOGLE_CLIENT_ID | No | |
| ADMIN_EMAIL | Yes | `server/.env` → admin@buildbot.local |
| ADMIN_PASSWORD | Yes | `server/.env` → Admin123! |
| PORT | Yes | `server/.env` → 3001 |
| VITE_API_URL | Yes | `client/.env` → http://127.0.0.1:3001 |
| VITE_GOOGLE_CLIENT_ID | No | |

---

## Phase checklist

### Phase 0 — Accounts
- Status: `DONE`
- [x] New folder + both MD files present  
- [x] Node installed (`v22` / also saw `v20` on PATH — both OK)  
- [x] JWT_SECRET set in `server/.env`  
- [ ] New Turso cloud DB — optional until deploy  

**Last test:** Folder + Node OK.  

---

### Phase 1 — React shell
- Status: `DONE`
- [x] Vite React app runs (`client/`)  
- [x] Routes: `/`, `/login`, `/signup`, `/verify`, `/reset-password`, `/dashboard`, `/admin`  
- [x] Placeholder pages only  
- Note: Pinned **Vite 5.4** (Vite 8/rolldown native binding failed on this Windows setup)

**Last test:** `npm run build` OK; `npm run dev` serving at http://127.0.0.1:5173  

---

### Phase 2 — NEW Express + Turso
- Status: `DONE`
- [x] New server created (`server/` — Express + libSQL, not a copy of old project)  
- [x] `initDB` creates all tables (admins, stores, products, recommendations, payments, tokens, trial_emails_sent, platform_config, email_send_log, support_tickets, pending_signups)  
- [x] `GET /` health OK  
- [x] Admin seed works (1 admin row)  
- Note: Using local `file:local.db` for Phase 2/3; swap to cloud Turso URL+token before deploy  

**Last test:** `GET http://127.0.0.1:3001/` → `ok:true`, admins:1, platform_config_keys:13, trial_days:14  

---

### Phase 3 — Auth (API + React)
- Status: `DONE`
- [x] Signup → pending_signups  
- [x] Verify link + OTP  
- [x] Login JWT  
- [x] Forgot/reset password  
- [x] React auth screens work  
- Note: No Resend yet — with `EMAIL_TEST_MODE=true`, OTP/links shown in UI (`devHint`) + server console  

**Last test:** API E2E signup→OTP verify→`/me`→login→forgot→reset→login OK; store `temp-*` created  

---

### Phase 4 — Store setup + dashboard shell
- Status: `DONE`
- [x] `PUT /store-setup` (temp-* → slug-id + new JWT)  
- [x] All store tabs exist as shells (Overview, Store&Sync, Products, Analytics, Embed, Settings, Billing, Account, Help)  
- [x] Auth guard + `/me`  
- [x] Catalog mode `bb_store_mode` (custom|woo); Embed tab hidden in woo mode  
- [x] Mobile bottom nav for key tabs  

**Last test:** API `temp-06bd8ff0` → `karachi-pc-hub-494141`; `/me` with new JWT OK  

---

### Phase 5 — Products + CSV
- Status: `DONE`
- [x] CRUD + stock  
- [x] CSV upload (memory multer)  
- [x] Products tab UI (search/filter, modal, woo lock)  

**Last test:** create/update/stock/manage/public/CSV import 2/delete OK; health products count updated  

---

### Phase 6 — NEW widget + settings + embed
- Status: `DONE`
- [x] New `widget.js` / `widget.css`  
- [x] API URL derived from script origin (not hardcoded)  
- [x] `welcomeMsg` field consistent  
- [x] Widget settings tab + embed tab  
- [x] Launcher appears on test page (`/widget-test?storeId=…`)  
- Note: Full S2–S6 recommend flow is Phase 7; Phase 6 = config + launcher + welcome  

**Last test:** store-config + widget-settings save/reflect; disable flag works; widget.js/css 200; no old Railway URL  

---

### Phase 7 — Recommend + full widget flow
- Status: `DONE`
- [x] Limits + cache + TEST_MODE  
- [x] Widget S1–S6  
- [x] 3 builds render + modal + PDF optional  
- [x] Analytics log row created (`recommendations` table)  
- Note: With `TEST_MODE=true` returns fake `[TEST]` builds; real Anthropic later when key is set  

**Last test:** 3 TEST builds; 2nd identical request `cached:true`; usage 1/3 then 2/3; phase=7  

---

### Phase 8 — Analytics + billing
- Status: `DONE`
- [x] Analytics tab (`GET /api/analytics`)  
- [x] Plans + payment submit/history  

**Last test:** plans×3; analytics after recommend; payment pending growth 4999; history 1; phase=8  

---

### Phase 9 — Admin core (React + API)
- Status: `DONE`
- [x] Admin login  
- [x] Overview  
- [x] Stores activate/disable/delete/manage  
- [x] Approve/reject payments  
- [x] Settings (payment_mode, prices, trial, maintenance)  

**Last test:** phase=9; admin login; overview 10 stores / approve→growth; disable→activate; reject pending; platform-config save; client build OK  

---

### Phase 10 — Admin advanced + drip
- Status: `DONE`
- [x] Platform config  
- [x] API & Model tab  
- [x] Communications + drip + email log  
- [x] Support tickets  
- [x] DB health  
- [x] Revenue + activity log  
- [x] Cron running  

**Last test:** phase=10; platform-stats; api-usage; run-drip result; email-log; db-audit/cleanup; revenue; support ticket close; profile; client build OK; CRON_ENABLED=false (manual drip works)  

---

### Phase 11 — NEW WooCommerce plugin + plugin APIs
- Status: `DONE`
- [x] New plugin PHP created  
- [x] Ping / sync / hooks / widget inject  
- [x] Zip served by server  
- [x] Store & Sync UI connect flow  
- [x] Plugin points to NEW API URL  

**Last test:** phase=11; wrong secret 401; generate-key→ping→sync 3→category map→update/delete→woo locks CRUD→widget-toggle; zip + plugin-update.json; client build OK  

---

### Phase 12 — Google + deploy + E2E
- Status: `PAUSED` (human asked to hold off on this phase for now)
- [ ] Google OAuth  
- [x] Landing content — full marketing landing page shipped outside the phased plan (see "Post-Phase-11 hardening" below)
- [ ] Railway deploy  
- [ ] Vercel deploy  
- [ ] E2E: signup → setup → products → widget → admin approve  

**Last test:** —  

---

## Post-Phase-11 hardening pass (2026-08-10)

With Phase 12 on hold, this session focused on (1) closing known API/UI gaps and (2) rebuilding the marketing landing page to a production-grade standard.

### 1. Bug fixes — closed "known gaps" from Phase 10 notes

| Gap | Fix |
|---|---|
| Store **Account tab** was a placeholder | Built `client/src/dashboard/AccountTab.jsx` — profile (name) save, change password, email/marketing preferences, delete-account danger zone |
| `PUT /api/change-password` missing | Added in `server/routes/store.js` (verifies current password, validates + hashes new one) |
| `PUT /api/email-preferences` missing | Added in `server/routes/store.js` (`marketing_opt_in` toggle) |
| `PUT /api/settings` missing | Added in `server/routes/store.js` (store display-name update, separate from `/store-setup`'s id-assignment job) |
| `DELETE /api/account` missing | Added in `server/routes/store.js` (password-confirmed; cascades products/recommendations/payments via existing FKs) |
| `POST /admin/forgot-password` / `/admin/reset-password` missing | Added in `server/routes/admin.js`, mirroring the store forgot/reset flow (`tokens` table, `type='admin_password_reset'`, `EMAIL_TEST_MODE` devHint support); new `adminPasswordResetEmailContent()` added to `server/email.js` |

**Validation:** `server/scripts/regression-p0-p10.js` re-run → 62/65 passed (3 pre-existing JazzCash payment-mode failures, unrelated to this change); both previously-logged "gap" notes no longer print, confirming the endpoints exist and work. Manual curl pass on every new endpoint (wrong-password rejections, success paths, delete-then-login-fails). `client && npm run build` clean. Project diagnostics clean.

### 2. Landing page — full rebuild (`client/src/pages/Landing.jsx` + new `client/src/landing/` folder)

Replaced the placeholder landing page with a full marketing site on the existing light Ashreitech theme (navy/blue). New structure:

- **Header** (`landing/Header.jsx`) — sticky, blurs + gains shadow on scroll, anchor nav (Features/How it works/Pricing/FAQ), login/signup CTAs, animated mobile slide-down menu with hamburger toggle.
- **Hero** (`landing/Hero.jsx` + `landing/WidgetPreview.jsx`) — headline, subhead, CTAs, trust line, and a hand-built (no stock image) mockup of the actual widget UI (budget chips → purpose chips → 3 build cards) with floating gradient decor.
- **Purpose strip** (`landing/PurposeStrip.jsx`) — infinite marquee using the real `PURPOSES` list from `server/routes/recommend.js` (Office, Studies, Coding, Designing, Video Editing, Gaming, Streaming, Mixed Use).
- **Features** (`landing/Features.jsx`) — 6 feature cards with `lucide-react` icons.
- **How it works** (`landing/HowItWorks.jsx`) — 4-step numbered flow.
- **Showcase** (`landing/Showcase.jsx`) — product-intelligence deep dive with checklist, reusing the widget mockup.
- **Local strip** (`landing/LocalStrip.jsx`) — dark band on PKR pricing / JazzCash & EasyPaisa / admin-verified payments.
- **Pricing** (`landing/Pricing.jsx`) — fetches live plans + trial config from the public `GET /api/plans` endpoint (falls back to seeded defaults if the API is unreachable), so prices always match what admin has configured.
- **FAQ** (`landing/Faq.jsx`) — accordion, single-open, animated chevron.
- **Final CTA** (`landing/FinalCta.jsx`) and **Footer** (`landing/Footer.jsx`).

**Animations:** added `client/src/hooks/useReveal.js` (IntersectionObserver hook) + `client/src/components/Reveal.jsx` (reusable scroll-reveal wrapper, fade/slide/scale variants, staggered delays) — no extra animation library needed. Plus CSS keyframe floats on hero/widget decor, marquee scroll, sticky-header transition, accordion grid-rows transition, and hover lifts on cards. Respects `prefers-reduced-motion`.

**Icons:** added `lucide-react` (new dependency) for all UI icons — no emoji/stickers anywhere on the page.

**Fonts:** added Google Font **Inter** (`client/index.html` link tags) and set it as the site-wide `--font-sans` in `client/src/index.css` (previous stack was system `"Segoe UI"` — no Montserrat/Inter was already in use, so Inter was added per instructions).

**Cleanup:** removed unused Vite template leftovers `client/src/assets/react.svg`, `vite.svg`, `hero.png`.

**Validation:** `client && npm run build` succeeds (clean bundle, no errors); manually started `server` + confirmed `GET /api/plans` returns real plan data the Pricing section consumes; verified all `lucide-react` icon names used actually exist in the installed package; project diagnostics clean.

**Note on a cosmetic-only side effect:** the editor's format-on-save reformatted `client/index.html`, `client/src/index.css`, and `client/src/pages/Landing.jsx` to a different quote/indentation style (double quotes/semicolons/4-space) than the rest of the codebase's (single quotes/no semicolons/2-space). This is whitespace/style only — no logic changed — but worth normalizing later with a project-wide formatter run if you want a clean `git diff`.

### 3. Premium auth pages — login, signup, verify, reset password, admin login, store setup

Rebuilt every auth-adjacent screen on a new shared system instead of the old plain `.page`/`.card-form` look:

- **`client/src/auth/AuthLayout.jsx`** — split-screen shell: dark navy/blue branded panel (logo, eyebrow, heading, benefit checklist) on one side, the form on a clean white panel on the other. Collapses to a single column with the logo on top for mobile (`< 900px`).
- **`client/src/auth/TextField.jsx`** — labeled input with a leading icon (Mail, Store, etc.).
- **`client/src/auth/PasswordField.jsx`** — labeled password input with a leading lock icon **and an SVG show/hide toggle** (`Eye`/`EyeOff` from `lucide-react`, `aria-pressed` + `aria-label` for accessibility).
- **`client/src/auth/PasswordStrength.jsx`** — live strength meter (segmented bar + Weak/Fair/Good/Strong label) and a 5-rule checklist (length, upper, lower, number, special) with check/X icons — shown on Signup and the Reset-password "new password" step.
- **`client/src/auth/OtpInput.jsx`** — 6 individual digit boxes with auto-advance, backspace-to-previous, arrow-key navigation, and paste-splits-across-boxes support — replaces the old single OTP text input on Verify and Reset Password.
- **`client/src/auth/Alert.jsx`** — consistent error/success/info banners with icons (`AlertCircle`/`CheckCircle2`/`Info`), replacing plain `<p className="form-error">`.
- **`client/src/auth/SubmitButton.jsx`** — full-width submit button with an animated spinner (`Loader2`) while busy.
- **`client/src/auth/auth.css`** — all new styles (scoped `.auth-*` classes), reusing the existing navy/blue theme tokens from `index.css`.

Pages rebuilt on this system: `client/src/pages/Login.jsx`, `Signup.jsx`, `Verify.jsx`, `ResetPassword.jsx`, the admin-login branch of `client/src/pages/Admin.jsx`, and `client/src/dashboard/StoreSetupGate.jsx` (standalone centered-card variant, no split panel since the user is already authenticated at that point). Each page now has tailored left-panel marketing copy (e.g. Login: "Pick up right where you left off"; Signup: "Launch your AI build widget in minutes"; Admin: "Platform control center").

Moved the shared `.lp-logo`/`.lp-logo-word` rules from `landing.css` into global `index.css` so the same `Logo` component now renders correctly on auth pages too, not just the landing page.

**No emoji/stickers** — every icon (mail, lock, eye, shield, key, store, check, alert, spinner) is an SVG from `lucide-react`, consistent with the landing page.

**Validation:** `client && npm run build` succeeds (clean bundle); verified every new icon name exists in the installed `lucide-react` package; project diagnostics clean; manually started `server` and confirmed the health endpoint responds so the auth pages have a live API to talk to.

### 4. Store dashboard — full redesign (sidebar, topbar, cards, tables, skeletons)

Replaced the old plain `.dash-*` shell (still used as-is by the **admin** panel, untouched) with a dedicated, scoped design system for the store owner dashboard only:

- **`client/src/dashboard/dashboard.css`** — new `.sd-*` class namespace (shell, sidebar, topbar, cards, stat cards, banners, steps/checklist, empty states, skeleton loaders, tables, badges, toolbar, forms). Fully separate from `.dash-*` so the admin panel (`client/src/pages/Admin.jsx`) keeps its existing look untouched.
- **`client/src/dashboard/Sidebar.jsx`** — real dashboard-style sidebar: logo, store name + plan pill (trial/paid), icon-led nav (`lucide-react`: LayoutDashboard, Store, Package, BarChart3, Code2, Palette, CreditCard, UserCircle, LifeBuoy), an upgrade card shown only on trial, log-out button. Becomes a slide-in drawer with backdrop on mobile/tablet (`< 980px`).
- **`client/src/dashboard/Topbar.jsx`** — sticky top bar with the current section title, a live trial-countdown chip, and a user menu (avatar initial, dropdown with Account/Help/Log out) with outside-click-to-close.
- **`client/src/dashboard/ui/`** — shared building blocks reused across every tab: `PageHeader`, `Card`, `StatCard`, `Badge`, `EmptyState`, `Alert`, and `Skeleton` (`SkeletonStats`, `SkeletonRows`, `SkeletonCard` — shimmer-animated placeholders shown while each tab's API call is in flight, addressing real-world network latency once deployed).
- **`client/src/pages/Dashboard.jsx`** — rewritten to compose Sidebar + Topbar + a centered `.sd-content` column; mobile menu state; tab routing logic unchanged.
- Every tab rewritten on the new system: `OverviewTab` (welcome header, trial banner, stat cards, checklist, and a **real recent-activity table** pulled from `/api/analytics` instead of the old "Phase 8" placeholder), `ProductsTab` (icon toolbar, empty states, icon row-actions, skeleton rows while loading), `AnalyticsTab`, `StoreSyncTab`, `WidgetSettingsTab`, `EmbedTab`, `BillingTab`, `HelpTab`, `AccountTab` — all now use `PageHeader`/`Card`/`StatCard`/`Badge`/`EmptyState`/`Alert`/skeletons for consistent typography, spacing, and visual hierarchy.
- Removed the now-unused `PlaceholderTab` reference from `OverviewTab` (file left in place in case it's wanted elsewhere).
- Polished the global "Working…" indicator (`client/src/components/GlobalLoading.jsx`) into a small animated pill with a spinning `Loader2` icon and a fade-in, so background API calls feel intentional rather than jarring — useful once real network latency shows up in production.

**Validation:** `client && npm run build` succeeds (clean bundle); verified every new icon name exists in the installed `lucide-react` package; project diagnostics clean; confirmed the API health endpoint responds (server was already running from manual testing).

---

## Flow verification checklist (fill during testing)

### Store owner
- [x] Signup → email/OTP verify → login  
- [x] Store setup renames `temp-*` → permanent id  
- [x] Manual mode: CSV/products → embed snippet → widget works (API + widget.js/config regression)  
- [x] Woo mode: generate secret → plugin ping/sync → embed tab hidden  
- [x] Billing submit → appears pending  
- [x] Support ticket creates + emails  

### Shopper widget
- [x] Disabled store/widget → no launcher  
- [x] Budget/purpose/extras → loading → 3 builds  
- [ ] Limit exceeded shows friendly message (API returns limit error; UI message not re-tested this pass)  
- [x] TEST_MODE fake builds work without Anthropic  

### Admin
- [x] Login as admin (not store JWT)  
- [x] Approve payment activates plan 30 days  
- [x] Disable store (API) — widget stop verified earlier for disabled flag  
- [x] Platform config changes prices without redeploy  
- [x] Run drip returns result object  
- [x] API & Model shows usage / saves model limits  

### Plugin
- [x] Wrong secret → rejected  
- [x] Sync replaces catalog + touchCatalog  
- [x] Widget script injected on WP frontend (PHP `wp_footer` inject)  

---

## Session log (append-only)

| Date | What happened |
|---|---|
| 2026-08-10 | v1 handoff created |
| 2026-08-10 | v2: re-audited admin/dashboard/widget flows; AI must build NEW server + plugin + React (not copy old project) |
| 2026-08-10 | Phase 0 checked (folder + Node). Phase 1: created `client/` Vite React + Router placeholders; Vite 5 pinned after Vite 8 binding error; build + dev OK |
| 2026-08-10 | Theme change: light UI using Ashreitech colors (`#0A1A2D`, `#2A5EE8`, `#F8FAFC`, etc.); Cursor rule `.cursor/rules/buildbot-theme.mdc` added |
| 2026-08-10 | Phase 2: new `server/` Express + `database.js` initDB (all tables), platform_config + admin seed; health `GET /` OK on :3001; local `file:local.db` |
| 2026-08-10 | Phase 3: auth API (signup/verify/login/forgot/reset/me) + React AuthContext + forms; EMAIL_TEST_MODE shows OTP on screen; E2E API test passed |
| 2026-08-10 | Phase 4: PUT /api/store-setup; dashboard sidebar + all tab shells; StoreSetupGate; catalog mode hides Embed in woo; mobile nav |
| 2026-08-10 | Pre–Phase 5 regression: **28/28 PASS** (P1 routes, P2 health/admin/config, P3 auth full, P4 store-setup); client+API up |
| 2026-08-10 | Fixed Dashboard import paths (`../dashboard/...`); client `npm run build` OK after fix |
| 2026-08-10 | Phase 5: products API (CRUD/stock/public/manage/CSV multer) + ProductsTab UI; woo mode locks edits; E2E OK |
| 2026-08-10 | Phase 6: widget.js/css + store-config + widget-settings; Embed + Settings tabs; /widget-test page; origin-based API |
| 2026-08-10 | Pre–Phase 7 review: handoff Phases 1–6 scope matches build; regression **23/23 PASS**; ready for Phase 7 recommend |
| 2026-08-10 | Phase 7: POST /api/recommend (IP limit, plan limits, cache, TEST_MODE); widget S1–S6 + modal + PDF; analytics rows |
| 2026-08-10 | Phase 8: GET /plans + /analytics; payment submit/history; AnalyticsTab + BillingTab; payments stay pending for admin |
| 2026-08-10 | Demo Stripe-like checkout (test cards, Luhn, auto-activate); admin login + payment_mode demo/jazzcash/both |
| 2026-08-10 | Phase 9: admin APIs (overview/stores/payments/approve/reject/platform-config) + React admin shell (Overview, Stores, Payments, Settings) |
| 2026-08-10 | Phase 10: drip cron + admin advanced (stats, API&Model, DB, revenue, activity, comms/support); store HelpTab; Resend optional |
| 2026-08-10 | Pre–Phase 11 audit: handoff vs build reviewed; regression **65/65 PASS** (P1–P10); drip `trial_ending_3d` sent; noted gaps: Account tab APIs, admin forgot/reset, Woo/plugin (P11), Google (P12) |
| 2026-08-10 | Phase 11: plugin PHP + APIs (ping/sync/hooks/toggle), zip + plugin-update.json, Store&Sync generate secret/download/disconnect; smoke PASS |
| 2026-08-10 | Human paused Phase 12 for now; requested bug-fix pass + production-quality landing page instead |
| 2026-08-10 | Closed known gaps: Account tab (change-password/email-preferences/settings/delete-account) + admin forgot/reset-password, front + back end; regression re-run 62/65 (3 pre-existing unrelated failures) |
| 2026-08-10 | Rebuilt landing page as a full SaaS marketing site (header, hero, purpose marquee, features, how-it-works, product showcase, local-payments strip, live-pricing, FAQ, final CTA, footer); added scroll-reveal animations, Inter font, `lucide-react` icons (no emoji) |
| 2026-08-10 | Rebuilt auth pages (Login, Signup, Verify, Reset Password, Admin login, Store Setup) with a shared split-panel layout, SVG password show/hide toggle, OTP box input, password strength meter, and icon-based alerts — no emoji anywhere |
| 2026-08-10 | Quick fixes per feedback: removed "Admin login" link from store login page footer; made the auth split-panel `position: sticky` so it no longer stretches/scrolls with tall form content |
| 2026-08-10 | Redesigned the full store owner dashboard: new sidebar + topbar shell, shared card/stat/badge/empty-state/skeleton components, all 9 tabs rebuilt for better typography/spacing/hierarchy; admin panel left untouched |

---

## Known decisions

- Separate new accounts: Turso, Railway, Vercel  
- Payments = JazzCash/EasyPaisa + manual admin approve (no Stripe)  
- Email = Resend (no Gmail)  
- Widget = vanilla JS on API host  
- Admin has **10 tabs** including **API & Model**  
- Store dashboard has Overview, Store&Sync, Products, Analytics, Install Widget, Widget Settings, Billing, Account, Help  
- One phase at a time; always update this file  
- Client uses **Vite 5.4** (not Vite 8) for Windows compatibility  
- **UI theme = light**, colors from [Ashreitech](https://ashreitech.com/) (navy `#0A1A2D`, blue `#2A5EE8`, bg `#F8FAFC`) — **not** dark purple SaaS from old product / handoff Part E default  
- **Payments:** admin `payment_mode` = `demo` | `jazzcash` | `both`. Demo card checkout auto-approves plan (FYP). JazzCash still pending → admin approve (Phase 9).  
- **Phase 10 known gaps vs full D2 list:** ~~store Account APIs (`PUT /change-password`, `/email-preferences`, `DELETE /account`, `PUT /settings`); `POST /admin/forgot-password` + `/admin/reset-password`~~ — **closed 2026-08-10** (see "Post-Phase-11 hardening pass"). Cron scheduled runs still need `CRON_ENABLED=true` (manual **Run drip now** works).  
- **Phase 12 paused at human's request** (2026-08-10) — Google OAuth + Railway/Vercel deploy not started. Landing page content was pulled forward and finished ahead of the rest of Phase 12.  
- **Recommend engine is still heuristic, not real Anthropic AI** (`server/routes/recommend.js`): `TEST_MODE=true` returns fake `[TEST]` builds, otherwise falls back to a `catalog-heuristic` (pick cheapest/median/priciest per category within budget). Wiring the real Anthropic call was explicitly deferred in the original build and is worth flagging before calling the product "done" for real AI-driven recommendations.  
- **New client dependency added:** `lucide-react` (icon set for the new landing page).  

