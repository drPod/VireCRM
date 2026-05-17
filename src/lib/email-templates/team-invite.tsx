import * as React from "react";
import {
  Body,
  Button,
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

interface TeamInviteProps {
  inviterName?: string;
  organizationName?: string;
  roleLabel?: string;
  acceptUrl?: string;
  brandName?: string;
}

const TeamInviteEmail = ({
  inviterName = "Your team owner",
  organizationName = "their CRM workspace",
  roleLabel = "Team Member",
  acceptUrl = "https://majix.ai",
  brandName = "Majix",
}: TeamInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {inviterName} invited you to join {organizationName} on {brandName}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>{brandName}</Text>
        </Section>
        <Heading style={h1}>You&apos;ve been invited</Heading>
        <Text style={text}>
          <strong>{inviterName}</strong> has invited you to join <strong>{organizationName}</strong>{" "}
          on {brandName} as a <strong>{roleLabel}</strong>.
        </Text>
        <Text style={text}>
          Click the button below to accept the invitation and set up your account.
        </Text>
        <Section style={ctaWrap}>
          <Button style={button} href={acceptUrl}>
            Accept invitation
          </Button>
        </Section>
        <Text style={fallback}>
          Or paste this link into your browser:
          <br />
          <Link href={acceptUrl} style={fallbackUrl}>
            {acceptUrl}
          </Link>
        </Text>
        <Text style={footer}>
          This invitation will expire in 7 days. If you weren&apos;t expecting it, you can safely
          ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: TeamInviteEmail,
  subject: (data: Record<string, any>) =>
    `You've been invited to join ${data?.organizationName ?? "a team"} on ${data?.brandName ?? "Majix"}`,
  displayName: "Team invitation",
  previewData: {
    inviterName: "Alex Owner",
    organizationName: "Acme Sales Co.",
    roleLabel: "Sales Rep",
    acceptUrl: "https://majix.ai/accept-invite?token=sample",
    brandName: "Majix",
  },
} satisfies TemplateEntry;

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
  margin: "0 0 20px",
};
const ctaWrap = { margin: "8px 0 28px" };
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
const fallbackUrl = {
  color: "#3b82f6",
  wordBreak: "break-all" as const,
  textDecoration: "underline",
};
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "32px 0 0",
  borderTop: "1px solid #e2e8f0",
  paddingTop: "20px",
};
