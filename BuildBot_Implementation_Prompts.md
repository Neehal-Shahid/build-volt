# BuildBot — Remaining Implementation Prompts

Use these prompts one at a time in Cursor. Each prompt is self-contained and tells the AI exactly what to read, what to change, and how to verify the result. Work through them in order — earlier phases unblock later ones.

---

## STATUS LEGEND
- 🔴 Critical / security — do first
- 🟡 High priority UX / logic
- 🟢 Polish / premium

---

## PHASE A — Critical Fixes

---

### A3 — Fix Plugin ZIP: Inject Production API URL at Build Time 🔴

**Problem:** `plugin/buildbot-woocommerce/buildbot-woocommerce.php` has `define('BUILDBOT_API_BASE', 'http://127.0.0.1:3001')` hardcoded. Every store that downloads the plugin from the admin panel gets a ZIP that points at localhost and will silently fail in production. The fix must happen in `server/scripts/build-plugin.js` so every ZIP that gets built automatically uses the real Railway URL.

**Files to read first:**
- `server/scripts/build-plugin.js` — understand how the ZIP is currently built
- `server/lib/pluginArtifacts.js` — understand when the script is called
- `plugin/buildbot-woocommerce/buildbot-woocommerce.php` — find the exact `BUILDBOT_API_BASE` constant line

**What to change:**

In `server/scripts/build-plugin.js`:
1. Before zipping, read the PHP file contents into a string
2. Replace the hardcoded `http://127.0.0.1:3001` with `process.env.PUBLIC_API_URL || process.env.API_URL || 'http://127.0.0.1:3001'`
3. Write the modified PHP string to a temp file (or directly into the ZIP buffer) — do NOT modify the source PHP file in `plugin/`
4. Zip the temp/modified version, not the original

This means: every time Railway starts and `ensurePluginArtifacts()` runs, the ZIP is rebuilt with the correct production URL baked in.

**Verify:** After the change, log the first 20 lines of the built PHP inside the ZIP (or add a console.log showing the replaced URL) so you can confirm the replacement happened.

---

### A5 — Cron Health Indicator on Admin DB Health Tab 🔴

**Problem:** `CRON_ENABLED` controls whether drip emails run, but there is no UI anywhere in the admin panel that shows if cron is running or disabled. An admin has no way to know the system is silently not sending trial-expiry emails unless they SSH into Railway and check logs.

**Files to read first:**
- `client/src/admin/AdminDbHealth.jsx` — this is where the fix goes
- `server/routes/adminAdvanced.js` — look for the `GET /api/admin/db-health` or equivalent endpoint that `AdminDbHealth.jsx` calls; add the cron field there

**What to change:**

In the server route that powers DB Health (likely `GET /api/admin/db-health` in `adminAdvanced.js`):
- Add `cronEnabled: process.env.CRON_ENABLED === 'true'` to the JSON response

In `AdminDbHealth.jsx`:
- Read `cronEnabled` from the API response
- Render a status row at the top of the page (before the table counts) that looks like the existing `sd-stat-card` pattern:
  - If `cronEnabled: true` → green badge, "Cron active — drip emails running automatically"
  - If `cronEnabled: false` → red/amber badge, "Cron disabled — set CRON_ENABLED=true in Railway to enable drip emails" with a link or note

Use existing CSS classes (`sd-stat-card`, `sd-badge`, etc.) — do not add new CSS.

**Verify:** Run the server locally with `CRON_ENABLED=false` and confirm the amber warning appears. Change to `CRON_ENABLED=true` and confirm the green badge appears.

---

### A6 — Budget Presets Editor in Widget Settings 🟡

**Problem:** The `budget_presets` column exists in the `stores` DB table and the widget reads it to render the budget chip buttons (e.g. PKR 50,000 / 80,000 / 120,000 / 200,000). But `WidgetSettingsTab.jsx` has no UI to edit these values — the store owner is stuck with the defaults forever.

**Files to read first:**
- `client/src/dashboard/WidgetSettingsTab.jsx` — full file; understand the existing form shape and `saveAll()` call
- `server/routes/store.js` — find `PUT /api/widget-settings`; check if `budget_presets` is accepted and saved, or if it needs to be added

**What to change:**

In `server/routes/store.js`, `PUT /api/widget-settings`:
- Accept `budgetPresets` in the request body
- Validate: must be an array of 2–6 positive numbers, each between 1,000 and 10,000,000
- If valid, serialize to JSON string and save to `budget_presets` column
- If invalid, return `400` with a clear error message

In `client/src/dashboard/WidgetSettingsTab.jsx`:
- Add `budgetPresets` to the form state, initialized from `store.budgetPresets` (already returned by `publicStore()`)
- Render a "Budget presets" section inside the existing settings card with:
  - A row of chips showing each current preset value with an ✕ button to remove it
  - A small input + "Add" button to add a new preset value (number input, min 1000, max 10000000)
  - A note: "These appear as quick-select buttons in your widget. 2–6 values recommended."
- Include `budgetPresets` in the `saveAll()` body
- Show validation error if the array would become empty or exceed 6 items

Use existing `sd-*` CSS classes and the `Badge` component for the chips. No new CSS files needed.

**Verify:** Save new presets → open `/widget-test?storeId=YOUR_ID` → confirm the budget chips reflect the new values without restarting the server.

---

## PHASE B — Admin Dashboard Upgrades

---

### B1 — Admin Stores Tab: Add Health Columns 🟡

**Problem:** `AdminStores.jsx` shows a stores table but is missing: `wooConnected`, `widgetInstalled`, `lastSeen`, `productCount`, and `recommendationCount`. An admin reviewing stores cannot tell which ones are actually live, connected, or using the product.

**Files to read first:**
- `server/routes/admin.js` — find `GET /api/admin/stores`; read the SQL query it runs
- `client/src/admin/AdminStores.jsx` — read the full component, especially the table columns and how store rows are mapped

**What to change:**

In `server/routes/admin.js`, `GET /api/admin/stores`:
- Extend the SQL to also return per-store: `productCount` (count from `products` table), `recommendationCount` (count from `recommendations` table)
- Add `woo_connected`, `widget_installed_at`, `widget_last_seen` to the SELECT
- Map these in the response object so the client receives: `wooConnected`, `widgetInstalled` (boolean: true if `woo_connected=1` OR `widget_installed_at IS NOT NULL`), `widgetLastSeen` (ISO string or null), `productCount` (integer), `recommendationCount` (integer)

In `AdminStores.jsx`:
- Add 3 new columns to the table after the existing plan/status columns:
  1. **Products** — show `productCount` as a number badge (gray if 0, blue if >0)
  2. **Recommends** — show `recommendationCount` (gray if 0, green if >0)
  3. **Widget** — show a status icon: green Wifi icon if `widgetInstalled`, gray WifiOff if not; below it show `widgetLastSeen` as relative time (e.g. "3d ago") using the `relTime()` helper already in `adminUi.jsx`

Use `lucide-react` icons (`Wifi`, `WifiOff`) — they are already installed. Use the existing `sd-badge` CSS classes.

**Verify:** With a store that has synced products and run at least one recommendation, confirm all three new columns show correct values.

---

### B2 — Admin Stores: Wire "View Products" Action 🟡

**Problem:** `GET /api/admin/store-products/:storeId` exists in the server but is never called from the admin UI. Admins cannot see what products a store has catalogued.

**Files to read first:**
- `server/routes/admin.js` — find `GET /api/admin/store-products/:storeId`; understand what it returns (name, category, price, stock, SKU fields)
- `client/src/admin/AdminStores.jsx` — find the existing action buttons per store row (manage, disable, delete, etc.)

**What to change:**

In `AdminStores.jsx`:
- Add a "Products" icon button (use `Package` from `lucide-react`) to each store's action column, next to existing actions
- On click, open a simple modal (use the existing modal pattern from the file, or the `sd-modal-overlay` / `sd-modal` CSS classes that already exist in `admin.css` — check first before adding new CSS) that:
  - Shows the store name in the modal header
  - Makes a `GET /api/admin/store-products/:storeId` call with the admin token
  - Shows a loading skeleton while fetching
  - Renders a table with columns: Name, Category, Price (PKR), Stock (In stock / Out of stock badge), SKU
  - Shows an empty state if the store has no products
  - Has a close button (X) in the top-right corner

No new routes needed — the endpoint already exists.

**Verify:** Click Products on a store that has items → confirm the modal lists them. Click on a store with no products → confirm the empty state renders.

---

### B3 — Replace window.prompt / window.confirm with Styled Modals 🟡

**Problem:** `AdminStores.jsx` uses `window.prompt()` to ask for a rejection reason and `window.confirm()` for delete confirmations. `AdminPayments.jsx` likely uses `window.confirm()` too. These browser-native dialogs look terrible and cannot be styled. They also block the main thread.

**Files to read first:**
- `client/src/admin/AdminStores.jsx` — search for every `window.prompt` and `window.confirm` call; note what action each one guards
- `client/src/admin/AdminPayments.jsx` — same search
- `client/src/admin/admin.css` — check for any existing modal CSS (look for `.ad-modal`, `.sd-modal`, `.modal-overlay` classes)

**What to change:**

Create a reusable `ConfirmModal` component inside `client/src/admin/adminUi.jsx` (add it to the existing exports in that file, not a new file):

```
ConfirmModal({ open, title, body, confirmLabel, confirmDanger, onConfirm, onCancel })
```

- Renders a centered overlay modal with: title, body text/content, a Cancel button and a Confirm button
- `confirmDanger=true` makes the Confirm button use `var(--red)` background
- Use existing `ad-*` CSS patterns; if no modal classes exist yet, add minimal ones to `admin.css` only

For the **rejection reason** flow in `AdminStores.jsx` (previously `window.prompt`):
- Replace with a `RejectModal` (can be a specific use of `ConfirmModal`) that includes a `<textarea>` for the reason
- The textarea value is passed to `onConfirm(reason)`

For **delete confirmations** (previously `window.confirm`):
- Replace with `ConfirmModal` showing: "Delete [store name]? This permanently removes the store, all products, and all data. This cannot be undone."
- `confirmDanger=true`

For **AdminPayments.jsx** reject action:
- Same pattern — replace `window.confirm` / `window.prompt` with the new modal

**Verify:** Trigger delete and reject flows — confirm the styled modal appears, cancel works (nothing happens), and confirm works (the action fires correctly).

---

### B4 — Pending Payment Badge on Admin Sidebar 🟡

**Problem:** The admin sidebar shows navigation items but no live badge showing how many payments are pending review. An admin only discovers pending payments when they manually click into the Payments tab.

**Files to read first:**
- `client/src/pages/Admin.jsx` — read the full sidebar nav render loop (the `NAV_GROUPS` + `ad-nav-item` section); understand the current structure
- `server/routes/admin.js` — find `GET /api/admin/overview` or equivalent; check if pending payment count is already returned there

**What to change:**

In `client/src/pages/Admin.jsx`:
- On mount (and on a 60-second interval while `isAdmin` is true), call `GET /api/admin/overview` (or the lightest endpoint that returns `pendingPayments` count) and store `pendingCount` in state
- In the sidebar nav render, for the "Payments" nav item specifically, add a badge `<span className="ad-nav-badge">{pendingCount}</span>` inside the `ad-nav-item` button — only show it if `pendingCount > 0`

In `admin.css`:
- Add `.ad-nav-badge` — a small pill, `background: #ef4444`, white text, `font-size: 0.65rem`, `font-weight: 700`, `border-radius: 999px`, `padding: 1px 6px`, `margin-left: auto`

**Verify:** Submit a test payment from a store account. Switch to admin. Confirm the Payments nav item shows a red badge with count `1`. Approve it. Confirm the badge disappears on the next poll.

---

### B5 — Admin Revenue: Monthly Bar Chart 🟡

**Problem:** `AdminRevenue.jsx` shows MRR, total approved revenue, and at-risk stores — but no trend. An admin cannot see whether revenue is growing or declining month-over-month.

**Files to read first:**
- `server/routes/adminAdvanced.js` — find the `GET /api/admin/revenue` handler; read the full SQL it runs
- `client/src/admin/AdminRevenue.jsx` — read the full component

**What to change:**

In `server/routes/adminAdvanced.js`, `GET /api/admin/revenue`:
- Add a `monthlyRevenue` array to the response:
```sql
SELECT strftime('%Y-%m', reviewed_at) AS month,
       SUM(amount) AS total
FROM payments
WHERE status = 'approved'
  AND reviewed_at >= datetime('now', '-6 months')
GROUP BY month
ORDER BY month ASC
```
- Map rows to `{ month: 'YYYY-MM', total: number }`

In `AdminRevenue.jsx`:
- Install nothing new — build a pure CSS/SVG bar chart inline (no chart library; keep the bundle small)
- After the 3 stat cards, add a "Revenue trend (last 6 months)" card
- Render a horizontal bar chart: each month is a labeled row, the bar width is `(total / maxTotal) * 100%`, colored `var(--blue)`, with the PKR amount shown at the end of each bar
- If `monthlyRevenue` is empty or all zeros, show an empty state: "No approved payments yet"

**Verify:** Approve 2–3 test payments across different months (adjust the `reviewed_at` value directly in Turso Studio for testing). Confirm the chart shows correct bars.

---

### B6 — Support Ticket Reply System 🟡

**Problem:** Admin can view tickets and change their status (open/pending/closed) but cannot reply to the store owner from within the dashboard. The only option is to send a separate email manually, which is disconnected from the ticket thread.

**Files to read first:**
- `server/routes/adminAdvanced.js` — find the support ticket endpoints (`GET /api/admin/support-tickets`, `POST /api/admin/support-tickets/:id/status`); read them fully
- `client/src/admin/AdminComms.jsx` — find the ticket table and how tickets are rendered
- `server/database.js` — look at the `support_tickets` table schema to understand existing columns

**What to change:**

In `server/database.js`, `createTables()`:
- Add a migration-safe `ALTER TABLE` pattern:
```sql
ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT DEFAULT ''
```
Wrap in a try/catch (Turso throws if column already exists — safe to ignore).

In `server/routes/adminAdvanced.js`:
- Add `POST /api/admin/support-tickets/:id/reply` (protected by `authAdmin`):
  - Accept `{ reply: string }` in body (max 2000 chars)
  - Validate non-empty
  - Update `admin_reply = ?` and `status = 'pending'` (pending means awaiting store response)
  - Send an email to the store's email: subject `"Re: [original subject]"`, body contains the admin reply
  - Return `{ success: true }`

In `AdminComms.jsx`:
- In the ticket table, below each ticket's subject/message, add a collapsed "Reply" section:
  - A small `▶ Reply` toggle button (use `MessageSquare` icon from lucide)
  - When expanded: a `<textarea>` (3 rows) + "Send reply" button
  - On submit: call the new endpoint, show success toast, collapse the textarea, reload tickets
  - If the ticket already has an `admin_reply`, show it in a quoted block above the textarea

**Verify:** Open a test ticket from a store. Send a reply from admin. Confirm the email arrives at the store email. Confirm `admin_reply` is stored and shows in the UI on next load.

---

### B7 — Pagination on Stores / Payments / Tickets 🟡

**Problem:** All three admin list endpoints use hardcoded `LIMIT 200` or similar. With real users, the admin UI becomes unusable and the API response bloats.

**Files to read first:**
- `server/routes/admin.js` — find `GET /api/admin/stores` and `GET /api/admin/payments` (or billing); read the SQL LIMIT values
- `server/routes/adminAdvanced.js` — find `GET /api/admin/support-tickets`
- `client/src/admin/AdminStores.jsx`, `AdminPayments.jsx`, `AdminComms.jsx` — understand how each list is fetched and rendered

**What to change:**

For all three endpoints — add offset-based pagination:
- Accept `?page=1&limit=50` query params (default: page 1, limit 50)
- Return `{ items: [...], total: N, page: N, pages: N }` alongside the existing response fields
- SQL: add `LIMIT ? OFFSET ?` where `offset = (page - 1) * limit`

For all three client components — add a simple pagination footer below each table:
- Show "Showing X–Y of Z" text
- Previous / Next buttons (disabled at boundaries)
- Page number buttons if `pages <= 7`, else show first/last + ellipsis
- On page change: re-fetch with new `?page=N` param

Use existing `sd-table-wrap` and `btn btn-ghost` CSS classes for the pagination row. No new CSS needed.

**Verify:** Seed 60+ test stores. Confirm the Stores tab shows 50 on page 1, 10+ on page 2. Test Previous/Next.

---

## PHASE C — Store Dashboard Upgrades

---

### C2 — Analytics Tab: Replace CSS Bars with Recharts 🟡

**Problem:** `AnalyticsTab.jsx` renders a bar chart using CSS width percentages. With more than 7 days of data it becomes cramped and unreadable — no Y-axis, no hover tooltips, no scaling.

**Files to read first:**
- `client/src/dashboard/AnalyticsTab.jsx` — full file; find the `dailyActivity` rendering section; understand the data shape (`{ day: 'YYYY-MM-DD', count: number }[]`)
- `client/package.json` — check if `recharts` is already installed

**What to change:**

If `recharts` is not installed: `npm install recharts` in the `client/` directory.

Replace the CSS bar chart section in `AnalyticsTab.jsx` with a `<ResponsiveContainer>` + `<BarChart>` from Recharts:
- Data: `dailyActivity` array; x-axis key `day`, value key `count`
- Format x-axis tick labels to show "Jun 12" style (short month + day), not the full ISO string
- `<Bar>` fill: `var(--blue)` (`#2A5EE8`)
- Add `<Tooltip>` with a custom formatter that shows "N recommendations" on hover
- Add `<CartesianGrid strokeDasharray="3 3" stroke="var(--border)"` />
- Height: 220px via `<ResponsiveContainer height={220}>`
- If `dailyActivity` is empty or all zeros: show the existing `<EmptyState>` component instead of the chart

Do not install any other chart library. Only use Recharts.

**Verify:** With at least 3 days of recommendation data, confirm the chart renders with bars, correct dates on x-axis, and a tooltip on hover.

---

### C3 — Help Tab: Show Ticket ID After Submission 🟡

**Problem:** When a store owner submits a support ticket, the server returns a `ticketId` in the response, but `HelpTab.jsx` ignores it and shows a generic "Ticket submitted" message. The store owner has no reference number.

**Files to read first:**
- `client/src/dashboard/HelpTab.jsx` — find the `submit()` function and the success message render
- `server/routes/adminAdvanced.js` or `store.js` — find `POST /api/support`; confirm `ticketId` is in the response

**What to change:**

In `HelpTab.jsx`, `submit()`:
- Capture the `ticketId` from the API response
- Set `ok` to: `"Ticket #${ticketId} submitted — we'll reply within 24 hours. Keep this number for reference."`

That's the entire change. One line.

**Verify:** Submit a support ticket. Confirm the success message includes a real ticket number like "Ticket #7 submitted".

---

### C4 — EmbedTab: Seed Installation Status from Server 🟡

**Problem:** The "Confirm installation" state in `EmbedTab.jsx` is stored in `localStorage`. If the store owner logs in from a different browser or clears storage, the installation banner resets to "not installed" even though the server already knows the widget is active (via `widget_installed_at` or `widget_last_seen`).

**Files to read first:**
- `client/src/dashboard/EmbedTab.jsx` — read the `isLive` state initialization and `confirmInstall()` function
- `client/src/lib/widgetStatus.js` — read `isWidgetInstalled()` — understand how it currently derives installed status
- `server/routes/store.js` — check if `POST /api/widget-ping/:storeId` or `PUT /api/widget-installed` exists; if not, you need to add a lightweight endpoint

**What to change:**

The `store` prop passed to `EmbedTab` already includes `widgetInstalledAt` and `widgetLastSeen` (from `publicStore()` in `lib/auth.js`). The client just isn't using them to seed state correctly.

In `EmbedTab.jsx`:
- Change the `isLive` initial state from `() => isWidgetInstalled(store)` (which uses localStorage) to:
```js
const [isLive, setIsLive] = useState(
  () => !!(store?.widgetInstalledAt || store?.widgetLastSeen) || isWidgetInstalled(store)
)
```
- In `confirmInstall()`, after setting localStorage, also call `PUT /api/widget-installed` (a new lightweight endpoint) with `{ confirmed: true }` so the server sets `widget_installed_at = datetime('now')` if it's null

In `server/routes/store.js`:
- Add `PUT /api/widget-installed` (protected by `authStore`):
  - If `widget_installed_at` is already set, do nothing (idempotent)
  - Otherwise: `UPDATE stores SET widget_installed_at = datetime('now') WHERE id = ?`
  - Return `{ success: true }`

**Verify:** Confirm installation in browser A. Open in browser B (or incognito). Confirm the banner shows "installed" immediately because the server state was read, not localStorage.

---

### C5 — Trial Expiry Email: Day-0 Cron Email 🟡

**Problem:** `cron.js` sends drip emails during the trial and renewal reminders — but there is no email sent at the exact moment a trial expires (day 0). A store owner whose trial ends silently is likely to churn rather than upgrade.

**Files to read first:**
- `server/cron.js` — read the full file; understand the drip email logic and how stores are queried
- `server/email.js` — see what email helper functions exist; find `welcomeEmailContent`, `trialReminderEmailContent`, etc.

**What to change:**

In `server/email.js`:
- Add a `trialExpiredEmailContent({ email, storeId, appUrl })` function that returns `{ subject, text, html }`:
  - Subject: "Your BuildBot trial has ended"
  - Body: friendly message explaining the widget is now paused, with a direct link to `/dashboard` → Billing tab to upgrade; mention that all data is preserved

In `server/cron.js`, inside the cron job function:
- Add a new query: stores where `plan = 'trial'` AND `trial_ends` is between `datetime('now', '-2 hours')` AND `datetime('now')` AND `drip_emails_paused = 0` AND no `trial_expired_email_sent_at` (need a new column — see below)
- For each matched store: send `trialExpiredEmailContent`, then mark `trial_expired_email_sent_at = datetime('now')` so it only fires once

In `server/database.js`, `createTables()`:
- Add migration-safe: `ALTER TABLE stores ADD COLUMN trial_expired_email_sent_at TEXT DEFAULT NULL` (wrap in try/catch)

**Verify:** Create a test store, set `trial_ends` to 1 minute from now in Turso Studio. Wait for cron to fire (or call `POST /api/admin/run-drip` to trigger manually). Confirm the email arrives and `trial_expired_email_sent_at` is set.

---

## PHASE D — Widget Upgrades

---

### D1 — Widget: Screen Transition Animations 🟢

**Problem:** The widget switches between screens (Welcome → Budget → Purpose → Extras → Loading → Results) with no animation. It feels abrupt and cheap.

**Files to read first:**
- `server/widget.js` — find how screen transitions work; look for `showScreen()` or equivalent function that shows/hides screens; understand the DOM structure
- `server/widget.css` — find existing `.bb-screen` styles

**What to change:**

In `server/widget.css`:
- Add a fade + slide-up animation:
```css
@keyframes bb-screen-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.bb-screen.bb-screen-entering {
  animation: bb-screen-in 0.22s ease forwards;
}
```
- Ensure `@media (prefers-reduced-motion: reduce)` removes the animation:
```css
@media (prefers-reduced-motion: reduce) {
  .bb-screen.bb-screen-entering { animation: none; }
}
```

In `server/widget.js`:
- In `showScreen()` (or wherever screens are toggled), after making the new screen visible:
  - Remove the `bb-screen-entering` class from all screens first
  - Add `bb-screen-entering` to the newly shown screen
  - Use `requestAnimationFrame` to ensure the class is applied after the browser paints

That's all. Keep it surgical — only touch `showScreen()` and the CSS. Don't restructure widget logic.

**Verify:** Open `/widget-test?storeId=...`. Click Get Started and progress through screens. Confirm each screen fades in smoothly. Enable reduced-motion in OS settings and confirm no animation plays.

---

### D2 — Widget: Custom SVG Launcher Button 🟢

**Problem:** The widget launcher button shows `⚡` emoji text. Emoji rendering varies across OS/browser and looks unfinished for a commercial product.

**Files to read first:**
- `server/widget.js` — find where the launcher button is created (look for `⚡` or the button innerHTML)
- `server/widget.css` — find `.bb-launcher` styles

**What to change:**

In `server/widget.js`, replace the `⚡` emoji with an inline SVG — a minimal "robot/bot" or "spark" icon that fits the BuildBot brand. Use this SVG (or design a cleaner one that matches the navy/blue `#2A5EE8` theme):

```html
<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="8" width="16" height="11" rx="3" stroke="white" stroke-width="1.8"/>
  <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="9" cy="13" r="1.2" fill="white"/>
  <circle cx="15" cy="13" r="1.2" fill="white"/>
  <path d="M9.5 16.5h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

In `server/widget.css`, update `.bb-launcher`:
- Remove any `font-size` targeting the emoji
- Add `display: flex; align-items: center; justify-content: center;`
- Ensure `width` and `height` are explicitly set (e.g. `52px × 52px`)

**Verify:** Open the widget test page. Confirm the launcher shows the SVG icon cleanly at all zoom levels. Compare on Chrome + Firefox + Safari.

---

### D3 — Widget: PDF Without CDN Popup 🟢

**Problem:** The PDF download uses `html2pdf.js` loaded from a CDN at runtime, which opens a new popup window. Most browsers block popups by default, giving users a confusing broken experience.

**Files to read first:**
- `server/widget.js` — find the PDF download logic; search for `html2pdf`, `window.open`, or `cdn` references; understand what content is being printed (the builds list / recommendation result)

**What to change:**

Remove the `html2pdf` CDN script entirely. Replace with a pure browser print approach:

In `server/widget.js`, replace the PDF download function with:
```js
function downloadPdf() {
  const printWin = window.open('', '_blank', 'width=800,height=600')
  if (!printWin) {
    // Fallback if popup blocked: use window.print() on the current page with a print stylesheet
    window.print()
    return
  }
  printWin.document.write(`
    <!DOCTYPE html><html><head>
    <title>BuildBot Recommendation</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; color: #0A1A2D; }
      h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
      .build { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
      .build-name { font-weight: 700; font-size: 1.1rem; }
      .build-price { color: #2A5EE8; font-weight: 600; }
      .item { display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    </style>
    </head><body>
    ${buildsPrintHtml()}
    </body></html>
  `)
  printWin.document.close()
  printWin.focus()
  printWin.print()
  printWin.close()
}
```

Write a `buildsPrintHtml()` helper that generates the HTML string from the current builds in memory (the same data already used to render the results screen).

Add a `@media print` block to `widget.css` that hides the widget overlay if `window.print()` fallback is triggered.

**Verify:** Click "Download PDF" on the results screen. Confirm it opens a clean print dialog (not a CDN script load). Test in Chrome with popups blocked — confirm the fallback `window.print()` fires instead.

---

### D4 — Widget: "Share This Build" Clipboard Button 🟢

**Problem:** When shoppers get their PC build recommendations, there's no way to share or save the result — not to a friend, not to come back later. A share button increases the widget's virality and usefulness.

**Files to read first:**
- `server/widget.js` — find the results screen render; understand how builds are displayed; find where buttons (like Download PDF) are currently placed in the results UI

**What to change:**

In `server/widget.js`, on the results screen:
- Add a "Copy build summary" button next to the existing Download PDF button
- On click: build a plain-text summary string:
```
BuildBot Recommendation for [purpose] — Budget: PKR [amount]

Build 1: [name] — PKR [total]
  CPU: [name] — PKR [price]
  GPU: [name] — PKR [price]
  ...

Build 2: ...
```
- Use `navigator.clipboard.writeText(summary)` — no external dependency
- Button label changes to "Copied!" for 2 seconds after success, then reverts
- If `navigator.clipboard` is unavailable (non-HTTPS or older browser): fall back to `document.execCommand('copy')` with a temporary textarea

In `server/widget.css`:
- Style the copy button to match the PDF button (same class, or a new `.bb-btn-ghost` style)

**Verify:** On the results screen, click Copy. Paste in a text editor — confirm it contains the build names, components, and prices. Test on HTTP (localhost) to confirm the fallback fires.

---

## PHASE E — Production Readiness

---

### E1 — Branded HTML Email Templates 🟡

**Problem:** All emails sent by BuildBot (verification, welcome, payment approved/rejected, trial reminder, trial expired) are plain text or raw inline HTML with no branding. They look like spam. Resend renders HTML emails properly.

**Files to read first:**
- `server/email.js` — read the full file; identify every email content function (`verificationEmailContent`, `welcomeEmailContent`, `passwordResetEmailContent`, `trialReminderEmailContent`, etc.) and the `sendEmail()` function itself; understand how `html` is currently passed to Resend

**What to change:**

Create a single HTML template wrapper in `server/email.js`:

```js
function emailShell(bodyHtml) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { margin:0; background:#F8FAFC; font-family: system-ui, -apple-system, sans-serif; color:#0A1A2D; }
    .wrapper { max-width:560px; margin:2rem auto; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #E2E8F0; }
    .header { background:linear-gradient(135deg,#0A1A2D,#1a3050); padding:1.5rem 2rem; }
    .logo { color:#fff; font-size:1.4rem; font-weight:800; letter-spacing:-0.02em; }
    .logo span { color:#2A5EE8; }
    .body { padding:2rem; }
    h1 { font-size:1.3rem; font-weight:700; margin:0 0 0.75rem; }
    p { font-size:0.95rem; line-height:1.6; color:#334155; margin:0 0 1rem; }
    .btn { display:inline-block; background:#2A5EE8; color:#fff; text-decoration:none; padding:0.75rem 1.5rem; border-radius:8px; font-weight:600; font-size:0.95rem; margin:0.5rem 0 1rem; }
    .code { background:#F1F5F9; border-radius:8px; padding:1rem 1.5rem; font-size:1.6rem; font-weight:800; letter-spacing:0.15em; color:#0A1A2D; text-align:center; margin:1rem 0; }
    .footer { padding:1rem 2rem; background:#F8FAFC; border-top:1px solid #E2E8F0; font-size:0.8rem; color:#94A3B8; }
    .muted { color:#64748B; font-size:0.88rem; }
  </style></head>
  <body><div class="wrapper">
    <div class="header"><div class="logo">Build<span>Bot</span></div></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">BuildBot · You're receiving this because you signed up at build-volt.vercel.app · <a href="#" style="color:#94A3B8">Unsubscribe</a></div>
  </div></body></html>`
}
```

Then rewrite every `*EmailContent()` function's `html` return value to use `emailShell(...)` with properly structured inner HTML. Cover all of:
1. `verificationEmailContent` — OTP code in `.code` block + verify link button
2. `welcomeEmailContent` — welcome heading, 3-step getting started list, link to dashboard
3. `passwordResetEmailContent` — reset link button, expires-in note
4. `trialReminderEmailContent` — days remaining, upgrade CTA button
5. `trialExpiredEmailContent` — from C5 above — widget paused notice, upgrade CTA
6. Admin notification emails (`admin_new_store`, `admin_new_payment`) — simple table with the relevant details
7. `adminPasswordResetEmailContent` — same pattern as store reset

Do NOT change the `sendEmail()` function signature, the `text` field, or any route that calls these functions — only the `html` return values change.

**Verify:** Trigger a signup with real email. Confirm the verification email renders with the BuildBot header, blue OTP code block, and footer in your email client. Check Gmail (clip test), Apple Mail, and Outlook if possible.

---

### E2 + E3 — SEO Meta Tags + Favicon 🟡

**Problem:** `client/index.html` has no `og:image`, no meta description, no `robots.txt`, no `sitemap.xml`, and no favicon. The site is invisible to search engines and looks broken when shared on social media.

**Files to read first:**
- `client/index.html` — read the current `<head>` section
- `client/public/` — list contents to see what static files already exist

**What to change:**

**Favicon** — create a simple SVG favicon:
- Create `client/public/favicon.svg` — a 32×32 SVG with the letter "B" in `#2A5EE8` on a `#0A1A2D` background with rounded corners
- Add to `client/index.html` `<head>`:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" href="/favicon.png">
```

**Meta tags** — add to `client/index.html` `<head>`:
```html
<meta name="description" content="BuildBot — AI-powered PC component recommendation widget for WooCommerce stores. Let shoppers find the perfect PC build in minutes.">
<meta property="og:title" content="BuildBot — AI PC Recommendations for Your Store">
<meta property="og:description" content="Add an AI shopping assistant to your WooCommerce store. Shoppers answer 3 questions, AI recommends the perfect PC build from your catalog.">
<meta property="og:image" content="https://build-volt.vercel.app/og-image.png">
<meta property="og:url" content="https://build-volt.vercel.app">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="BuildBot — AI PC Recommendations for WooCommerce">
<meta name="twitter:description" content="Let shoppers find their perfect PC in 60 seconds. Powered by Claude AI.">
```

**OG Image** (`client/public/og-image.png`):
- Create a 1200×630 PNG using an HTML canvas approach, or design it as an SVG and export — must show BuildBot logo + tagline on the dark navy background. If you cannot generate a PNG from code, create an SVG at `client/public/og-image.svg` and reference that in the og:image tag instead.

**robots.txt** — create `client/public/robots.txt`:
```
User-agent: *
Allow: /
Sitemap: https://build-volt.vercel.app/sitemap.xml
```

**sitemap.xml** — create `client/public/sitemap.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://build-volt.vercel.app/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://build-volt.vercel.app/signup</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://build-volt.vercel.app/login</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
</urlset>
```

**Verify:** Build the client (`npm run build`). Open the built `dist/index.html` and confirm meta tags are present. Visit `https://build-volt.vercel.app/robots.txt` after deploy and confirm it responds.

---

### E5 — CORS: Lock Down Allowed Origins 🔴

**Problem:** `server/index.js` has `app.use(cors({ origin: true, credentials: true }))`. `origin: true` reflects any origin — every domain in the world can make credentialed requests to your API. This is a security vulnerability in production.

**Files to read first:**
- `server/index.js` — find the `cors()` middleware call

**What to change:**

Replace `origin: true` with an explicit allowlist:

```js
const ALLOWED_ORIGINS = [
  process.env.APP_URL,           // https://build-volt.vercel.app
  'http://localhost:5173',       // local dev
  'http://127.0.0.1:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, widget.js beacon, plugin PHP)
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin not allowed — ${origin}`))
  },
  credentials: true,
}))
```

**Important:** The widget `POST /api/recommend` and `GET /api/store-config` are called from arbitrary shop domains. These specific routes must NOT use credentials and should allow `*`. Add a second, open CORS middleware only for widget routes:

```js
// Widget endpoints — open CORS, no credentials
app.use(['/api/recommend', '/api/store-config', '/api/widget-ping'], cors({ origin: '*' }))
```

Apply this before the restrictive CORS middleware so it takes precedence for those paths.

**Verify:** From the browser console on `https://some-other-site.com`, attempt a fetch to `/api/login`. Confirm it is rejected with a CORS error. From the same console, attempt a fetch to `/api/recommend`. Confirm it succeeds.

---

### E6 — Terms of Service + Privacy Policy Pages 🟡

**Problem:** BuildBot accepts payments. Having no ToS or Privacy Policy is a legal liability and blocks use of many payment processors. There are also no links to these pages from the landing page or signup flow.

**Files to read first:**
- `client/src/App.jsx` — find the router; understand how routes are added
- `client/src/landing/Footer.jsx` — find where footer links are listed
- `client/src/pages/Signup.jsx` — find where to add the "I agree to Terms" checkbox

**What to change:**

Create two new pages:

`client/src/pages/Terms.jsx` — Terms of Service page:
- Use `AuthLayout` shell (just the right panel, no split) OR a simple centered `.legal-page` layout
- Content: standard SaaS ToS covering: service description, payment terms (non-refundable after approval, manual approval process), account termination, limitation of liability, governing law (Pakistan), contact email from `process.env.VITE_SUPPORT_EMAIL` (or hardcode `workwithneehal@gmail.com`)
- No need for a lawyer — write reasonable plain-English terms appropriate for a small Pakistani SaaS

`client/src/pages/Privacy.jsx` — Privacy Policy page:
- Same layout
- Content: what data is collected (email, store name, payment reference, recommendation history), how it's stored (Turso cloud database), who it's shared with (Resend for email delivery, Anthropic for AI processing), how to request deletion (email the admin)

In `client/src/App.jsx`:
- Add `<Route path="/terms" element={<Terms />} />`
- Add `<Route path="/privacy" element={<Privacy />} />`

In `client/src/landing/Footer.jsx`:
- Add links: Terms of Service → `/terms`, Privacy Policy → `/privacy`

In `client/src/pages/Signup.jsx`:
- Add a checkbox below the password field: "I agree to the [Terms of Service] and [Privacy Policy]" — both are links that open in a new tab
- Make the checkbox required (form won't submit without it)
- Add `tosAccepted: boolean` to the signup state; only send the request if `tosAccepted === true`

**Verify:** Click Terms link in footer → confirm the page renders. Attempt to sign up without checking the ToS box → confirm the form blocks submission.

---

### E7 — Input Sanitization on Free-Text Fields 🔴

**Problem:** Several API routes accept free-text input (admin notes, support ticket subject/message, store name, widget title, welcome message) with only length truncation — no XSS or injection sanitization. While Turso uses parameterized queries (so SQL injection is already handled), stored values are rendered in the admin dashboard via React (which escapes HTML by default) — BUT the widget injects `welcomeMsg` directly into innerHTML, creating a stored XSS vector.

**Files to read first:**
- `server/widget.js` — search for `innerHTML` assignments; find every place a server-provided string is injected into the DOM
- `server/routes/store.js` — find `PUT /api/widget-settings`; look at how `welcomeMsg`, `widgetTitle`, `buttonText` are saved
- `server/routes/adminAdvanced.js` — find the support ticket and admin notes endpoints

**What to change:**

In `server/widget.js`:
- Replace every `element.innerHTML = serverValue` with `element.textContent = serverValue`
- Exception: if the welcome message or any field intentionally supports bold/italic markdown, use a tiny safe renderer — but for now, treat all values as plain text

In `server/routes/store.js` and `server/routes/adminAdvanced.js`:
- Add a `sanitizeText(str)` helper at the top of each file:
```js
function sanitizeText(str, maxLen = 500) {
  return String(str || '').replace(/[<>"'&]/g, '').trim().slice(0, maxLen)
}
```
- Apply `sanitizeText()` to: `welcome_msg`, `widget_title`, `button_text` (in widget-settings), `subject` + `message` (in support tickets), `admin_notes` (in admin store management)
- This is defense-in-depth — React already escapes on render, but widget.js does not

**Verify:** Save a widget title containing `<script>alert(1)</script>`. Open the widget test page. Confirm the script tag is rendered as plain text, not executed.

---

## FINAL CHECKLIST — Before Going Live

Run through this in order after all phases above are done:

### Security
- [ ] CORS locked to allowed origins (E5)
- [ ] JWT expiry set (done — `7d` store, `1d` admin)
- [ ] Rate limiting on auth endpoints (done — `express-rate-limit`)
- [ ] Input sanitization on widget innerHTML (E7)
- [ ] `TEST_MODE=false` in Railway
- [ ] `ANTHROPIC_API_KEY` set in Railway (non-empty)

### Email
- [ ] `RESEND_API_KEY` set in Railway
- [ ] `EMAIL_TEST_MODE=false` in Railway
- [ ] HTML email templates deployed (E1)
- [ ] Send a test signup → verify email arrives and renders correctly

### Core Features
- [ ] Plugin ZIP uses production `PUBLIC_API_URL` (A3)
- [ ] `CRON_ENABLED=true` in Railway
- [ ] Trial expiry email fires (C5)
- [ ] Budget presets editor works end-to-end (A6)

### UI / UX
- [ ] Styled modals replace window.prompt/confirm (B3)
- [ ] Pending payment badge in admin nav (B4)
- [ ] Widget transitions smooth (D1)
- [ ] Widget launcher SVG icon (D2)
- [ ] Analytics chart renders (C2)
- [ ] Help tab shows ticket ID (C3)

### Legal / SEO
- [ ] Favicon shows in browser tab (E2+E3)
- [ ] OG meta tags set (E2+E3)
- [ ] ToS + Privacy Policy pages live (E6)
- [ ] Footer links to ToS + Privacy (E6)
- [ ] Signup requires ToS acceptance (E6)
- [ ] robots.txt returns 200 (E2+E3)

### Deploy
- [ ] `npm run build` in `client/` — clean, no errors
- [ ] Railway redeploy triggered after env var changes
- [ ] Vercel redeploy triggered after client build
- [ ] Health endpoint `GET https://build-volt-production.up.railway.app/` returns `ok: true, phase: 11`
- [ ] Admin login works at `https://build-volt.vercel.app/admin`
- [ ] One full E2E test: signup → verify → setup → products → widget → admin approve payment → widget active
