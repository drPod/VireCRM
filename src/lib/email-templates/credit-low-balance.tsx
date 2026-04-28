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

interface CreditLowBalanceProps {
  organizationName?: string
  balance?: number
  threshold?: number
  billingUrl?: string
  autoRechargeEnabled?: boolean
}

const CreditLowBalanceEmail = ({
  organizationName,
  balance = 0,
  threshold = 0,
  billingUrl,
  autoRechargeEnabled,
}: CreditLowBalanceProps) => {
  const orgLine = organizationName ? ` for ${organizationName}` : ''
  const href = billingUrl || 'https://genesisx.space/billing'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Your {SITE_NAME} credit balance is low — {balance} credits remaining.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your credit balance is running low</Heading>
          <Text style={text}>
            Heads up — the credit balance{orgLine} just dropped below your alert
            threshold.
          </Text>

          <Section style={statCard}>
            <Text style={statLabel}>Current balance</Text>
            <Text style={statValue}>{balance.toLocaleString()} credits</Text>
            <Text style={statSubtle}>
              Threshold: {threshold.toLocaleString()} credits
            </Text>
          </Section>

          {autoRechargeEnabled ? (
            <Text style={text}>
              Auto-recharge is <strong>on</strong>, so a top-up pack will be
              charged to your saved card automatically. You can review or
              change this anytime from your billing page.
            </Text>
          ) : (
            <Text style={text}>
              Auto-recharge is currently <strong>off</strong>. To avoid any
              interruption, top up manually or enable auto-recharge from your
              billing page.
            </Text>
          )}

          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={href} style={button}>
              Open billing
            </Button>
          </Section>

          <Text style={footer}>
            You're receiving this because low-balance alerts are enabled for
            your {SITE_NAME} workspace. You can change the threshold or turn
            alerts off from the billing page.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CreditLowBalanceEmail,
  subject: (data: Record<string, any>) => {
    const bal = typeof data?.balance === 'number' ? data.balance : 0
    return `Low credit balance alert — ${bal.toLocaleString()} credits left`
  },
  displayName: 'Credit low balance alert',
  previewData: {
    organizationName: 'Acme Inc.',
    balance: 38,
    threshold: 50,
    billingUrl: 'https://genesisx.space/billing',
    autoRechargeEnabled: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 14px',
}
const statCard = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '18px 20px',
  margin: '20px 0',
  textAlign: 'center' as const,
}
const statLabel = {
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#64748b',
  margin: '0 0 6px',
}
const statValue = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#7c3aed',
  margin: '0 0 4px',
}
const statSubtle = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: 0,
}
const button = {
  backgroundColor: '#7c3aed',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 'bold',
}
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '28px 0 0',
  lineHeight: '1.5',
}
