import { supabase } from '@/integrations/supabase/client'

interface SendTransactionalEmailParams {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Send a transactional email via the built-in `/lovable/email/transactional/send`
 * server route. Requires an authenticated Supabase session — the caller's JWT
 * is forwarded as the Bearer token.
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<{ success: boolean; reason?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch('/lovable/email/transactional/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      templateName: params.templateName,
      recipientEmail: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      templateData: params.templateData,
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const errBody = await response.json()
      detail = errBody?.error ? ` — ${errBody.error}` : ''
    } catch {
      // ignore
    }
    throw new Error(`Failed to send email (${response.status})${detail}`)
  }

  return response.json()
}
