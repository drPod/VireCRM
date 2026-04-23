import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Genesis'

interface ReviewRequestProps {
  brandName?: string
  customerName?: string
  senderName?: string
  reviewUrl?: string
  customMessage?: string
}

const ReviewRequestEmail = ({
  brandName,
  customerName,
  senderName,
  reviewUrl,
  customMessage,
}: ReviewRequestProps) => {
  const fromBrand = brandName || SITE_NAME
  const greeting = customerName ? `Hi ${customerName},` : 'Hi there,'
  const signOff = senderName ? `— ${senderName}, ${fromBrand}` : `— The ${fromBrand} team`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Quick favor — share your experience with {fromBrand}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Got 30 seconds to share your experience?</Heading>
          <Text style={lede}>{greeting}</Text>
          <Text style={text}>
            {customMessage ||
              `It's been a pleasure working with you. If you've had a good experience with ${fromBrand}, would you mind leaving us a quick review? It genuinely helps other people decide whether we're the right fit — and it takes less than a minute.`}
          </Text>

          {reviewUrl && (
            <Section style={ctaWrap}>
              <Button href={reviewUrl} style={ctaBtn}>
                Leave a review
              </Button>
            </Section>
          )}

          <Text style={text}>
            If something didn't go the way you'd hoped, just reply to this email
            and let us know — we'd rather hear it directly so we can fix it.
          </Text>

          <Text style={footer}>
            Thanks again,
            <br />
            {signOff}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewRequestEmail,
  subject: (data: Record<string, any>) =>
    data?.customerName
      ? `${data.customerName}, would you share a quick review?`
      : `Would you share a quick review of ${data?.brandName || SITE_NAME}?`,
  displayName: 'Review request',
  previewData: {
    brandName: 'Acme CRM',
    customerName: 'Jane',
    senderName: 'Alex',
    reviewUrl: 'https://g.page/r/example/review',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 600,
  color: '#0b0f1c',
  margin: '0 0 16px',
}
const lede = {
  fontSize: '15px',
  color: '#0b0f1c',
  margin: '0 0 12px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const ctaWrap = { margin: '20px 0 24px' }
const ctaBtn = {
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: '28px 0 0',
  lineHeight: '1.5',
}
