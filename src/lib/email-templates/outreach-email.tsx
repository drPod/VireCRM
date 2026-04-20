import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Vireon'

interface OutreachEmailProps {
  /** AI-generated body text. Newlines become paragraph breaks. */
  body?: string
  /** Sender's brand name (org/reseller name shown in sign-off). */
  brandName?: string
  /** Optional sender display name appended to the sign-off. */
  senderName?: string
}

/**
 * Generic AI cold-outreach template. The subject and body are produced by
 * the auto-outreach server function and passed in as templateData. Keeping
 * formatting minimal so the AI's copy reads naturally and doesn't look
 * "templated."
 */
const OutreachEmail = ({ body, brandName, senderName }: OutreachEmailProps) => {
  const fromBrand = brandName || SITE_NAME
  const signOff = senderName ? `— ${senderName}, ${fromBrand}` : `— ${fromBrand}`
  // Split AI body into paragraphs on double newlines (or single line breaks).
  const paragraphs = (body || 'Hello — wanted to reach out.')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{paragraphs[0]?.slice(0, 90) || `A note from ${fromBrand}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>
              {p}
            </Text>
          ))}
          <Text style={footer}>{signOff}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OutreachEmail,
  // Subject is always supplied at send-time via templateData.subject; the
  // fallback only matters for dashboard preview.
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `A quick note from ${SITE_NAME}`,
  displayName: 'AI outreach email',
  previewData: {
    subject: 'Quick question about your sales pipeline',
    brandName: 'Acme CRM',
    senderName: 'Alex',
    body:
      "Hi Jane,\n\nNoticed Acme is scaling fast — congrats on the recent growth. We help teams like yours automate cold outreach and book 3x more meetings without adding headcount.\n\nWould you be open to a 15-minute chat next week to see if it'd be a fit?",
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const text = {
  fontSize: '14px',
  color: '#0b0f1c',
  lineHeight: '1.65',
  margin: '0 0 14px',
}
const footer = {
  fontSize: '13px',
  color: '#64748b',
  margin: '24px 0 0',
  lineHeight: '1.5',
}
