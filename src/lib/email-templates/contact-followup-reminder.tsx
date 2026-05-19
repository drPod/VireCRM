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

const SITE_NAME = "VireCRM";
const OWNER_INBOX = SUPPORT_EMAIL;

interface ContactFollowupReminderProps {
  name?: string;
  email?: string;
  company?: string | null;
  phone?: string | null;
  budget?: string | null;
  message?: string;
  receivedAt?: string;
  hoursElapsed?: number;
}

/**
 * Reminder email sent to the owner when a contact submission is still in
 * `received` status 24h after it came in (i.e. nobody has marked it as
 * replied yet). Cron-driven from /api/public/hooks/contact-followup-reminders.
 */
const ContactFollowupReminderEmail = ({
  name,
  email,
  company,
  phone,
  budget,
  message,
  receivedAt,
  hoursElapsed,
}: ContactFollowupReminderProps) => {
  const elapsedLabel =
    typeof hoursElapsed === "number" && hoursElapsed > 0 ? `${hoursElapsed} hours` : "24+ hours";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Reminder: {name || "A visitor"} is still waiting for a reply ({elapsedLabel}).
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>⏰ Follow-up reminder</Heading>
          <Text style={text}>
            A {SITE_NAME} contact form submission has been sitting unreplied for{" "}
            <strong>{elapsedLabel}</strong>. Please follow up or mark it as handled in the CRM.
          </Text>

          <Section style={card}>
            <Text style={label}>From</Text>
            <Text style={value}>
              {name || "Unknown"} &lt;{email || "unknown"}&gt;
            </Text>
            {company ? (
              <>
                <Text style={label}>Company</Text>
                <Text style={value}>{company}</Text>
              </>
            ) : null}
            {phone ? (
              <>
                <Text style={label}>Phone</Text>
                <Text style={value}>{phone}</Text>
              </>
            ) : null}
            {budget ? (
              <>
                <Text style={label}>Budget</Text>
                <Text style={value}>{budget}</Text>
              </>
            ) : null}
            {receivedAt ? (
              <>
                <Text style={label}>Received</Text>
                <Text style={value}>{receivedAt}</Text>
              </>
            ) : null}
          </Section>

          <Hr style={hr} />

          <Text style={label}>Message</Text>
          <Text style={messageStyle}>{message || "(no message)"}</Text>

          <Hr style={hr} />

          <Text style={footer}>
            Reply directly to this email to respond to the visitor. This reminder was generated
            automatically by {SITE_NAME} CRM and sent to {OWNER_INBOX}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ContactFollowupReminderEmail,
  to: OWNER_INBOX,
  subject: (data: Record<string, any>) =>
    `⏰ Still waiting for reply: ${data?.name || data?.email || "contact inquiry"}`,
  displayName: "Contact follow-up reminder (owner)",
  previewData: {
    name: "Jane Smith",
    email: "jane@acme.com",
    company: "Acme Corp",
    phone: "+1 555 0100",
    budget: "14k-25k",
    message: "Following up on the CRM build we discussed.",
    receivedAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    hoursElapsed: 25,
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px", margin: "0 auto" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#0f172a",
  margin: "0 0 20px",
};
const text = {
  fontSize: "15px",
  color: "#334155",
  lineHeight: "1.6",
  margin: "0 0 16px",
};
const card = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  padding: "16px 18px",
  margin: "20px 0",
  borderRadius: "6px",
};
const label = {
  fontSize: "11px",
  fontWeight: "bold" as const,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "8px 0 2px",
};
const value = {
  fontSize: "14px",
  color: "#0f172a",
  margin: "0 0 6px",
};
const messageStyle = {
  fontSize: "14px",
  color: "#334155",
  lineHeight: "1.55",
  margin: "0 0 8px",
  whiteSpace: "pre-wrap" as const,
};
const hr = { borderColor: "#e2e8f0", margin: "20px 0" };
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "20px 0 0",
  lineHeight: "1.5",
};
