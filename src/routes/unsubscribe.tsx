import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, MailX, CheckCircle2, AlertTriangle } from 'lucide-react'

type State =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'already' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) {
      setState({ kind: 'invalid', message: 'Missing unsubscribe token.' })
      return
    }
    setToken(t)
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          setState({
            kind: 'invalid',
            message: data?.error || 'This unsubscribe link is invalid.',
          })
          return
        }
        if (data?.valid === false && data?.reason === 'already_unsubscribed') {
          setState({ kind: 'already' })
          return
        }
        if (data?.valid) {
          setState({ kind: 'ready' })
          return
        }
        setState({ kind: 'invalid', message: 'Unable to verify token.' })
      })
      .catch(() =>
        setState({ kind: 'invalid', message: 'Unable to verify token.' }),
      )
  }, [])

  const handleConfirm = async () => {
    if (!token) return
    setState({ kind: 'submitting' })
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setState({
          kind: 'invalid',
          message: data?.error || 'Unable to process unsubscribe.',
        })
        return
      }
      if (data?.success === false && data?.reason === 'already_unsubscribed') {
        setState({ kind: 'already' })
        return
      }
      setState({ kind: 'done' })
    } catch {
      setState({ kind: 'invalid', message: 'Network error. Please retry.' })
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        {state.kind === 'loading' && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Verifying your link…
            </p>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MailX className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Unsubscribe from emails
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You'll stop receiving messages from us. You can resubscribe by
              contacting support.
            </p>
            <Button
              variant="command"
              className="mt-6 w-full"
              onClick={handleConfirm}
            >
              Confirm unsubscribe
            </Button>
          </div>
        )}

        {state.kind === 'submitting' && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Processing your request…
            </p>
          </div>
        )}

        {state.kind === 'done' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              You're unsubscribed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You won't receive any more emails from us.
            </p>
          </div>
        )}

        {state.kind === 'already' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Already unsubscribed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This email address has already been removed from our list.
            </p>
          </div>
        )}

        {state.kind === 'invalid' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Invalid link
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
})
