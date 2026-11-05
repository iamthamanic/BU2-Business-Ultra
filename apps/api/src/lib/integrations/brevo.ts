/**
 * Brevo transactional + campaign client (business-scoped key).
 */
import { parseFetchJson } from '../parseFetchJson.js'

export async function brevoGetAccount(apiKey: string) {
  const res = await fetch('https://api.brevo.com/v3/account', {
    headers: { 'api-key': apiKey, accept: 'application/json' },
  })
  return { ok: res.ok, status: res.status, body: await parseFetchJson(res) }
}

export async function createEmailCampaign(
  apiKey: string,
  input: {
    name: string
    subject: string
    htmlContent: string
    sender: { name: string; email: string }
    recipients?: { listIds?: number[] }
  },
): Promise<{ mode: 'live' | 'stub'; remoteId: string | null; detail?: string }> {
  try {
    const res = await fetch('https://api.brevo.com/v3/emailCampaigns', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        subject: input.subject,
        htmlContent: input.htmlContent,
        sender: input.sender,
        recipients: input.recipients ?? { listIds: [] },
      }),
    })
    const body = (await parseFetchJson(res)) as { id?: number; message?: string }
    if (res.ok && body.id != null) {
      return { mode: 'live', remoteId: String(body.id) }
    }
    return {
      mode: 'stub',
      remoteId: `brevo-stub-${Date.now()}`,
      detail: `create_http_${res.status}:${body.message ?? ''}`,
    }
  } catch (e) {
    return { mode: 'stub', remoteId: `brevo-stub-${Date.now()}`, detail: String(e) }
  }
}

export async function sendEmailCampaignNow(
  apiKey: string,
  remoteId: string,
): Promise<{ mode: 'live' | 'stub'; ok: boolean; detail?: string }> {
  if (remoteId.startsWith('brevo-stub-')) {
    return { mode: 'stub', ok: true, detail: 'stub_send' }
  }
  try {
    const res = await fetch(`https://api.brevo.com/v3/emailCampaigns/${remoteId}/sendNow`, {
      method: 'POST',
      headers: { 'api-key': apiKey, accept: 'application/json' },
    })
    if (res.ok) return { mode: 'live', ok: true }
    return { mode: 'stub', ok: false, detail: `send_http_${res.status}` }
  } catch (e) {
    return { mode: 'stub', ok: false, detail: String(e) }
  }
}
