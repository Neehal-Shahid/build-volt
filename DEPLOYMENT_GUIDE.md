# BuildBot — A to Z Deployment Guide
### For non-coders. Every step. Every click. Every paste.

Read this file from top to bottom. Do each step in order. Do not skip any step.

---

# STEP 0 — OPEN NOTEPAD FIRST

Before anything, open **Notepad** on your computer.  
You will be copying and saving important values here throughout this guide.  
Label each value clearly as you go.

---

# STEP 1 — CREATE 6 ACCOUNTS

Create these accounts in order. All are free (or have free tiers).

**Account 1: GitHub** — go to `github.com` → click Sign up

**Account 2: Turso** — go to `turso.tech` → click Start for free → use GitHub login

**Account 3: Anthropic** — go to `console.anthropic.com` → click Sign Up

**Account 4: Resend** — go to `resend.com` → click Sign Up

**Account 5: Railway** — go to `railway.app` → click Login → Login with GitHub

**Account 6: Vercel** — go to `vercel.com` → click Sign Up → Continue with GitHub

---

# STEP 2 — GITHUB: Create Repository + Token

### Create the repository
1. Log into github.com
2. Click the **+** button (top right)
3. Click **New repository**
4. Repository name: `buildbot`
5. Click **Private**
6. Click **Create repository**
7. Copy the URL shown (like `https://github.com/YourName/buildbot.git`)
8. **Paste in Notepad → label it `GITHUB_URL`**

### Create a token (this is your "password" for pushing code)
1. Click your profile picture (top right) → **Settings**
2. Scroll to the very bottom of the left menu → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token (classic)**
5. Note: `buildbot` | Expiration: `No expiration`
6. Check the box next to **repo**
7. Click **Generate token**
8. Copy the token (starts with `ghp_...`)
9. **Paste in Notepad → label it `GITHUB_TOKEN`**

---

# STEP 3 — PUSH CODE TO GITHUB

Open File Explorer → go to `H:\8th Semester\FYP\build-Bolt`

Right-click in an empty area → **Open in Terminal** (or **Open PowerShell window here**)

Run these commands one at a time (press Enter after each, wait for it to finish):

```
git init
```
```
git add .
```
```
git commit -m "initial deployment"
```
```
git branch -M main
```

Replace `YourName` below with your GitHub username:
```
git remote add origin https://github.com/YourName/buildbot.git
```
```
git push -u origin main
```

- When it asks **Username**: type your GitHub username → Enter
- When it asks **Password**: paste your `ghp_...` token → Enter (nothing shows on screen — that is normal)

### Verify:
Go to `https://github.com/YourName/buildbot` — you should see `client`, `server`, `plugin` folders.
Click the `server` folder — confirm there is **no `.env` file** inside.

---

# STEP 4 — TURSO: Cloud Database

1. Log into turso.tech
2. Click **Create Database**
3. Name: `buildbot-production` | Location: **Singapore**
4. Click **Create** — wait 10 seconds

**Get the URL:**
1. Click `buildbot-production`
2. Click the **Connect** tab
3. Copy the URL (like `libsql://buildbot-production-yourname.turso.io`)
4. **Paste in Notepad → label it `TURSO_URL`**

**Get the Token:**
1. Click **Create Token**
2. Name: `railway` | Expiration: `Never expire`
3. Click **Create Token**
4. Copy the long token (starts with `eyJ...`)
5. **Paste in Notepad → label it `TURSO_TOKEN`**
   > ⚠️ Only shown ONCE — copy it before closing the page!

---

# STEP 5 — ANTHROPIC: AI API Key

1. Log into console.anthropic.com
2. Click **Billing** (left menu) → **Add payment method** → add your card → Save
3. Click **API Keys** (left menu)
4. Click **Create Key** | Name: `buildbot`
5. Copy the key (starts with `sk-ant-api03-...`)
6. **Paste in Notepad → label it `ANTHROPIC_API_KEY`**

---

# STEP 6 — RESEND: Email API Key

1. Log into resend.com
2. Click **API Keys** (left menu)
3. Click **Create API Key** (top right)
4. Name: `buildbot` | Permission: `Full access`
5. Click **Add**
6. Copy the key (starts with `re_...`)
7. **Paste in Notepad → label it `RESEND_API_KEY`**

---

# STEP 7 — GENERATE A JWT SECRET

In your PowerShell terminal (still open from Step 3), run:

```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the long string it outputs.
**Paste in Notepad → label it `JWT_SECRET`**

---

# STEP 8 — RAILWAY: Deploy Backend

### Create project
1. Log into railway.app
2. Click **New Project** (top right)
3. Click **Deploy from GitHub repo**
4. Find `buildbot` → click it → click **Deploy Now**

### Set the server folder (CRITICAL)
1. Click on the service box that appears
2. Click **Settings** tab
3. Scroll to **Build & Deploy**
4. **Root Directory** → type: `server`
5. **Start Command** → type: `npm start`
6. **Build Command** → type: `npm install`
7. Click **Save**

### Add environment variables
1. Click the **Variables** tab
2. Click **Raw Editor**
3. Delete everything in it
4. Paste the block below (replace every `PASTE_YOUR_...` with values from your Notepad):

```
TURSO_URL=PASTE_YOUR_TURSO_URL
TURSO_TOKEN=PASTE_YOUR_TURSO_TOKEN
JWT_SECRET=PASTE_YOUR_JWT_SECRET
APP_URL=https://FILL_THIS_AFTER_GETTING_RAILWAY_URL.up.railway.app
ANTHROPIC_API_KEY=PASTE_YOUR_ANTHROPIC_KEY
ANTHROPIC_MODEL=claude-haiku-4-5
ANTHROPIC_MAX_TOKENS=4096
RESEND_API_KEY=PASTE_YOUR_RESEND_KEY
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_EMAIL_4TEST=PASTE_YOUR_PERSONAL_EMAIL@gmail.com
EMAIL_TEST_MODE=false
TEST_MODE=false
CRON_ENABLED=true
ADMIN_EMAIL=PASTE_YOUR_ADMIN_EMAIL@gmail.com
ADMIN_PASSWORD=PASTE_A_STRONG_PASSWORD
PORT=3001
```

5. Click **Update Variables**

### Get Railway URL
1. Click **Settings** tab
2. Scroll to **Networking**
3. Click **Generate Domain**
4. Copy the URL (like `buildbot-production-xxxx.up.railway.app`)
5. **Paste in Notepad → label it `RAILWAY_URL`**

### Update APP_URL
1. Click **Variables** tab
2. Find `APP_URL` → click the edit/pencil icon
3. Change it to: `https://buildbot-production-xxxx.up.railway.app`
4. Save

### Verify backend works
Open your browser → go to: `https://buildbot-production-xxxx.up.railway.app/`

You should see:
```
{ "ok": true, "service": "buildbot-api", "db": { "admins": 1 } }
```

✅ Backend is working!

If you see an error: Railway → **Logs** tab → read the error. Usually `TURSO_URL` or `TURSO_TOKEN` is wrong.

---

# STEP 9 — VERCEL: Deploy Frontend

### Create project
1. Log into vercel.com
2. Click **Add New...** → **Project**
3. Find `buildbot` → click **Import**

### Configure (CRITICAL — all 3 sub-steps)

**Sub-step 1 — Framework:**
- Click **Framework Preset** dropdown → select **Vite**

**Sub-step 2 — Root Directory:**
- Click **Edit** next to Root Directory
- Type: `client`
- Click **Continue**

**Sub-step 3 — Environment Variable:**
- Scroll down to **Environment Variables**
- Click **Add**
- Name: `VITE_API_URL`
- Value: `https://buildbot-production-xxxx.up.railway.app`
  (your Railway URL — no slash at the end)
- Click **Add**

### Deploy
Click the big blue **Deploy** button → wait 2-3 minutes

When you see "🎉 Congratulations!" — your website is live!

Copy the URL (like `https://buildbot-yourname.vercel.app`)
**Paste in Notepad → label it `VERCEL_URL`**

---

# STEP 10 — UPDATE APP_URL TO VERCEL URL

Email links (like verify link) should point to your website, not Railway:

1. Go to railway.app → your project → **Variables** tab
2. Find `APP_URL` → edit it
3. Change to your Vercel URL: `https://buildbot-yourname.vercel.app`
4. Save

---

# STEP 11 — TEST EVERYTHING

### Test 1 — Sign up and receive email
1. Go to `https://buildbot-yourname.vercel.app/signup`
2. Enter a real email you can check
3. Password must have: uppercase letter, lowercase letter, number, and `!` or similar
4. Click **Sign Up**
5. Check your email inbox (the email you put as `RESEND_EMAIL_4TEST`)
6. You receive a 6-digit code
7. Enter it on the verify page → set store name → Dashboard opens ✅

### Test 2 — Real AI recommendation
1. Dashboard → **My Store** → click **Manual / CSV**
2. Click **Products** → **Add product**:
   - Name: `Intel Core i5-12400F` | Category: `CPU` | Price: `28000` | Stock: ✅
3. Add 3-4 more products (GPU 40000, RAM 8000, Storage 12000)
4. Go to **My Store** → copy your **Store ID**
5. Open in browser (replace the two values):
   ```
   https://RAILWAY_URL.up.railway.app/widget-test?storeId=YOUR_STORE_ID
   ```
6. Click the floating button (bottom right)
7. Budget: `80000` → Purpose: `Gaming` → Get Started
8. Wait 5 seconds → 3 AI PC builds appear ✅

### Test 3 — Admin panel
1. Go to `https://buildbot-yourname.vercel.app/admin`
2. Email: what you put as `ADMIN_EMAIL` in Railway
3. Password: what you put as `ADMIN_PASSWORD` in Railway
4. Sign in → Admin dashboard opens ✅

### Test 4 — Billing and approval
1. Store dashboard → **Billing** → select a plan
2. Click **Submit via JazzCash** → enter reference: `TEST123`
3. Submit → appears as pending
4. Admin panel → **Payments** → click **Approve**
5. Check email inbox → approval email arrives ✅

---

# FUTURE: How to push code changes

Every time you change any code, run these 3 commands from `H:\8th Semester\FYP\build-Bolt`:

```
git add .
git commit -m "describe your change here"
git push
```

Railway and Vercel update automatically in ~2 minutes.

---

# COMPLETE REFERENCE (fill in as you collect values)

```
GITHUB_URL      = https://github.com/________/buildbot.git
GITHUB_TOKEN    = ghp_________________________________

TURSO_URL       = libsql://buildbot-production-_______.turso.io
TURSO_TOKEN     = eyJ___________________________________

ANTHROPIC_KEY   = sk-ant-api03-______________________

RESEND_KEY      = re____________________________________

JWT_SECRET      = (the long hex string from Step 7)

RAILWAY_URL     = https://buildbot-production-____.up.railway.app
VERCEL_URL      = https://buildbot-____________.vercel.app

ADMIN_EMAIL     = _______________________________
ADMIN_PASSWORD  = _______________________________
```

---

# TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| `git push` fails | Use `ghp_...` token as password (not your GitHub password) |
| Railway deploy fails | Railway → Logs tab → read the error |
| Railway URL shows error | `TURSO_URL` or `TURSO_TOKEN` is wrong — copy from Turso again |
| Vercel build fails | Check Root Directory is set to `client` |
| Login says Unauthorized | `JWT_SECRET` has a space or typo — re-paste carefully |
| No email arrives | Check `RESEND_API_KEY` is correct and `RESEND_EMAIL_4TEST` is your email |
| Widget shows no AI builds | Railway → Logs → look for `[recommend]` errors |
| Admin login fails | Use exact values from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Railway |
