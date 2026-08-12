import { getDb } from './database.js'

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
  const html = `<p>Welcome to BuildBot!</p>
<p>Your verification code: <strong>${otp}</strong></p>
<p><a href="${link}">Verify your email</a></p>
<p>Expires in 24 hours.</p>`
  return { subject, text, html, link }
}

export function welcomeEmailContent({ email, storeId }) {
  const subject = 'Welcome to BuildBot — your trial has started'
  const text = `Hi! Your BuildBot account (${email}) is verified.\nStore id: ${storeId}\nLog in and finish store setup.`
  const html = `<p>Your BuildBot account is verified.</p><p>Store id: <code>${storeId}</code></p>`
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
  const html = `<p>Reset code: <strong>${otp}</strong></p><p><a href="${link}">Reset password</a></p>`
  return { subject, text, html, link }
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
  const html = `<p>Admin reset code: <strong>${otp}</strong></p><p><a href="${link}">Reset password</a></p>`
  return { subject, text, html, link }
}
