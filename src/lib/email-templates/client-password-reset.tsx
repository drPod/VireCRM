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
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Genesis";

interface ClientPasswordResetProps {
  brandName?: string;
  fullName?: string;
  email?: string;
  password?: string;
  loginUrl?: string;
}

const ClientPasswordResetEmail = ({
  brandName,
  fullName,
  email,
  password,
  loginUrl,
}: ClientPasswordResetProps) => {
  const senderName = brandName || SITE_NAME;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {senderName} password has been reset</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{fullName ? `Hi ${fullName},` : "Hi,"}</Heading>
          <Text style={text}>
            Your account password for {senderName} has been reset. Your previous password no longer
            works.
          </Text>

          <Section style={credBox}>
            <Text style={credLabel}>Login URL</Text>
            <Text style={credValue}>
              {loginUrl ? (
                <Link href={loginUrl} style={link}>
                  {loginUrl}
                </Link>
              ) : (
                "—"
              )}
            </Text>

            <Text style={credLabel}>Email</Text>
            <Text style={credValue}>{email || "—"}</Text>

            <Text style={credLabel}>New password</Text>
            <Text style={credValueMono}>{password || "—"}</Text>
          </Section>

          <Text style={text}>
            Sign in with this password and change it from your account settings for added security.
          </Text>

          <Text style={footer}>
            If you didn't request this reset, contact your account administrator immediately.
            <br />— The {senderName} team
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ClientPasswordResetEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data?.brandName || SITE_NAME} password has been reset`,
  displayName: "Client password reset",
  previewData: {
    brandName: "Acme CRM",
    fullName: "Jane Doe",
    email: "jane@acme.com",
    password: "NewPass-K8z2",
    loginUrl: "https://acme.majix.ai/login",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
};
const container = { padding: "32px 24px", maxWidth: "560px" };
const h1 = {
  fontSize: "22px",
  fontWeight: 600,
  color: "#0b0f1c",
  margin: "0 0 16px",
};
const text = {
  fontSize: "14px",
  color: "#475569",
  lineHeight: "1.6",
  margin: "0 0 16px",
};
const credBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "20px 22px",
  margin: "20px 0",
};
const credLabel = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  margin: "0 0 4px",
};
const credValue = {
  fontSize: "14px",
  color: "#0b0f1c",
  margin: "0 0 16px",
  wordBreak: "break-all" as const,
};
const credValueMono = {
  ...credValue,
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
};
const link = { color: "#3b82f6", textDecoration: "none" };
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "28px 0 0",
  lineHeight: "1.5",
};
