import { loadEnv } from './env.js'

export async function sendMagicLinkEmail(opts: {
  to: string
  magicUrl: string
  otp: string
}): Promise<{ mode: 'live' | 'console' }> {
  const env = loadEnv()
  const subject = 'Business Ultra — Anmeldelink / Login link'
  const html = `
    <p>Hallo / Hello,</p>
    <p><a href="${opts.magicUrl}">Magic Link</a></p>
    <p>OTP: <strong>${opts.otp}</strong> (10 min)</p>
  `

  if (!env.BREVO_API_KEY) {
    console.info('[auth] BREVO_API_KEY missing — console fallback')
    console.info(`[auth] magic link for ${opts.to}: ${opts.magicUrl}`)
    console.info(`[auth] OTP for ${opts.to}: ${opts.otp}`)
    return { mode: 'console' }
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: opts.to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[auth] Brevo send failed', res.status, body)
    console.info(`[auth] fallback magic link for ${opts.to}: ${opts.magicUrl}`)
    console.info(`[auth] fallback OTP for ${opts.to}: ${opts.otp}`)
    return { mode: 'console' }
  }
  return { mode: 'live' }
}
