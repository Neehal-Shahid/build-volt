import { Router } from 'express'
import { getDb, getPlatformConfig } from '../database.js'
import {
  authStore,
  getStoreById,
  publicStore,
  signStoreToken,
  randomToken,
} from '../lib/auth.js'
import { validateDemoPayment, DEMO_TEST_CARDS, formatCardNumber } from '../lib/demoCards.js'
import { normalizePaymentMode, modeFlags } from '../lib/paymentMode.js'
import { planLimit, isPlanLapsed } from '../lib/storePlan.js'

const router = Router()

function plansFromConfig(config) {
  return [
    {
      id: 'starter',
      name: 'Starter',
      price: Number(config.price_starter || 2999),
      currency: 'PKR',
      limit: Number(config.limit_starter || 500),
      period: 'month',
      blurb: 'For small shops getting started',
    },
    {
      id: 'growth',
      name: 'Growth',
      price: Number(config.price_growth || 4999),
      currency: 'PKR',
      limit: Number(config.limit_growth || 2000),
      period: 'month',
      blurb: 'More recommendations for busy stores',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: Number(config.price_pro || 7999),
      currency: 'PKR',
      limit: Number(config.limit_pro || 5000),
      period: 'month',
      blurb: 'Highest monthly volume',
    },
  ]
}

function currentLimit(store, config) {
  return planLimit(store, config)
}

async function countUsage(storeId, period) {
  const db = getDb()
  const sql =
    period === 'day'
      ? `SELECT COUNT(*) AS c FROM recommendations
         WHERE store_id = ? AND source != 'cached'
           AND created_at >= datetime('now', '-1 day')`
      : `SELECT COUNT(*) AS c FROM recommendations
         WHERE store_id = ? AND source != 'cached'
           AND created_at >= datetime('now', '-30 days')`
  const result = await db.execute({ sql, args: [storeId] })
  return Number(result.rows[0]?.c || 0)
}

function mapPayment(p) {
  return {
    id: p.id,
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

async function activatePlan(storeId, planId) {
  const ends = new Date()
  ends.setDate(ends.getDate() + 30)
  await getDb().execute({
    sql: `UPDATE stores
          SET plan = ?, plan_ends = ?, updated_at = datetime('now')
          WHERE id = ?`,
    args: [planId, ends.toISOString(), storeId],
  })
  return ends.toISOString()
}

// Public plans + payment mode
router.get('/plans', async (_req, res) => {
  try {
    const config = await getPlatformConfig()
    const mode = normalizePaymentMode(config.payment_mode)
    res.json({
      success: true,
      plans: plansFromConfig(config),
      trialDays: Number(config.trial_days || 14),
      trialDailyLimit: Number(config.trial_daily_limit || 3),
      paymentNumber: config.payment_number || '',
      supportEmail: process.env.ADMIN_EMAIL || '',
      ...modeFlags(mode),
      demoCards: DEMO_TEST_CARDS.map((c) => ({
        number: c.number,
        numberDisplay: formatCardNumber(c.number),
        brand: c.brand,
        label: c.label,
        hint: c.hint,
        result: c.result,
      })),
    })
  } catch (err) {
    console.error('[plans]', err)
    res.status(500).json({ success: false, error: 'Could not load plans' })
  }
})

router.get('/analytics', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const db = getDb()
    const store = await getStoreById(storeId)
    const config = await getPlatformConfig()
    const lim = currentLimit(store, config)
    const used = await countUsage(storeId, lim.period)

    const total = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM recommendations WHERE store_id = ?`,
      args: [storeId],
    })
    const byPurpose = await db.execute({
      sql: `SELECT purpose, COUNT(*) AS c FROM recommendations
            WHERE store_id = ? AND purpose IS NOT NULL AND purpose != ''
            GROUP BY purpose ORDER BY c DESC`,
      args: [storeId],
    })
    const avgBudget = await db.execute({
      sql: `SELECT AVG(budget) AS avg_budget FROM recommendations
            WHERE store_id = ? AND budget IS NOT NULL`,
      args: [storeId],
    })
    const daily = await db.execute({
      sql: `SELECT date(created_at) AS day, COUNT(*) AS c
            FROM recommendations
            WHERE store_id = ? AND created_at >= datetime('now', '-14 days')
            GROUP BY date(created_at)
            ORDER BY day ASC`,
      args: [storeId],
    })
    const recent = await db.execute({
      sql: `SELECT id, budget, purpose, extras, source, can_build, created_at
            FROM recommendations
            WHERE store_id = ?
            ORDER BY id DESC LIMIT 20`,
      args: [storeId],
    })

    res.json({
      success: true,
      totalRecommendations: Number(total.rows[0]?.c || 0),
      byPurpose: byPurpose.rows.map((r) => ({
        purpose: r.purpose,
        count: Number(r.c),
      })),
      avgBudget: Math.round(Number(avgBudget.rows[0]?.avg_budget || 0)),
      dailyActivity: daily.rows.map((r) => ({
        day: r.day,
        count: Number(r.c),
      })),
      recent: recent.rows.map((r) => ({
        id: r.id,
        budget: r.budget,
        purpose: r.purpose,
        extras: r.extras,
        source: r.source,
        canBuild: !!r.can_build,
        createdAt: r.created_at,
      })),
      usage: {
        used,
        limit: lim.limit,
        remaining: Math.max(0, lim.limit - used),
        period: lim.period,
      },
      planLapsed: isPlanLapsed(store),
    })
  } catch (err) {
    console.error('[analytics]', err)
    res.status(500).json({ success: false, error: 'Could not load analytics' })
  }
})

// JazzCash / EasyPaisa manual submit
router.post('/payment/submit', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const plan = String(req.body.plan || '').trim().toLowerCase()
    const method = String(req.body.method || '').trim()
    const transactionRef = String(req.body.transactionRef || req.body.transaction_ref || '').trim()

    const config = await getPlatformConfig()
    const mode = normalizePaymentMode(config.payment_mode)
    if (!modeFlags(mode).jazzcashEnabled) {
      return res.status(403).json({
        success: false,
        error: 'JazzCash / EasyPaisa payments are disabled by admin. Use Demo Card checkout.',
      })
    }

    const plans = plansFromConfig(config)
    const selected = plans.find((p) => p.id === plan)
    if (!selected) {
      return res.status(400).json({ success: false, error: 'Choose Starter, Growth, or Pro' })
    }
    if (!['JazzCash', 'EasyPaisa'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Payment method must be JazzCash or EasyPaisa',
      })
    }
    if (transactionRef.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Enter your transaction ID / reference',
      })
    }

    const dup = await getDb().execute({
      sql: `SELECT id FROM payments WHERE transaction_ref = ? AND status = 'pending' LIMIT 1`,
      args: [transactionRef],
    })
    if (dup.rows.length) {
      return res.status(409).json({
        success: false,
        error: 'This transaction reference is already submitted and pending',
      })
    }

    const result = await getDb().execute({
      sql: `INSERT INTO payments (store_id, plan, amount, method, transaction_ref, status, notes)
            VALUES (?, ?, ?, ?, ?, 'pending', 'manual')
            RETURNING *`,
      args: [storeId, selected.id, selected.price, method, transactionRef],
    })

    let payment = result.rows[0]
    if (!payment) {
      const last = await getDb().execute({
        sql: `SELECT * FROM payments WHERE store_id = ? ORDER BY id DESC LIMIT 1`,
        args: [storeId],
      })
      payment = last.rows[0]
    }

    const { sendEmail } = await import('../email.js')
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New payment pending: ${storeId}`,
        text: `Store ${storeId} submitted ${method} payment for ${selected.name} (${selected.price} PKR). Ref: ${transactionRef}`,
        html: `<p>Store <code>${storeId}</code> submitted <strong>${method}</strong> for <strong>${selected.name}</strong> (${selected.price} PKR).</p><p>Ref: ${transactionRef}</p>`,
        template: 'admin_new_payment',
      })
    }

    res.status(201).json({
      success: true,
      message: 'Payment submitted. An admin will review it soon.',
      payment: mapPayment(payment),
    })
  } catch (err) {
    console.error('[payment submit]', err)
    res.status(500).json({ success: false, error: 'Could not submit payment' })
  }
})

// Demo card checkout — auto-approves on success
router.post('/payment/demo-checkout', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const plan = String(req.body.plan || '').trim().toLowerCase()
    const config = await getPlatformConfig()
    const mode = normalizePaymentMode(config.payment_mode)
    if (!modeFlags(mode).demoEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Demo card checkout is disabled by admin.',
      })
    }

    const selected = plansFromConfig(config).find((p) => p.id === plan)
    if (!selected) {
      return res.status(400).json({ success: false, error: 'Choose Starter, Growth, or Pro' })
    }

    const check = validateDemoPayment({
      number: req.body.number,
      expiry: req.body.expiry,
      cvc: req.body.cvc,
      name: req.body.name,
    })
    if (!check.ok) {
      return res.status(402).json({
        success: false,
        error: check.error,
        code: check.code || 'card_error',
      })
    }

    // Simulated processing delay feel — short server-side pause optional; client animates
    const ref = `DEMO-${check.last4}-${randomToken(4).slice(0, 8).toUpperCase()}`
    const notes = JSON.stringify({
      channel: 'demo_card',
      brand: check.brand,
      last4: check.last4,
      name: String(req.body.name || '').trim(),
    })

    const planEnds = await activatePlan(storeId, selected.id)

    const result = await getDb().execute({
      sql: `INSERT INTO payments (store_id, plan, amount, method, transaction_ref, status, notes, reviewed_at)
            VALUES (?, ?, ?, 'Demo Card', ?, 'approved', ?, datetime('now'))
            RETURNING *`,
      args: [storeId, selected.id, selected.price, ref, notes],
    })

    let payment = result.rows[0]
    if (!payment) {
      const last = await getDb().execute({
        sql: `SELECT * FROM payments WHERE store_id = ? ORDER BY id DESC LIMIT 1`,
        args: [storeId],
      })
      payment = last.rows[0]
    }

    const store = await getStoreById(storeId)
    const token = signStoreToken(store)

    res.json({
      success: true,
      message: 'Payment successful. Your plan is active for 30 days.',
      payment: mapPayment(payment),
      store: publicStore(store),
      token,
      planEnds,
      receipt: {
        brand: check.brand,
        last4: check.last4,
        amount: selected.price,
        plan: selected.name,
        currency: 'PKR',
      },
    })
  } catch (err) {
    console.error('[demo-checkout]', err)
    res.status(500).json({ success: false, error: 'Checkout failed. Try again.' })
  }
})

router.get('/payment/history', authStore, async (req, res) => {
  try {
    const storeId = req.user.storeId
    const result = await getDb().execute({
      sql: `SELECT * FROM payments WHERE store_id = ? ORDER BY id DESC LIMIT 50`,
      args: [storeId],
    })
    const config = await getPlatformConfig()
    const store = await getStoreById(storeId)
    const lim = currentLimit(store, config)
    const mode = normalizePaymentMode(config.payment_mode)

    res.json({
      success: true,
      store: publicStore(store),
      current: {
        plan: store.plan,
        planEnds: store.plan_ends,
        trialEnds: store.trial_ends,
        limit: lim.limit,
        period: lim.period,
      },
      paymentNumber: config.payment_number || '',
      ...modeFlags(mode),
      payments: result.rows.map(mapPayment),
    })
  } catch (err) {
    console.error('[payment history]', err)
    res.status(500).json({ success: false, error: 'Could not load payment history' })
  }
})

export default router
