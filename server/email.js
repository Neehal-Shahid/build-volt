import { getDb } from './database.js'

export function emailShell(bodyHtml) {
  const appUrl = process.env.APP_URL || 'https://build-volt.vercel.app'
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;background:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;color:#0A1A2D}
    .wrapper{max-width:560px;margin:2rem auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0}
    .header{background:linear-gradient(135deg,#0A1A2D,#1a3050);padding:1.5rem 2rem}
    .logo{color:#fff;font-size:1.4rem;font-weight:800;letter-spacing:-0.02em}
    .logo span{color:#2A5EE8}
    .body{padding:2rem}
    h1{font-size:1.25rem;font-weight:700;margin:0 0 0.75rem}
    p{font-size:0.95rem;line-height:1.6;color:#334155;margin:0 0 1rem}
    .btn{display:inline-block;background:#2A5EE8;color:#fff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.95rem;margin:0.5rem 0 1rem}
    .code{background:#F1F5F9;border-radius:8px;padding:1rem 1.5rem;font-size:1.8rem;font-weight:800;letter-spacing:0.2em;color:#0A1A2D;text-align:center;margin:1rem 0}
    .note{font-size:0.82rem;color:#64748B;margin-top:0.5rem}
    .footer{padding:1rem 2rem;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:0.8rem;color:#94A3B8;text-align:center}
    .footer a{color:#94A3B8}
  </style></head>
  <body><div class="wrapper">
    <div class="header"><div class="logo">Build<span>Bot</span></div></div>
    <div class="body">${bodyHtml}</div>
    <div class="footer">BuildBot &nbsp;&middot;&nbsp; <a href="${appUrl}">${appUrl.replace('https://', '')}</a> &nbsp;&middot;&nbsp; You're receiving this because you signed up for BuildBot.</div>
  </div></body></html>`
}

/**
 * Email sender for Phase 3+.
 * Without RESEND_API_KEY: logs to console + email_send_log (dev-friendly).
 * With EMAIL_TEST_MODE=true and Resend: would send to RESEND_EMAIL_4TEST (later).
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  template = 'generic',
}) {
  const emailTestMode = process.env.EMAIL_TEST_MODE === 'true'
  const destination =
    emailTestMode && process.env.RESEND_EMAIL_4TEST
      ? process.env.RESEND_EMAIL_4TEST
      : to

  const payload = {
    to: destination,
    originalTo: to,
    subject,
    template,
    emailTestMode,
  }

  console.log('\n========== EMAIL (dev) ==========')
  console.log(
    `To: ${destination}${emailTestMode && destination !== to ? ` (original: ${to})` : ''}`,
  )
  console.log(`Subject: ${subject}`)
  if (text) console.log(text)
  console.log('=================================\n')

  try {
    await getDb().execute({
      sql: `INSERT INTO email_send_log (to_email, subject, template, status, meta)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        destination,
        subject,
        template,
        process.env.RESEND_API_KEY ? 'queued' : 'logged',
        JSON.stringify(payload),
      ],
    })
  } catch (err) {
    console.warn('[email] log failed:', err.message)
  }

  // Optional Resend when key is set (still logs first).
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [destination],
          subject,
          html: html || `<pre>${text || ''}</pre>`,
          text: text || undefined,
        }),
      })
      if (!r.ok) {
        const body = await r.text()
        console.warn('[email] Resend error:', r.status, body)
      }
    } catch (err) {
      console.warn('[email] Resend failed:', err.message)
    }
  }

  return { success: true, logged: true, to: destination }
}

export function verificationEmailContent({ appUrl, token, otp }) {
  const link = `${appUrl}/verify?token=${encodeURIComponent(token)}`
  const subject = 'Verify your BuildBot account'
  const text = [
    'Welcome to BuildBot!',
    '',
    `Your verification code (OTP): ${otp}`,
    '',
    `Or open this link: ${link}`,
    '',
    'This code expires in 24 hours.',
  ].join('\n')
  const html = emailShell(`
  <h1>Verify your email</h1>
  <p>Welcome to BuildBot! Use the code below to verify your account.</p>
  <div class="code">${otp}</div>
  <p>Or click the button to verify automatically:</p>
  <a class="btn" href="${link}">Verify my email</a>
  <p class="note">This code expires in 24 hours. If you didn't sign up for BuildBot, you can ignore this email.</p>
`)
  return { subject, text, html, link }
}

export function welcomeEmailContent({ email, storeId, trialDays = 14 }) {
  const subject = 'Welcome to BuildBot — your trial has started'
  const text = `Hi! Your BuildBot account (${email}) is verified.\nStore id: ${storeId}\nLog in and finish store setup.`
  const dashUrl = (process.env.APP_URL || 'https://build-volt.vercel.app') + '/dashboard'
  const html = emailShell(`
  <h1>Welcome to BuildBot! 🎉</h1>
  <p>Your account is verified and your ${trialDays}-day free trial has started. Here's how to get going:</p>
  <p><strong>1. Finish store setup</strong> — add your store name, brand color, and currency.</p>
  <p><strong>2. Add your products</strong> — upload a CSV or connect WooCommerce to sync your catalog.</p>
  <p><strong>3. Embed the widget</strong> — copy one script tag to your store and you're live.</p>
  <a class="btn" href="${dashUrl}">Open your dashboard</a>
  <p class="note">Store ID: <code>${storeId}</code></p>
`)
  return { subject, text, html }
}

export function passwordResetEmailContent({ appUrl, token, otp }) {
  const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
  const subject = 'Reset your BuildBot password'
  const text = [
    `Your password reset code: ${otp}`,
    '',
    `Or open: ${link}`,
    '',
    'Expires in 1 hour.',
  ].join('\n')
  const html = emailShell(`
  <h1>Password reset</h1>
  <p>Use the code below to reset your BuildBot password.</p>
  <div class="code">${otp}</div>
  <p>Or click the button:</p>
  <a class="btn" href="${link}">Reset my password</a>
  <p class="note">This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
`)
  return { subject, text, html, link }
}

export function paymentReceiptEmailContent({ storeName, plan, amount, method, planEnds, extended = false, currency = 'PKR' }) {
  const dashUrl = (process.env.APP_URL || 'https://build-volt.vercel.app') + '/dashboard'
  const planLabel = String(plan || '').charAt(0).toUpperCase() + String(plan || '').slice(1)
  const amountLabel = `${currency} ${Number(amount || 0).toLocaleString()}`
  const renewalLabel = planEnds
    ? new Date(planEnds).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  const subject = extended
    ? `Payment receipt — ${planLabel} plan extended`
    : `Payment receipt — ${planLabel} plan activated`
  const introLine = extended
    ? `We've received your payment and extended your ${planLabel} plan.`
    : `We've received your payment for the ${planLabel} plan.`
  const text = [
    `Hi ${storeName || 'there'},`,
    '',
    introLine,
    '',
    `Amount: ${amountLabel}`,
    `Method: ${method}`,
    renewalLabel ? `Active until: ${renewalLabel}` : '',
    '',
    'Your widget is live with the new plan limits — nothing else to do.',
  ].filter(Boolean).join('\n')
  const html = emailShell(`
  <h1>Payment received ✓</h1>
  <p>Hi ${storeName || 'there'}, thanks ${extended ? 'for renewing' : 'for upgrading'} — here's your receipt.</p>
  <table style="width:100%;border-collapse:collapse;margin:1rem 0;font-size:0.92rem">
    <tr><td style="padding:0.5rem 0;color:#64748B">Plan</td><td style="padding:0.5rem 0;text-align:right;font-weight:700">${planLabel}</td></tr>
    <tr style="border-top:1px solid #E2E8F0"><td style="padding:0.5rem 0;color:#64748B">Amount</td><td style="padding:0.5rem 0;text-align:right;font-weight:700;color:#2A5EE8">${amountLabel}</td></tr>
    <tr style="border-top:1px solid #E2E8F0"><td style="padding:0.5rem 0;color:#64748B">Payment method</td><td style="padding:0.5rem 0;text-align:right">${method}</td></tr>
    ${renewalLabel ? `<tr style="border-top:1px solid #E2E8F0"><td style="padding:0.5rem 0;color:#64748B">Active until</td><td style="padding:0.5rem 0;text-align:right">${renewalLabel}</td></tr>` : ''}
  </table>
  <p>Your widget is already live with the new plan's limits — there's nothing else you need to do.</p>
  <a class="btn" href="${dashUrl}/billing">View billing</a>
  <p class="note">Keep this email as your receipt for this payment.</p>
`)
  return { subject, text, html }
}

export function paymentRejectedEmailContent({ storeName, plan, amount, reason, currency = 'PKR' }) {
  const dashUrl = (process.env.APP_URL || 'https://build-volt.vercel.app') + '/dashboard'
  const planLabel = String(plan || '').charAt(0).toUpperCase() + String(plan || '').slice(1)
  const amountLabel = `${currency} ${Number(amount || 0).toLocaleString()}`
  const subject = `Payment could not be verified — ${planLabel} plan`
  const text = [
    `Hi ${storeName || 'there'},`,
    '',
    `We couldn't verify your ${amountLabel} payment for the ${planLabel} plan.`,
    reason ? `Reason: ${reason}` : '',
    '',
    'Please double-check the transaction ID and amount, then resubmit from Billing — or reach out if you think this is a mistake.',
  ].filter(Boolean).join('\n')
  const html = emailShell(`
  <h1>We couldn't verify your payment</h1>
  <p>Hi ${storeName || 'there'}, we reviewed your <strong>${amountLabel}</strong> submission for the <strong>${planLabel}</strong> plan but couldn't verify it.</p>
  ${reason ? `<p style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:0.65rem 0.85rem;border-radius:0 6px 6px 0;color:#92400E">${reason}</p>` : ''}
  <p>Double-check the transaction ID and amount, then resubmit from Billing — or reply to this email if you think this is a mistake.</p>
  <a class="btn" href="${dashUrl}/billing">Resubmit payment</a>
`)
  return { subject, text, html }
}

export function paymentRefundedEmailContent({ storeName, plan, amount, reason, currency = 'PKR' }) {
  const dashUrl = (process.env.APP_URL || 'https://build-volt.vercel.app') + '/dashboard'
  const planLabel = String(plan || '').charAt(0).toUpperCase() + String(plan || '').slice(1)
  const amountLabel = `${currency} ${Number(amount || 0).toLocaleString()}`
  const subject = `Your ${planLabel} plan payment has been refunded`
  const text = [
    `Hi ${storeName || 'there'},`,
    '',
    `Your ${amountLabel} payment for the ${planLabel} plan has been refunded, and the plan has been deactivated.`,
    reason ? `Reason: ${reason}` : '',
    '',
    'Your widget will pause until you choose a plan again from Billing.',
  ].filter(Boolean).join('\n')
  const html = emailShell(`
  <h1>Payment refunded</h1>
  <p>Hi ${storeName || 'there'}, your <strong>${amountLabel}</strong> payment for the <strong>${planLabel}</strong> plan has been refunded and the plan is now deactivated.</p>
  ${reason ? `<p style="background:#F8FAFC;border-left:3px solid #64748B;padding:0.65rem 0.85rem;border-radius:0 6px 6px 0;color:#334155">${reason}</p>` : ''}
  <p>Your widget will pause until you choose a plan again.</p>
  <a class="btn" href="${dashUrl}/billing">Go to Billing</a>
`)
  return { subject, text, html }
}

export function planRenewalReminderEmailContent({ storeName, plan, planEnds, daysLeft }) {
  const dashUrl = (process.env.APP_URL || 'https://build-volt.vercel.app') + '/dashboard'
  const planLabel = String(plan || '').charAt(0).toUpperCase() + String(plan || '').slice(1)
  const subject = daysLeft === 1
    ? `Your ${planLabel} plan renews tomorrow`
    : `Your ${planLabel} plan renews in ${daysLeft} days`
  const text = `Hi ${storeName || 'there'}, your BuildBot ${planLabel} plan ends on ${planEnds}. Renew from Billing to avoid any interruption to your widget.`
  const html = emailShell(`
  <h1>${daysLeft === 1 ? 'Your plan renews tomorrow' : `Your plan renews in ${daysLeft} days`}</h1>
  <p>Hi ${storeName || 'there'}, your <strong>${planLabel}</strong> plan is set to end on <strong>${new Date(planEnds).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
  <p>Renew now so your widget and recommendation limits continue without any gap.</p>
  <a class="btn" href="${dashUrl}/billing">Renew plan</a>
`)
  return { subject, text, html }
}

export function adminPasswordResetEmailContent({ appUrl, token, otp }) {
  const link = `${appUrl}/admin?resetToken=${encodeURIComponent(token)}`
  const subject = 'Reset your BuildBot admin password'
  const text = [
    `Your admin password reset code: ${otp}`,
    '',
    `Or open: ${link}`,
    '',
    'Expires in 1 hour.',
  ].join('\n')
  const html = emailShell(`
  <h1>Admin password reset</h1>
  <p>Use the code below to reset the BuildBot admin password.</p>
  <div class="code">${otp}</div>
  <a class="btn" href="${link}">Reset admin password</a>
  <p class="note">Expires in 1 hour.</p>
`)
  return { subject, text, html, link }
}
