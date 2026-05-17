import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SUPPORT_EMAIL } from "@/config/support";

const SITE_NAME = "Majix";
// Fixed inbox — every public contact form submission lands here.
// Sourced from the single SUPPORT_EMAIL constant so it can never drift.
const OWNER_INBOX = SUPPORT_EMAIL;

interface ContactInquiryProps {
  name?: string;
  email?: string;
  company?: string | null;
  phone?: string | null;
  budget?: string | null;
  message?: string;
}

/**
 * Internal notification email sent to the site owner whenever a visitor
 * submits the public contact form. Recipient is hard-locked via `to` in the
 * template registry entry below — the public API route can't override it.
 */
const ContactInquiryEmail = ({
  name,
  email,
  company,
  phone,
  budget,
  message,
}: ContactInquiryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      New inquiry from {name || "a visitor"} via the {SITE_NAME} contact form
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New contact form inquiry</Heading>
        <Text style={lede}>
          Someone just reached out through the {SITE_NAME} site. Details below.
        </Text>

        <Section style={card}>
          <Row label="Name" value={name || "—"} />
          <Row label="Email" value={email || "—"} />
          <Row label="Company" value={company || "—"} />
          <Row label="Phone" value={phone || "—"} />
          <Row label="Budget" value={budget || "—"} />
        </Section>

        <Hr style={hr} />

        <Heading as="h2" style={h2}>
          Message
        </Heading>
        <Text style={messageBlock}>{(message || "(no message provided)").slice(0, 4000)}</Text>

        <Hr style={hr} />
        <Text style={footer}>
          Reply directly to this email to respond — the visitor's address is set as the Reply-To.
        </Text>
      </Container>
    </Body>
  </Html>
);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text style={rowText}>
      <span style={rowLabel}>{label}: </span>
      <span style={rowValue}>{value}</span>
    </Text>
  );
}

export const template = {
  component: ContactInquiryEmail,
  subject: (data: Record<string, any>) =>
    `New ${SITE_NAME} inquiry — ${data?.name || "unknown"}${data?.company ? ` (${data.company})` : ""}`,
  displayName: "Contact form inquiry (internal)",
  // Hard-locked recipient. The send route honors this over any caller input.
  to: OWNER_INBOX,
  previewData: {
    name: "Jane Smith",
    email: "jane@acme.com",
    company: "Acme Corp",
    phone: "+1 555 555 5555",
    budget: "$25,000+",
    message: "We need a custom CRM that ties into our existing booking system.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const h1 = { fontSize: "22px", fontWeight: 700 as const, color: "#0b0b0f", margin: "0 0 8px" };
const h2 = { fontSize: "16px", fontWeight: 600 as const, color: "#0b0b0f", margin: "20px 0 8px" };
const lede = { fontSize: "14px", color: "#52525b", lineHeight: "1.5", margin: "0 0 20px" };
const card = {
  backgroundColor: "#fafafa",
  border: "1px solid #e4e4e7",
  borderRadius: "8px",
  padding: "16px 18px",
};
const rowText = { fontSize: "14px", color: "#0b0b0f", margin: "4px 0", lineHeight: "1.45" };
const rowLabel = { color: "#71717a", fontWeight: 500 as const };
const rowValue = { color: "#0b0b0f" };
const messageBlock = {
  fontSize: "14px",
  color: "#0b0b0f",
  lineHeight: "1.6",
  margin: "0 0 8px",
  whiteSpace: "pre-wrap" as const,
};
const hr = { borderColor: "#e4e4e7", margin: "24px 0" };
const footer = { fontSize: "12px", color: "#a1a1aa", margin: "0" };
