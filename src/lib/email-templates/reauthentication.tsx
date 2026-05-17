import * as React from "react";

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ReauthenticationEmailProps {
  token: string;
  siteName?: string;
}

export const ReauthenticationEmail = ({
  token,
  siteName = "Majix",
}: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>{siteName}</Text>
        </Section>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Enter the verification code below to confirm your identity:</Text>
        <Section style={codeBox}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can safely ignore this
          email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ReauthenticationEmail;

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
const codeBox = {
  backgroundColor: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "20px",
  textAlign: "center" as const,
  margin: "0 0 28px",
};
const codeStyle = {
  fontFamily: "'JetBrains Mono', Courier, monospace",
  fontSize: "28px",
  fontWeight: "bold" as const,
  color: "#0b0f1c",
  letterSpacing: "0.2em",
  margin: "0",
};
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "32px 0 0",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "20px",
};
