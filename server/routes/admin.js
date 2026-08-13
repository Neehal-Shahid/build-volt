import { Router } from 'express'
import { getDb, getPlatformConfig } from '../database.js'
import {
  authAdmin,
  comparePassword,
  getAdminByEmail,
  getAdminById,
  hashPassword,
  isValidEmail,
  publicAdmin,
  publicStore,
  randomOtp,
  randomToken,
  signAdminToken,
  getStoreById,
  validatePassword,
} from '../lib/auth.js'
import { normalizePaymentMode } from '../lib/paymentMode.js'
import { sendEmail, adminPasswordResetEmailContent } from '../email.js'

const appUrl = () => process.env.APP_URL || 'http://localhost:5173'
const emailDevHints = () => process.env.EMAIL_TEST_MODE === 'true'

const router = Router()

function mapPayment(p) {
  return {
    id: p.id,
    storeId: p.store_id,
    plan: p.plan,
    amount: p.amount,
    method: p.method,
    transactionRef: p.transaction_ref,
    status: p.status,
    notes: p.notes || '',
    createdAt: p.created_at,
    reviewedAt: p.reviewed_at,
  }
}

function mapStoreRow(s) {
  return {
    ...publicStore(s),
    adminNotes: s.admin_notes || '',
    dripEmailsPaused: !!s.drip_emails_paused,
    createdAt: s.created_at,
  }
}

async function daysFromNowIso(days) {
  const d = new Date()
  d.setDate(d.getDate() + Number(days))
  return d.toISOString()
}

router.post('/admin/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    const password = String(req.body.password || '')
    const admin = await getAdminByEmail(email)
    if (!admin || !(await comparePassword(password, admin.password_hash))) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid email or password' })
    }
    const token = signAdminToken(admin)
    res.json({ success: true, token, admin: publicAdmin(admin) })
  } catch (err) {
    console.error('[admin login]', err)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// POST /admin/forgot-password { email }
router.post('/admin/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, error: 'Enter a valid email' })
    }

    const admin = await getAdminByEmail(email)
    const generic = {
      success: true,
      message: 'If that email exists, reset instructions were sent.',
    }
    if (!admin) return res.json(generic)

    const db = getDb()
    const token = randomToken()
    const otp = randomOtp()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await db.execute({
      sql: `DELETE FROM tokens WHERE email = ? AND type = 'admin_password_reset'`,
      args: [email],
    })
    await db.execute({
      sql: `INSERT INTO tokens (email, token, type, expires_at) VALUES (?, ?, 'admin_password_reset', ?)`,
      args: [email, `${token}:${otp}`, expiresAt],
    })

    const content = adminPasswordResetEmailContent({
      appUrl: appUrl(),
      token,
      otp,
    })
    await sendEmail({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      template: 'admin_password_reset',
    })

    if (emailDevHints()) {
      generic.devHint = { otp, resetToken: token, resetLink: content.link }
    }
    res.json(generic)
  } catch (err) {
    console.error('[admin forgot-password]', err)
    res
      .status(500)
      .json({ success: false, error: 'Could not start password reset.' })
  }
})

// POST /admin/reset-password { token?, email?, otp?, password }
router.post('/admin/reset-password', async (req, res) => {
  try {
    const password = String(req.body.password || '')
    const token = String(req.body.token || '').trim()
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    const otp = String(req.body.otp || '').trim()

    const pwErr = validatePassword(password)
    if (pwErr) return res.status(400).json({ success: false, error: pwErr })

    const db = getDb()
    let row = null

    if (token) {
      const result = await db.execute({
        sql: `SELECT * FROM tokens
              WHERE type = 'admin_password_reset'
                AND token LIKE ?
                AND (expires_at IS NULL OR expires_at >= datetime('now'))
              LIMIT 1`,
        args: [`${token}:%`],
      })
      row = result.rows[0] || null
      if (otp && row) {
        const storedOtp = String(row.token).split(':')[1]
        if (storedOtp !== otp) row = null
      }
    } else if (email && otp) {
      const result = await db.execute({
        sql: `SELECT * FROM tokens
              WHERE type = 'admin_password_reset'
                AND email = ?
                AND token LIKE ?
                AND (expires_at IS NULL OR expires_at >= datetime('now'))
              LIMIT 1`,
        args: [email, `%:${otp}`],
      })
      row = result.rows[0] || null
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide reset token or email + OTP, plus new password',
      })
    }

    if (!row) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid or expired reset code' })
    }

    const password_hash = await hashPassword(password)
    await db.execute({
      sql: `UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE email = ?`,
      args: [password_hash, row.email],
    })
    await db.execute({
      sql: `DELETE FROM tokens WHERE id = ?`,
      args: [row.id],
    })

    res.json({
      success: true,
      message: 'Password updated. You can log in now.',
    })
  } catch (err) {
    console.error('[admin reset-password]', err)
    res.status(500).json({ success: false, error: 'Password reset failed.' })
  }
})

router.get('/admin/me', authAdmin, async (req, res) => {
  try {
    const admin = await getAdminById(req.admin.adminId)
    if (!admin)
      return res.status(401).json({ success: false, error: 'Admin not found' })
    res.json({ success: true, admin: publicAdmin(admin) })
  } catch (err) {
    console.error('[admin me]', err)
    res.status(500).json({ success: false, error: 'Could not load admin' })
  }
})

router.get('/admin/overview', authAdmin, async (_req, res) => {
  try {
    const db = getDb()
    const [stores, recs, pending, approvedRev, recentStores, pendingPayments] =
      await Promise.all([
        db.execute(`SELECT COUNT(*) AS c FROM stores`),
        db.execute(`SELECT COUNT(*) AS c FROM recommendations`),
        db.execute(
          `SELECT COUNT(*) AS c FROM payments WHERE status = 'pending'`,
        ),
        db.execute(
          `SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status = 'approved'`,
        ),
        db.execute(`SELECT * FROM stores WHERE datetime(created_at) >= datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 30`),
        db.execute(
          `SELECT p.*, s.email AS store_email, s.name AS store_name
           FROM payments p
           LEFT JOIN stores s ON s.id = p.store_id
           WHERE p.status = 'pending'
           ORDER BY p.id DESC LIMIT 10`,
        ),
      ])

    res.json({
      success: true,
      stats: {
        stores: Number(stores.rows[0]?.c || 0),
        recommendations: Number(recs.rows[0]?.c || 0),
        pendingPayments: Number(pending.rows[0]?.c || 0),
        revenueApproved: Number(approvedRev.rows[0]?.s || 0),
      },
      recentStores: recentStores.rows.map(mapStoreRow),
      pendingPayments: pendingPayments.rows.map((p) => ({
        ...mapPayment(p),
        storeEmail: p.store_email || '',
        storeName: p.store_name || '',
      })),
    })
  } catch (err) {
    console.error('[admin overview]', err)
    res.status(500).json({ success: false, error: 'Could not load overview' })
  }
})

router.get('/admin/stores', authAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '')
      .trim()
      .toLowerCase()
    const page = Math.max(0, Number(req.query.page || 0))
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 50)))
    const offset = page * limit
    const db = getDb()
    const countResult = await db.execute(
      q
        ? { sql: `SELECT COUNT(*) AS c FROM stores WHERE lower(id) LIKE ? OR lower(email) LIKE ? OR lower(name) LIKE ?`, args: [`%${q}%`, `%${q}%`, `%${q}%`] }
        : { sql: `SELECT COUNT(*) AS c FROM stores` }
    )
    const total = Number(countResult.rows[0]?.c || 0)
    let result
    if (q) {
      result = await db.execute({
        sql: `SELECT * FROM stores
              WHERE lower(id) LIKE ? OR lower(email) LIKE ? OR lower(name) LIKE ?
              ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        args: [`%${q}%`, `%${q}%`, `%${q}%`, limit, offset],
      })
    } else {
      result = await db.execute({
        sql: `SELECT * FROM stores ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        args: [limit, offset],
      })
    }
    res.json({ success: true, stores: result.rows.map(mapStoreRow), total, page, limit })
  } catch (err) {
    console.error('[admin stores]', err)
    res.status(500).json({ success: false, error: 'Could not load stores' })
  }
})

router.get('/admin/store-products/:storeId', authAdmin, async (req, res) => {
  try {
    const result = await getDb().execute({
      sql: `SELECT id, name, category, price, stock FROM products WHERE store_id = ? ORDER BY id DESC LIMIT 100`,
      args: [req.params.storeId],
    })
    res.json({
      success: true,
      products: result.rows.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        stock: !!p.stock,
      })),
    })
  } catch (err) {
    console.error('[admin store-products]', err)
    res.status(500).json({ success: false, error: 'Could not load products' })
  }
})

router.post('/admin/disable-store', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    await getDb().execute({
      sql: `UPDATE stores SET disabled = 1, active = 0, updated_at = datetime('now') WHERE id = ?`,
      args: [storeId],
    })
    const store = await getStoreById(storeId)
    res.json({ success: true, store: mapStoreRow(store) })
  } catch (err) {
    console.error('[disable-store]', err)
    res.status(500).json({ success: false, error: 'Could not disable store' })
  }
})

router.post('/admin/activate-store', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    await getDb().execute({
      sql: `UPDATE stores SET disabled = 0, active = 1, updated_at = datetime('now') WHERE id = ?`,
      args: [storeId],
    })
    const store = await getStoreById(storeId)
    res.json({ success: true, store: mapStoreRow(store) })
  } catch (err) {
    console.error('[activate-store]', err)
    res.status(500).json({ success: false, error: 'Could not activate store' })
  }
})

router.post('/admin/delete-store', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const db = getDb()
    await db.execute({
      sql: `DELETE FROM products WHERE store_id = ?`,
      args: [storeId],
    })
    await db.execute({
      sql: `DELETE FROM recommendations WHERE store_id = ?`,
      args: [storeId],
    })
    await db.execute({
      sql: `DELETE FROM payments WHERE store_id = ?`,
      args: [storeId],
    })
    await db.execute({
      sql: `DELETE FROM support_tickets WHERE store_id = ?`,
      args: [storeId],
    })
    await db.execute({
      sql: `DELETE FROM stores WHERE id = ?`,
      args: [storeId],
    })
    res.json({ success: true, message: 'Store deleted' })
  } catch (err) {
    console.error('[delete-store]', err)
    res.status(500).json({ success: false, error: 'Could not delete store' })
  }
})

router.post('/admin/set-plan', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const plan = String(req.body.plan || '')
      .trim()
      .toLowerCase()
    const allowed = new Set(['trial', 'starter', 'growth', 'pro'])
    if (!allowed.has(plan)) {
      return res.status(400).json({ success: false, error: 'Invalid plan' })
    }
    let planEnds = null
    if (plan !== 'trial') {
      planEnds = await daysFromNowIso(30)
    }
    await getDb().execute({
      sql: `UPDATE stores SET plan = ?, plan_ends = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [plan, planEnds, storeId],
    })
    const store = await getStoreById(storeId)
    res.json({ success: true, store: mapStoreRow(store) })
  } catch (err) {
    console.error('[set-plan]', err)
    res.status(500).json({ success: false, error: 'Could not set plan' })
  }
})

router.post('/admin/extend-trial', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const days = Number(req.body.days || 7)
    const store = await getStoreById(storeId)
    if (!store)
      return res.status(404).json({ success: false, error: 'Store not found' })
    const base = store.trial_ends ? new Date(store.trial_ends) : new Date()
    if (base < new Date()) base.setTime(Date.now())
    base.setDate(base.getDate() + days)
    await getDb().execute({
      sql: `UPDATE stores SET trial_ends = ?, plan = 'trial', updated_at = datetime('now') WHERE id = ?`,
      args: [base.toISOString(), storeId],
    })
    const updated = await getStoreById(storeId)
    res.json({ success: true, store: mapStoreRow(updated) })
  } catch (err) {
    console.error('[extend-trial]', err)
    res.status(500).json({ success: false, error: 'Could not extend trial' })
  }
})

router.post('/admin/save-notes', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const notes = String(req.body.notes || '')
    await getDb().execute({
      sql: `UPDATE stores SET admin_notes = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [notes, storeId],
    })
    const store = await getStoreById(storeId)
    res.json({ success: true, store: mapStoreRow(store) })
  } catch (err) {
    console.error('[save-notes]', err)
    res.status(500).json({ success: false, error: 'Could not save notes' })
  }
})

router.post('/admin/set-drip-paused', authAdmin, async (req, res) => {
  try {
    const storeId = String(req.body.storeId || '').trim()
    const paused = req.body.paused ? 1 : 0
    await getDb().execute({
      sql: `UPDATE stores SET drip_emails_paused = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [paused, storeId],
    })
    const store = await getStoreById(storeId)
    res.json({ success: true, store: mapStoreRow(store) })
  } catch (err) {
    console.error('[set-drip-paused]', err)
    res
      .status(500)
      .json({ success: false, error: 'Could not update drip flag' })
  }
})

router.get('/admin/payments', authAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase()
    const page = Math.max(0, Number(req.query.page || 0))
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 50)))
    const offset = page * limit
    const db = getDb()
    const isFiltered = status === 'pending' || status === 'approved' || status === 'rejected'
    const countResult = await db.execute(
      isFiltered
        ? { sql: `SELECT COUNT(*) AS c FROM payments WHERE status = ?`, args: [status] }
        : { sql: `SELECT COUNT(*) AS c FROM payments` }
    )
    const total = Number(countResult.rows[0]?.c || 0)
    let result
    if (isFiltered) {
      result = await db.execute({
        sql: `SELECT p.*, s.email AS store_email, s.name AS store_name
              FROM payments p
              LEFT JOIN stores s ON s.id = p.store_id
              WHERE p.status = ?
              ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        args: [status, limit, offset],
      })
    } else {
      result = await db.execute({
        sql: `SELECT p.*, s.email AS store_email, s.name AS store_name
              FROM payments p
              LEFT JOIN stores s ON s.id = p.store_id
              ORDER BY p.id DESC LIMIT ? OFFSET ?`,
        args: [limit, offset],
      })
    }
    res.json({
      success: true,
      payments: result.rows.map((p) => ({
        ...mapPayment(p),
        storeEmail: p.store_email || '',
        storeName: p.store_name || '',
      })),
      total,
      page,
      limit,
    })
  } catch (err) {
    console.error('[admin payments]', err)
    res.status(500).json({ success: false, error: 'Could not load payments' })
  }
})

router.post('/admin/approve-payment', authAdmin, async (req, res) => {
  try {
    const paymentId = Number(req.body.paymentId || req.body.id)
    const db = getDb()
    const found = await db.execute({
      sql: `SELECT * FROM payments WHERE id = ? LIMIT 1`,
      args: [paymentId],
    })
    const payment = found.rows[0]
    if (!payment)
      return res
        .status(404)
        .json({ success: false, error: 'Payment not found' })
    if (payment.status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, error: 'Payment is not pending' })
    }

    const planEnds = await daysFromNowIso(30)
    await db.execute({
      sql: `UPDATE payments SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?`,
      args: [paymentId],
    })
    await db.execute({
      sql: `UPDATE stores SET plan = ?, plan_ends = ?, active = 1, disabled = 0, updated_at = datetime('now') WHERE id = ?`,
      args: [payment.plan, planEnds, payment.store_id],
    })

    const store = await getStoreById(payment.store_id)
    if (store?.email) {
      await sendEmail({
        to: store.email,
        subject: 'BuildBot payment approved',
        text: `Your ${payment.plan} plan is active until ${planEnds}.`,
        html: `<p>Your <strong>${payment.plan}</strong> plan is active for 30 days.</p>`,
        template: 'payment_approved',
      })
    }

    res.json({
      success: true,
      message: 'Payment approved and plan activated',
      store: mapStoreRow(store),
      payment: mapPayment({ ...payment, status: 'approved' }),
    })
  } catch (err) {
    console.error('[approve-payment]', err)
    res.status(500).json({ success: false, error: 'Could not approve payment' })
  }
})

router.post('/admin/reject-payment', authAdmin, async (req, res) => {
  try {
    const paymentId = Number(req.body.paymentId || req.body.id)
    const reason = String(req.body.reason || '').trim()
    const db = getDb()
    const found = await db.execute({
      sql: `SELECT * FROM payments WHERE id = ? LIMIT 1`,
      args: [paymentId],
    })
    const payment = found.rows[0]
    if (!payment)
      return res
        .status(404)
        .json({ success: false, error: 'Payment not found' })
    if (payment.status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, error: 'Payment is not pending' })
    }

    await db.execute({
      sql: `UPDATE payments SET status = 'rejected', notes = ?, reviewed_at = datetime('now') WHERE id = ?`,
      args: [reason || payment.notes || 'rejected', paymentId],
    })

    const store = await getStoreById(payment.store_id)
    if (store?.email) {
      await sendEmail({
        to: store.email,
        subject: 'BuildBot payment rejected',
        text: `Your payment was rejected.${reason ? ` Reason: ${reason}` : ''}`,
        html: `<p>Your payment was rejected.</p>${reason ? `<p>${reason}</p>` : ''}`,
        template: 'payment_rejected',
      })
    }

    res.json({
      success: true,
      message: 'Payment rejected',
      payment: mapPayment({ ...payment, status: 'rejected' }),
    })
  } catch (err) {
    console.error('[reject-payment]', err)
    res.status(500).json({ success: false, error: 'Could not reject payment' })
  }
})

router.get('/admin/platform-config', authAdmin, async (_req, res) => {
  try {
    const config = await getPlatformConfig()
    res.json({
      success: true,
      config: {
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
      },
    })
  } catch (err) {
    console.error('[admin config get]', err)
    res.status(500).json({ success: false, error: 'Could not load config' })
  }
})

router.post('/admin/platform-config', authAdmin, async (req, res) => {
  try {
    const db = getDb()
    const allowed = new Set([
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
    ])

    const updates = { ...(req.body || {}) }
    if (updates.payment_mode !== undefined) {
      updates.payment_mode = normalizePaymentMode(updates.payment_mode)
    }

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue
      await db.execute({
        sql: `INSERT INTO platform_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        args: [key, String(value)],
      })
    }

    const config = await getPlatformConfig()
    res.json({
      success: true,
      message: 'Settings saved',
      config: {
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
      },
    })
  } catch (err) {
    console.error('[admin config post]', err)
    res.status(500).json({ success: false, error: 'Could not save config' })
  }
})

export default router
