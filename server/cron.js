import { getDb } from './database.js'
import { sendEmail, emailShell } from './email.js'

async function alreadySent(storeId, emailType) {
  const r = await getDb().execute({
    sql: `SELECT id FROM trial_emails_sent WHERE store_id = ? AND email_type = ? LIMIT 1`,
    args: [storeId, emailType],
  })
  return r.rows.length > 0
}

async function markSent(storeId, emailType) {
  await getDb().execute({
    sql: `INSERT OR IGNORE INTO trial_emails_sent (store_id, email_type) VALUES (?, ?)`,
    args: [storeId, emailType],
  })
}

function daysBetween(isoA, isoB = new Date().toISOString()) {
  const a = new Date(isoA).getTime()
  const b = new Date(isoB).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.floor((b - a) / (24 * 60 * 60 * 1000))
}

function dayDiffFromNow(iso) {
  if (!iso) return null
  return daysBetween(new Date().toISOString(), iso)
}

/**
 * Run all drip / reminder email jobs once.
 * Returns a result object for admin UI + cron logs.
 */
export async function runDripOnce() {
  const db = getDb()
  const result = {
    sent: 0,
    skipped: 0,
    errors: [],
    byType: {},
  }

  function bump(type, ok) {
    result.byType[type] = (result.byType[type] || 0) + 1
    if (ok) result.sent += 1
    else result.skipped += 1
  }

  async function sendDrip(store, emailType, subject, text, html) {
    if (store.drip_emails_paused) {
      bump(emailType, false)
      return
    }
    if (await alreadySent(store.id, emailType)) {
      bump(emailType, false)
      return
    }
    try {
      await sendEmail({
        to: store.email,
        subject,
        text,
        html,
        template: emailType,
      })
      await markSent(store.id, emailType)
      bump(emailType, true)
    } catch (err) {
      result.errors.push({ storeId: store.id, emailType, error: err.message })
    }
  }

  try {
    const stores = await db.execute(`SELECT * FROM stores WHERE disabled = 0`)
    for (const store of stores.rows) {
      // Trial ending in ~3 days / ~1 day
      if (store.plan === 'trial' && store.trial_ends) {
        const daysLeft = dayDiffFromNow(store.trial_ends)
        if (daysLeft === 3) {
          await sendDrip(
            store,
            'trial_ending_3d',
            'Your BuildBot trial ends in 3 days',
            `Hi ${store.name || 'there'}, your trial ends on ${store.trial_ends}. Upgrade in Billing to keep your widget live.`,
            emailShell(`<h1>Your trial ends in 3 days</h1><p>Your BuildBot widget will pause when the trial ends. Upgrade now to keep it live.</p><a class="btn" href="${(process.env.APP_URL||'https://build-volt.vercel.app')+'/dashboard'}">Upgrade in Billing</a>`)
          )
        } else if (daysLeft === 1) {
          await sendDrip(
            store,
            'trial_ending_1d',
            'Your BuildBot trial ends tomorrow',
            `Your BuildBot trial ends tomorrow (${store.trial_ends}). Upgrade now — your widget will pause when the trial ends.`,
            emailShell(`<h1>Your trial ends tomorrow</h1><p>Upgrade today to avoid any interruption to your widget.</p><a class="btn" href="${(process.env.APP_URL||'https://build-volt.vercel.app')+'/dashboard'}">Upgrade now</a>`)
          )
        } else if (daysLeft === 0) {
          await sendDrip(
            store,
            'trial_expired_0d',
            'Your BuildBot trial has ended',
            `Hi ${store.name || 'there'}, your BuildBot trial ended today. Your widget is now paused. Upgrade from Billing to restore it.`,
            emailShell(`<h1>Your BuildBot trial has ended</h1><p>Your widget is now <strong>paused</strong> for shoppers. Upgrade from Billing to restore it immediately.</p><a class="btn" href="${(process.env.APP_URL||'https://build-volt.vercel.app')+'/dashboard'}">Restore my widget</a>`)
          )
        }
      }

      // Onboarding day 4 — no woo + no products
      const age = daysBetween(store.created_at || store.trial_started_at)
      if (age === 4 && !store.woo_connected) {
        const prod = await db.execute({
          sql: `SELECT COUNT(*) AS c FROM products WHERE store_id = ?`,
          args: [store.id],
        })
        if (Number(prod.rows[0]?.c || 0) === 0) {
          await sendDrip(
            store,
            'onboarding_day4',
            'Add your first products to BuildBot',
            'You signed up 4 days ago but have no products yet. Upload a CSV or add parts to start recommending builds.',
            emailShell(`<h1>Add your first products</h1><p>You signed up 4 days ago but haven't added any products yet. Upload a CSV or connect WooCommerce so BuildBot can recommend builds.</p><a class="btn" href="${(process.env.APP_URL||'https://build-volt.vercel.app')+'/dashboard'}">Add products</a>`)
          )
        }
      }

      // Onboarding day 10
      if (age === 10) {
        await sendDrip(
          store,
          'onboarding_day10',
          'Need help getting BuildBot live?',
          'It has been 10 days since you joined BuildBot. Reply via Help if you need a hand with embed or WooCommerce.',
          emailShell(`<h1>Need help going live?</h1><p>It's been 10 days since you joined BuildBot. If you're stuck on the embed or WooCommerce connection, open the Help tab in your dashboard — we reply within 24 hours.</p><a class="btn" href="${(process.env.APP_URL||'https://build-volt.vercel.app')+'/dashboard'}">Open Help</a>`)
        )
      }

      // Plan lapsed 1 / 3 / 7 days
      if (store.plan !== 'trial' && store.plan_ends) {
        const daysSinceEnd = daysBetween(store.plan_ends)
        if ([0, 1, 3, 7].includes(daysSinceEnd)) {
          await sendDrip(
            store,
            `plan_expired_${daysSinceEnd}d`,
            'Your BuildBot plan has expired',
            `Your ${store.plan} plan ended on ${store.plan_ends}. Renew from Billing to restore limits.`,
            emailShell(`<h1>Your BuildBot plan has expired</h1><p>Your <strong>${store.plan}</strong> plan ended on ${store.plan_ends}. Renew from Billing to restore widget limits.</p><a class="btn" href="${(process.env.APP_URL||'https://build-volt.vercel.app')+'/dashboard'}">Renew plan</a>`)
          )
        }
      }
    }

    // Stale pending payments > 6 hours → email admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@buildbot.local'
    const stale = await db.execute(
      `SELECT p.*, s.name AS store_name, s.email AS store_email
       FROM payments p
       LEFT JOIN stores s ON s.id = p.store_id
       WHERE p.status = 'pending'
         AND datetime(p.created_at) <= datetime('now', '-6 hours')
       ORDER BY p.id DESC LIMIT 20`
    )
    if (stale.rows.length) {
      const type = 'admin_stale_payments'
      const key = `stale-${stale.rows.map((r) => r.id).join('-')}`
      const logged = await db.execute({
        sql: `SELECT id FROM email_send_log WHERE template = ? AND meta LIKE ? LIMIT 1`,
        args: [type, `%${key}%`],
      })
      if (!logged.rows.length) {
        const lines = stale.rows
          .map(
            (p) =>
              `#${p.id} ${p.store_name || p.store_id} ${p.plan} PKR ${p.amount} ref=${p.transaction_ref}`
          )
          .join('\n')
        await sendEmail({
          to: adminEmail,
          subject: `${stale.rows.length} stale pending payment(s)`,
          text: `Pending >6h:\n${lines}`,
          html: emailShell(`<h1>${stale.rows.length} payment(s) pending over 6 hours</h1><pre style="background:#F1F5F9;padding:1rem;border-radius:8px;font-size:0.85rem;overflow:auto">${lines}</pre>`),
          template: type,
        })
        // Patch meta with key for dedup — sendEmail already logged; insert a marker row
        await db.execute({
          sql: `INSERT INTO email_send_log (to_email, subject, template, status, meta)
                VALUES (?, ?, ?, 'logged', ?)`,
          args: [adminEmail, 'stale-marker', type, JSON.stringify({ key })],
        })
        result.sent += 1
        result.byType[type] = (result.byType[type] || 0) + 1
      } else {
        result.skipped += 1
        result.byType[type] = (result.byType[type] || 0) + 1
      }
    }
  } catch (err) {
    result.errors.push({ error: err.message })
  }

  return result
}

export function startCron() {
  const enabled = process.env.CRON_ENABLED === 'true'
  if (!enabled) {
    console.log('[cron] CRON_ENABLED=false — scheduled drip disabled (use POST /api/admin/run-drip)')
    return
  }

  const HOUR = 60 * 60 * 1000
  const run = async () => {
    console.log('[cron] Running drip…')
    try {
      const r = await runDripOnce()
      console.log('[cron] Drip done', JSON.stringify({ sent: r.sent, skipped: r.skipped, byType: r.byType }))
    } catch (err) {
      console.error('[cron] Drip failed', err.message)
    }
  }

  setTimeout(run, 30 * 1000)
  setInterval(run, HOUR)
  console.log('[cron] Enabled — first run in 30s, then every 60m')
}
