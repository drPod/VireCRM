/**
 * Cron-triggered hook: scans contact_submissions for entries that are still
 * in `received` status more than 24 hours after they came in (i.e. nobody
 * has marked them as replied) and emails the owner a follow-up reminder.
 *
 * Fires hourly via pg_cron. Each submission is reminded at most once per
 * 24h (tracked via contact_submissions.last_reminder_at).
 */
import { createFileRoute } from '@tanstack/react-router'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '@/lib/email-templates/registry'

type AdminClient = SupabaseClient<any, any, any, any, any>

const SENDER_DOMAIN = 'notify.vireonx.space'
const FROM_DOMAIN = 'vireonx.space'
const FROM_DISPLAY_NAME = 'Genesis Contact Form'
const REMINDER_DELAY_HOURS = 24
const REMINDER_COOLDOWN_HOURS = 24
const BATCH_LIMIT = 50

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute('/api/public/hooks/contact-followup-reminders')({
  server: {
    handlers: {
      POST: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return Response.json({ error: 'Missing service credentials' }, { status: 500 })
        }
        const supabase = createClient(SUPABASE_URL, SERVICE_KEY) as AdminClient

        const template = TEMPLATES['contact-followup-reminder']
        if (!template || !template.to) {
          return Response.json({ error: 'Reminder template misconfigured' }, { status: 500 })
        }
        const recipient = template.to

        const now = Date.now()
        const olderThan = new Date(now - REMINDER_DELAY_HOURS * 3600 * 1000).toISOString()
        const cooldownCutoff = new Date(now - REMINDER_COOLDOWN_HOURS * 3600 * 1000).toISOString()

        // Pull candidates: still received, no reply, older than 24h, and either
        // never reminded or last reminded > 24h ago.
        const { data: candidates, error: fetchErr } = await supabase
          .from('contact_submissions')
          .select(
            'id, name, email, company, phone, budget, message, created_at, last_reminder_at, replied_at, status, test_mode'
          )
          .eq('status', 'received')
          .is('replied_at', null)
          .eq('test_mode', false)
          .lte('created_at', olderThan)
          .or(`last_reminder_at.is.null,last_reminder_at.lte.${cooldownCutoff}`)
          .order('created_at', { ascending: true })
          .limit(BATCH_LIMIT)

        if (fetchErr) {
          return Response.json({ error: fetchErr.message }, { status: 500 })
        }

        if (!candidates || candidates.length === 0) {
          return Response.json({ ok: true, reminded: 0, ran_at: new Date().toISOString() })
        }

        // Skip if owner inbox is suppressed.
        const { data: suppressed } = await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', recipient.toLowerCase())
          .maybeSingle()
        if (suppressed) {
          return Response.json({ ok: true, reminded: 0, note: 'Owner inbox suppressed' })
        }

        // Reuse-or-create unsubscribe token for the owner inbox.
        let unsubscribeToken: string
        const { data: existingToken } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token, used_at')
          .eq('email', recipient.toLowerCase())
          .maybeSingle()
        if (existingToken && !existingToken.used_at) {
          unsubscribeToken = existingToken.token
        } else {
          unsubscribeToken = generateToken()
          await supabase
            .from('email_unsubscribe_tokens')
            .upsert(
              { token: unsubscribeToken, email: recipient.toLowerCase() } as any,
              { onConflict: 'email', ignoreDuplicates: true }
            )
          const { data: stored } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token')
            .eq('email', recipient.toLowerCase())
            .maybeSingle()
          unsubscribeToken = stored?.token ?? unsubscribeToken
        }

        let remindedCount = 0
        const errors: Array<{ id: string; error: string }> = []

        for (const sub of candidates) {
          try {
            const hoursElapsed = Math.floor(
              (now - new Date(sub.created_at).getTime()) / (3600 * 1000)
            )
            const data = {
              name: sub.name,
              email: sub.email,
              company: sub.company,
              phone: sub.phone,
              budget: sub.budget,
              message: sub.message,
              receivedAt: new Date(sub.created_at).toISOString(),
              hoursElapsed,
            }
            const element = React.createElement(template.component, data)
            const html = await render(element)
            const text = await render(element, { plainText: true })
            const subject =
              typeof template.subject === 'function' ? template.subject(data) : template.subject

            const messageId = crypto.randomUUID()
            const idempotencyKey = `contact-reminder-${sub.id}-${Math.floor(now / (3600 * 1000 * REMINDER_COOLDOWN_HOURS))}`

            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'contact-followup-reminder',
              recipient_email: recipient,
              status: 'pending',
              metadata: {
                subject,
                body_preview: text.replace(/\s+/g, ' ').trim().slice(0, 200),
                contact_submission_id: sub.id,
                hours_elapsed: hoursElapsed,
              },
            } as any)

            const { error: enqueueErr } = await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: messageId,
                to: recipient,
                from: `${FROM_DISPLAY_NAME} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject,
                body_preview: text.slice(0, 200),
                html,
                text,
                purpose: 'transactional',
                label: 'contact-followup-reminder',
                idempotency_key: idempotencyKey,
                unsubscribe_token: unsubscribeToken,
                reply_to: sub.email,
                queued_at: new Date().toISOString(),
              },
            } as any)

            if (enqueueErr) {
              errors.push({ id: sub.id, error: enqueueErr.message })
              await supabase.from('email_send_log').insert({
                message_id: messageId,
                template_name: 'contact-followup-reminder',
                recipient_email: recipient,
                status: 'failed',
                error_message: 'Failed to enqueue follow-up reminder',
              } as any)
              continue
            }

            // Stamp the submission so we don't re-fire for another 24h.
            await supabase
              .from('contact_submissions')
              .update({ last_reminder_at: new Date().toISOString() } as any)
              .eq('id', sub.id)

            remindedCount += 1
          } catch (err) {
            errors.push({
              id: sub.id,
              error: err instanceof Error ? err.message : 'Unknown error',
            })
          }
        }

        return Response.json({
          ok: true,
          reminded: remindedCount,
          errors: errors.length ? errors : undefined,
          ran_at: new Date().toISOString(),
        })
      },
    },
  },
})
