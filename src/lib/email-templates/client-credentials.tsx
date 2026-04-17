import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Vireon'

interface ClientCredentialsProps {
  brandName?: string
  fullName?: string
  email?: string
  password?: string
  loginUrl?: string
}

const ClientCredentialsEmail = ({
  brandName,
  fullName,
  email,
  password,
  loginUrl,
}: ClientCredentialsProps) => {
  const senderName = brandName || SITE_NAME
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {senderName} CRM account is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {fullName ? `Welcome, ${fullName}!` : 'Welcome!'}
          </Heading>
          <Text style={text}>
            Your {senderName} CRM account has been created. Use the credentials
            below to sign in.
          </Text>

          <Section style={credBox}>
            <Text style={credLabel}>Login URL</Text>
            <Text style={credValue}>
              {loginUrl ? (
                <Link href={loginUrl} style={link}>
                  {loginUrl}
                </Link>
              ) : (
                '—'
              )}
            </Text>

            <Text style={credLabel}>Email</Text>
            <Text style={credValue}>{email || '—'}</Text>

            <Text style={credLabel}>Temporary password</Text>
            <Text style={credValueMono}>{password || '—'}</Text>
          </Section>

          <Text style={text}>
            For your security, we recommend changing this password after your
            first sign in.
          </Text>

          <Text style={footer}>
            If you weren't expecting this email, you can safely ignore it.
            <br />— The {senderName} team
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ClientCredentialsEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data?.brandName || SITE_NAME} CRM login details`,
  displayName: 'Client login credentials',
  previewData: {
    brandName: 'Acme CRM',
    fullName: 'Jane Doe',
    email: 'jane@acme.com',
    password: 'TempPass-9X2k',
    loginUrl: 'https://acme.vireonx.space/login',
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
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const credBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '20px 22px',
  margin: '20px 0',
}
const credLabel = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  margin: '0 0 4px',
}
const credValue = {
  fontSize: '14px',
  color: '#0b0f1c',
  margin: '0 0 16px',
  wordBreak: 'break-all' as const,
}
const credValueMono = {
  ...credValue,
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
}
const link = { color: '#3b82f6', textDecoration: 'none' }
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '28px 0 0',
  lineHeight: '1.5',
}
