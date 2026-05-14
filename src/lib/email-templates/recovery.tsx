import * as React from "react";

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
} from "@react-email/components";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>{siteName}</Text>
        </Section>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password on your {siteName} account. Click the button
          below to choose a new one.
        </Text>
        <Section style={ctaWrap}>
          <Button style={button} href={confirmationUrl}>
            Reset password
          </Button>
        </Section>
        <Text style={fallback}>
          Or paste this link into your browser:
          <br />
          <span style={fallbackUrl}>{confirmationUrl}</span>
        </Text>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this email — your password
          won't change.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};
const container = { padding: "32px 24px", maxWidth: "560px" };
const brandBar = { paddingBottom: "24px" };
const brandText = {
  fontSize: "20px",
  fontWeight: "bold" as const,
  color: "#3b82f6",
  margin: "0",
  letterSpacing: "-0.01em",
};
const h1 = {
  fontSize: "24px",
  fontWeight: "bold" as const,
  color: "#0b0f1c",
  margin: "0 0 16px",
  letterSpacing: "-0.01em",
};
const text = {
  fontSize: "15px",
  color: "#475569",
  lineHeight: "1.6",
  margin: "0 0 24px",
};
const ctaWrap = { margin: "0 0 28px" };
const button = {
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600" as const,
  borderRadius: "8px",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const fallback = {
  fontSize: "13px",
  color: "#64748b",
  lineHeight: "1.5",
  margin: "0 0 32px",
};
const fallbackUrl = { color: "#3b82f6", wordBreak: "break-all" as const };
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "32px 0 0",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "20px",
};
