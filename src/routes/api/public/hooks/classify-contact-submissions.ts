/**
 * Cron sweeper: classify any contact submissions that don't yet have an
 * AI sentiment/topic. Runs every few minutes via pg_cron and also catches
 * anything where the inline classification (in /api/public/contact) failed.
 */
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { classifyAndStore } from '@/lib/contact/classify-submission'

const BATCH_SIZE = 10

export const Route = createFileRoute('/api/public/hooks/classify-contact-submissions')({
  server: {
    handlers: {
      POST: async () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server not configured' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, serviceKey)

        const { data: pending, error } = await supabase
          .from('contact_submissions')
          .select('id, name, email, company, message, budget')
          .is('classified_at', null)
          .order('created_at', { ascending: true })
          .limit(BATCH_SIZE)

        if (error) {
          console.error('classify cron: query failed', error)
          return Response.json({ error: error.message }, { status: 500 })
        }

        if (!pending || pending.length === 0) {
          return Response.json({ ok: true, processed: 0 })
        }

        let succeeded = 0
        let failed = 0
        // Sequential to stay under AI rate limits on bursty backlogs.
        for (const row of pending) {
          const res = await classifyAndStore(supabase as any, row as any)
          if (res.ok) succeeded++
          else failed++
        }

        return Response.json({ ok: true, processed: pending.length, succeeded, failed })
      },
    },
  },
})
