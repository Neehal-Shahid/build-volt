import { Router } from 'express'
import { getDb, getPlatformConfig, countTable } from '../database.js'
import {
  authAdmin,
  authStore,
  comparePassword,
  getAdminById,
  getStoreById,
  hashPassword,
  publicAdmin,
  validatePassword,
} from '../lib/auth.js'
import { sendEmail } from '../email.js'
import { runDripOnce } from '../cron.js'
import { normalizePaymentMode } from '../lib/paymentMode.js'

const router = Router()

const CONFIG_KEYS = [
  'payment_mode',
  'payment_number',
  'trial_days',
  'trial_daily_limit',
  'price_starter',
  'price_growth',
  'price_pro',
  'limit_starter',
  'limit_growth',
  'limit_pro',
  'anthropic_model',
  'max_tokens',
  'usd_to_pkr',
  'maintenance_mode',
]

function mapConfig(config) {
  return {
    payment_mode: normalizePaymentMode(config.payment_mode),
    payment_number: config.payment_number || '',
    trial_days: config.trial_days,
    trial_daily_limit: config.trial_daily_limit,
    price_starter: config.price_starter,
    price_growth: config.price_growth,
    price_pro: config.price_pro,
    limit_starter: config.limit_starter,
    limit_growth: config.limit_growth,
    limit_pro: config.limit_pro,
    anthropic_model: config.anthropic_model,
    max_tokens: config.max_tokens,
    usd_to_pkr: config.usd_to_pkr,
    maintenance_mode: config.maintenance_mode || '0',
  }
}

async function upsertConfig(updates) {
  const db = getDb()
  const payload = { ...updates }
  if (payload.payment_mode !== undefined) {
    payload.payment_mode = normalizePaymentMode(payload.payment_mode)
  }
  for (const [key, value] of Object.entries(payload)) {
    if (!CONFIG_KEYS.includes(key)) continue
    await db.execute({
      sql: `INSERT INTO platform_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: [key, String(value)],
    })
  }
  return mapConfig(await getPlatformConfig())
}

// --- Admin profile ---
router.put('/admin/profile', authAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80)
    await getDb().execute({
      sql: `UPDATE admins SET name = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [name, req.admin.adminId],
    })
    const admin = await getAdminById(req.admin.adminId)
    res.json({ success: true, admin: publicAdmin(admin) })
  } catch (err) {
    console.error('[admin profile]', err)
    res.status(500).json({ success: false, error: 'Could not update profile' })
  }
})

router.put('/admin/password', authAdmin, async (req, res) => {
  try {
    const current = String(req.body.currentPassword || '')
    const next = String(req.body.newPassword || '')
    const admin = await getAdminById(req.admin.adminId)
    if (!admin) return res.status(401).json({ success: false, error: 'Admin not found' })
    if (!(await comparePassword(current, admin.password_hash))) {
      return res.status(400).json({ success: false, error: 'Current password is wrong' })
    }
    const bad = validatePassword(next)
    if (bad) return res.status(400).json({ success: false, error: bad })
    const hash = await hashPassword(next)
    await getDb().execute({
      sql: `UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [hash, admin.id],
    })
    res.json({ success: true, message: 'Password updated' })
  } catch (err) {
    console.error('[admin password]', err)
    res.status(500).json({ success: false, error: 'Could not update password' })
  }
})

// --- Platform stats ---
router.get('/admin/platform-stats', authAdmin, async (_req, res) => {
  try {
    const db = getDb()
    const [byPlan, trialPaid, top] = await Promise.all([
      db.execute(`SELECT plan, COUNT(*) AS c FROM stores GROUP BY plan`),
      db.execute(
        `SELECT
           SUM(CASE WHEN plan = 'trial' THEN 1 ELSE 0 END) AS trial,
           SUM(CASE WHEN plan != 'trial' THEN 1 ELSE 0 END) AS paid
         FROM stores`
      ),
      db.execute(
        `SELECT s.id, s.name, s.email, s.plan, COUNT(r.id) AS recs
         FROM stores s
         LEFT JOIN recommendations r ON r.store_id = s.id
         GROUP BY s.id
         ORDER BY recs DESC
         LIMIT 10`
      ),
    ])
    res.json({
      success: true,
      trial: Number(trialPaid.rows[0]?.trial || 0),
      paid: Number(trialPaid.rows[0]?.paid || 0),
      planDistribution: byPlan.rows.map((r) => ({ plan: r.plan, count: Number(r.c) })),
      topStores: top.rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        plan: r.plan,
        recommendations: Number(r.recs),
      })),
    })
  } catch (err) {
    console.error('[platform-stats]', err)
    res.status(500).json({ success: false, error: 'Could not load stats' })
  }
})

// --- API usage ---
router.get('/admin/api-usage', authAdmin, async (_req, res) => {
  try {
    const db = getDb()
    const config = await getPlatformConfig()
    const agg = await db.execute(
      `SELECT
         COUNT(*) AS calls,
         COALESCE(SUM(input_tokens), 0) AS input_tokens,
         COALESCE(SUM(output_tokens), 0) AS output_tokens,
         COALESCE(SUM(est_cost_usd), 0) AS cost_usd
       FROM recommendations`
    )
    const row = agg.rows[0] || {}
    const costUsd = Number(row.cost_usd || 0)
    const rate = Number(config.usd_to_pkr || 280)
    const approved = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'approved'`
    )
    const revenuePkr = Number(approved.rows[0]?.s || 0)
    const costPkr = costUsd * rate
    res.json({
      success: true,
      usage: {
        calls: Number(row.calls || 0),
        inputTokens: Number(row.input_tokens || 0),
        outputTokens: Number(row.output_tokens || 0),
        costUsd,
        costPkr,
        revenuePkr,
        estimatedProfitPkr: revenuePkr - costPkr,
      },
      config: mapConfig(config),
    })
  } catch (err) {
    console.error('[api-usage]', err)
    res.status(500).json({ success: false, error: 'Could not load API usage' })
  }
})

// Expand platform-config save keys (override handlers by mounting after — see index)
router.get('/admin/platform-config-full', authAdmin, async (_req, res) => {
  try {
    res.json({ success: true, config: mapConfig(await getPlatformConfig()) })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load config' })
  }
})

router.post('/admin/platform-config-full', authAdmin, async (req, res) => {
  try {
    const config = await upsertConfig(req.body || {})
    res.json({ success: true, message: 'Settings saved', config })
  } catch (err) {
    console.error('[platform-config-full]', err)
    res.status(500).json({ success: false, error: 'Could not save config' })
  }
})

// --- Communications ---
router.post('/admin/send-email', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const subject = String(req.body.subject || '').trim()
    const message = String(req.body.message || '').trim()
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message required' })
    }
    const store = await getStoreById(storeId)
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' })
    await sendEmail({
      to: store.email,
      subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
      template: 'admin_manual',
    })
    res.json({ success: true, message: `Email sent to ${store.email}` })
  } catch (err) {
    console.error('[send-email]', err)
    res.status(500).json({ success: false, error: 'Could not send email' })
  }
})

router.post('/admin/broadcast', authAdmin, async (req, res) => {
  try {
    const subject = String(req.body.subject || '').trim()
    const message = String(req.body.message || '').trim()
    const onlyMarketing = req.body.onlyMarketing !== false
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message required' })
    }
    const sql = onlyMarketing
      ? `SELECT id, email FROM stores WHERE disabled = 0 AND marketing_opt_in = 1`
      : `SELECT id, email FROM stores WHERE disabled = 0`
    const stores = await getDb().execute(sql)
    let sent = 0
    for (const s of stores.rows) {
      await sendEmail({
        to: s.email,
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
        template: 'admin_broadcast',
      })
      sent += 1
    }
    res.json({ success: true, message: `Broadcast sent to ${sent} store(s)`, sent })
  } catch (err) {
    console.error('[broadcast]', err)
    res.status(500).json({ success: false, error: 'Broadcast failed' })
  }
})

router.post('/admin/run-drip', authAdmin, async (_req, res) => {
  try {
    const result = await runDripOnce()
    res.json({ success: true, result })
  } catch (err) {
    console.error('[run-drip]', err)
    res.status(500).json({ success: false, error: 'Drip failed' })
  }
})

router.get('/admin/email-log', authAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 300)
    const rows = await getDb().execute({
      sql: `SELECT * FROM email_send_log ORDER BY id DESC LIMIT ?`,
      args: [limit],
    })
    res.json({
      success: true,
      emails: rows.rows.map((e) => ({
        id: e.id,
        to: e.to_email,
        subject: e.subject,
        template: e.template,
        status: e.status,
        createdAt: e.created_at,
      })),
    })
  } catch (err) {
    console.error('[email-log]', err)
    res.status(500).json({ success: false, error: 'Could not load email log' })
  }
})

router.get('/admin/support-tickets', authAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase()
    const db = getDb()
    let result
    if (status === 'open' || status === 'closed' || status === 'pending') {
      result = await db.execute({
        sql: `SELECT * FROM support_tickets WHERE status = ? ORDER BY id DESC LIMIT 200`,
        args: [status],
      })
    } else {
      result = await db.execute(`SELECT * FROM support_tickets ORDER BY id DESC LIMIT 200`)
    }
    res.json({
      success: true,
      tickets: result.rows.map((t) => ({
        id: t.id,
        storeId: t.store_id,
        email: t.email,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    })
  } catch (err) {
    console.error('[support-tickets]', err)
    res.status(500).json({ success: false, error: 'Could not load tickets' })
  }
})

router.post('/admin/support-tickets/:id/status', authAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const status = String(req.body.status || '').toLowerCase()
    if (!['open', 'pending', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' })
    }
    await getDb().execute({
      sql: `UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [status, id],
    })
    res.json({ success: true, message: 'Ticket updated' })
  } catch (err) {
    console.error('[ticket status]', err)
    res.status(500).json({ success: false, error: 'Could not update ticket' })
  }
})

// Hard-delete a single support ticket (admin only)
router.delete('/admin/support-tickets/:id', authAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id)
    await getDb().execute({
      sql: `DELETE FROM support_tickets WHERE id = ?`,
      args: [id],
    })
    res.json({ success: true, message: 'Ticket deleted' })
  } catch (err) {
    console.error('[ticket delete]', err)
    res.status(500).json({ success: false, error: 'Could not delete ticket' })
  }
})

// --- DB health ---
router.get('/admin/db-audit', authAdmin, async (_req, res) => {
  try {
    const tables = [
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
    ]
    const counts = {}
    for (const t of tables) counts[t] = await countTable(t)

    const db = getDb()
    const [orphanProducts, orphanRecs, expiredTokens] = await Promise.all([
      db.execute(
        `SELECT COUNT(*) AS c FROM products p
         LEFT JOIN stores s ON s.id = p.store_id WHERE s.id IS NULL`
      ),
      db.execute(
        `SELECT COUNT(*) AS c FROM recommendations r
         LEFT JOIN stores s ON s.id = r.store_id WHERE s.id IS NULL`
      ),
      db.execute(
        `SELECT COUNT(*) AS c FROM tokens WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`
      ),
    ])

    res.json({
      success: true,
      counts,
      orphans: {
        products: Number(orphanProducts.rows[0]?.c || 0),
        recommendations: Number(orphanRecs.rows[0]?.c || 0),
        expiredTokens: Number(expiredTokens.rows[0]?.c || 0),
      },
    })
  } catch (err) {
    console.error('[db-audit]', err)
    res.status(500).json({ success: false, error: 'Audit failed' })
  }
})

router.post('/admin/db-cleanup', authAdmin, async (req, res) => {
  try {
    const db = getDb()
    const what = String(req.body.what || 'tokens')
    let deleted = 0
    if (what === 'tokens' || what === 'all') {
      const r = await db.execute(
        `DELETE FROM tokens WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')`
      )
      deleted += Number(r.rowsAffected || 0)
    }
    if (what === 'orphans' || what === 'all') {
      await db.execute(
        `DELETE FROM products WHERE store_id NOT IN (SELECT id FROM stores)`
      )
      await db.execute(
        `DELETE FROM recommendations WHERE store_id NOT IN (SELECT id FROM stores)`
      )
      await db.execute(
        `DELETE FROM payments WHERE store_id NOT IN (SELECT id FROM stores)`
      )
    }
    if (what === 'pending_signups' || what === 'all') {
      const r = await db.execute(
        `DELETE FROM pending_signups WHERE datetime(created_at) < datetime('now', '-7 days')`
      )
      deleted += Number(r.rowsAffected || 0)
    }
    // Auto-purge: email logs older than 10 days
    if (what === 'email_log' || what === 'all') {
      const r = await db.execute(
        `DELETE FROM email_send_log WHERE datetime(created_at) < datetime('now', '-10 days')`
      )
      deleted += Number(r.rowsAffected || 0)
    }
    // Auto-purge: closed tickets older than 7 days
    if (what === 'closed_tickets' || what === 'all') {
      const r = await db.execute(
        `DELETE FROM support_tickets WHERE status = 'closed' AND datetime(updated_at) < datetime('now', '-7 days')`
      )
      deleted += Number(r.rowsAffected || 0)
    }
    res.json({ success: true, message: 'Cleanup done', deleted, what })
  } catch (err) {
    console.error('[db-cleanup]', err)
    res.status(500).json({ success: false, error: 'Cleanup failed' })
  }
})

// --- Revenue ---
router.get('/admin/revenue', authAdmin, async (_req, res) => {
  try {
    const db = getDb()
    const config = await getPlatformConfig()
    const prices = {
      starter: Number(config.price_starter || 2999),
      growth: Number(config.price_growth || 4999),
      pro: Number(config.price_pro || 7999),
    }
    const paid = await db.execute(
      `SELECT plan, COUNT(*) AS c FROM stores WHERE plan IN ('starter','growth','pro') AND disabled = 0 GROUP BY plan`
    )
    let mrr = 0
    const byPlan = {}
    for (const r of paid.rows) {
      byPlan[r.plan] = Number(r.c)
      mrr += Number(r.c) * (prices[r.plan] || 0)
    }
    const atRisk = await db.execute(
      `SELECT id, name, email, plan, plan_ends FROM stores
       WHERE plan IN ('starter','growth','pro')
         AND plan_ends IS NOT NULL
         AND datetime(plan_ends) <= datetime('now', '+7 days')
         AND datetime(plan_ends) >= datetime('now')
       ORDER BY plan_ends ASC LIMIT 50`
    )
    const approved = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'approved'`
    )
    res.json({
      success: true,
      mrr,
      prices,
      paidByPlan: byPlan,
      totalApprovedRevenue: Number(approved.rows[0]?.s || 0),
      atRisk: atRisk.rows.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        plan: s.plan,
        planEnds: s.plan_ends,
      })),
    })
  } catch (err) {
    console.error('[revenue]', err)
    res.status(500).json({ success: false, error: 'Could not load revenue' })
  }
})

router.post('/admin/remind-store', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const store = await getStoreById(storeId)
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' })
    await sendEmail({
      to: store.email,
      subject: 'Reminder: renew your BuildBot plan',
      text: `Hi ${store.name || ''}, your ${store.plan} plan ends on ${store.plan_ends || 'soon'}. Renew from Billing.`,
      html: `<p>Your <strong>${store.plan}</strong> plan ends soon. Renew from Billing.</p>`,
      template: 'admin_renew_remind',
    })
    res.json({ success: true, message: 'Reminder sent' })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not send reminder' })
  }
})

// --- Store support tickets ---
router.post('/support', authStore, async (req, res) => {
  try {
    const subject = String(req.body.subject || '').trim().slice(0, 120)
    const message = String(req.body.message || '').trim().slice(0, 4000)
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message required' })
    }
    const store = await getStoreById(req.user.storeId)
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' })
    const ins = await getDb().execute({
      sql: `INSERT INTO support_tickets (store_id, email, subject, message, status)
            VALUES (?, ?, ?, ?, 'open')`,
      args: [store.id, store.email, subject, message],
    })
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@buildbot.local'
    await sendEmail({
      to: adminEmail,
      subject: `Support ticket: ${subject}`,
      text: `From ${store.email} (${store.id}):\n\n${message}`,
      html: `<p>From <code>${store.id}</code> ${store.email}</p><p>${message}</p>`,
      template: 'support_ticket_admin',
    })
    await sendEmail({
      to: store.email,
      subject: 'We received your BuildBot support request',
      text: `Thanks — we got your ticket "${subject}". We'll reply soon.`,
      html: `<p>Thanks — we received your ticket <strong>${subject}</strong>.</p>`,
      template: 'support_ticket_confirm',
    })
    res.json({
      success: true,
      message: 'Ticket submitted',
      ticketId: Number(ins.lastInsertRowid || 0),
    })
  } catch (err) {
    console.error('[support post]', err)
    res.status(500).json({ success: false, error: 'Could not create ticket' })
  }
})

router.get('/support', authStore, async (req, res) => {
  try {
    const rows = await getDb().execute({
      sql: `SELECT * FROM support_tickets WHERE store_id = ? ORDER BY id DESC LIMIT 50`,
      args: [req.user.storeId],
    })
    res.json({
      success: true,
      tickets: rows.rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.created_at,
      })),
    })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load tickets' })
  }
})

export { CONFIG_KEYS, mapConfig, upsertConfig }
export default router
