import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'

let db = null

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

export async function initDB() {
  const url = process.env.TURSO_URL
  if (!url) {
    throw new Error('TURSO_URL is missing. Set it in server/.env')
  }

  const isFile = url.startsWith('file:')
  db = createClient({
    url,
    authToken: isFile ? undefined : process.env.TURSO_TOKEN,
  })

  await db.execute('SELECT 1')

  await createTables()
  await seedPlatformConfig()
  await seedAdmin()

  return db
}

async function createTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS pending_signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      otp TEXT,
      verify_token TEXT,
      marketing_opt_in INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT DEFAULT '',
      plan TEXT DEFAULT 'trial',
      plan_ends TEXT,
      trial_started_at TEXT,
      trial_ends TEXT,
      active INTEGER DEFAULT 1,
      disabled INTEGER DEFAULT 0,
      email_verified INTEGER DEFAULT 0,
      widget_enabled INTEGER DEFAULT 1,
      brand_color TEXT DEFAULT '#2A5EE8',
      currency TEXT DEFAULT 'PKR',
      widget_title TEXT DEFAULT 'BuildBot',
      welcome_msg TEXT DEFAULT 'Tell us your budget and what you need the PC for — we will recommend builds from this store.',
      button_text TEXT DEFAULT 'Get Started',
      widget_bg TEXT DEFAULT '#0A1A2D',
      budget_presets TEXT DEFAULT '[50000,80000,120000,200000]',
      woo_connected INTEGER DEFAULT 0,
      plugin_secret TEXT,
      woo_last_sync TEXT,
      google_id TEXT,
      marketing_opt_in INTEGER DEFAULT 1,
      drip_emails_paused INTEGER DEFAULT 0,
      admin_notes TEXT DEFAULT '',
      abuse_flag INTEGER DEFAULT 0,
      catalog_touched_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      sku TEXT DEFAULT '',
      woo_product_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      budget REAL,
      purpose TEXT,
      extras TEXT,
      builds_json TEXT,
      can_build INTEGER DEFAULT 1,
      no_builds_reason TEXT DEFAULT '',
      source TEXT DEFAULT 'ai',
      model TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      est_cost_usd REAL DEFAULT 0,
      ip TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT,
      transaction_ref TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      attempt_count INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS trial_emails_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      email_type TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now')),
      UNIQUE(store_id, email_type)
    )`,

    `CREATE TABLE IF NOT EXISTS platform_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS email_send_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT,
      subject TEXT,
      template TEXT,
      status TEXT,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    `CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT,
      email TEXT,
      subject TEXT,
      message TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
  ]

  for (const sql of statements) {
    await db.execute(sql)
  }

  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id)`
  )
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_recs_store ON recommendations(store_id)`
  )
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`
  )
}

async function seedPlatformConfig() {
  const defaults = {
    trial_days: '14',
    trial_daily_limit: '3',
    price_starter: '2999',
    price_growth: '4999',
    price_pro: '7999',
    limit_starter: '500',
    limit_growth: '2000',
    limit_pro: '5000',
    anthropic_model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: process.env.ANTHROPIC_MAX_TOKENS || '4096',
    usd_to_pkr: '280',
    maintenance_mode: '0',
    payment_number: '03XX-XXXXXXX (set by admin)',
    payment_mode: 'both',
  }

  for (const [key, value] of Object.entries(defaults)) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO platform_config (key, value) VALUES (?, ?)`,
      args: [key, value],
    })
  }

  // Local-friendly default if payment_number still blank
  await db.execute({
    sql: `UPDATE platform_config SET value = ?, updated_at = datetime('now')
          WHERE key = 'payment_number' AND (value IS NULL OR value = '')`,
    args: ['03XX-XXXXXXX (demo — change in admin later)'],
  })

  await db.execute({
    sql: `INSERT OR IGNORE INTO platform_config (key, value) VALUES ('payment_mode', 'both')`,
  })
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  if (!email || !password) {
    console.warn('[db] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed')
    return
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM admins WHERE email = ? LIMIT 1',
    args: [email],
  })
  if (existing.rows.length > 0) return

  const password_hash = await bcrypt.hash(password, 10)
  await db.execute({
    sql: 'INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)',
    args: [email, password_hash, 'Admin'],
  })
  console.log(`[db] Seeded admin: ${email}`)
}

export async function getPlatformConfig() {
  const result = await getDb().execute('SELECT key, value FROM platform_config')
  const config = {}
  for (const row of result.rows) {
    config[row.key] = row.value
  }
  return config
}

export async function countTable(table) {
  const allowed = new Set([
    'admins',
    'stores',
    'products',
    'recommendations',
    'payments',
    'tokens',
    'trial_emails_sent',
    'platform_config',
    'email_send_log',
    'support_tickets',
    'pending_signups',
  ])
  if (!allowed.has(table)) throw new Error(`Invalid table: ${table}`)
  const result = await getDb().execute(`SELECT COUNT(*) AS c FROM ${table}`)
  return Number(result.rows[0].c)
}
