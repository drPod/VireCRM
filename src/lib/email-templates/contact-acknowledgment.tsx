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
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Genesis";
const REPLY_WINDOW = "within 24 hours";

interface ContactAcknowledgmentProps {
  name?: string;
  message?: string;
  pricingUrl?: string;
}

/**
 * Auto-reply sent to the visitor right after they submit the public contact
 * form. Sets the expectation: we'll reply within 24h with a Calendly link.
 * For self-serve buyers it nudges them back to /pricing in case they don't
 * actually need a custom build.
 */
const ContactAcknowledgmentEmail = ({ name, message, pricingUrl }: ContactAcknowledgmentProps) => {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const pricingHref = pricingUrl || "https://genesisx.space/pricing";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Thanks for reaching out to {SITE_NAME} — we'll be in touch {REPLY_WINDOW}.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Thanks for reaching out!</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            We just received your inquiry and a member of the {SITE_NAME} team will personally reply{" "}
            <strong>{REPLY_WINDOW}</strong> with next steps and a link to book a quick discovery
            call.
          </Text>

          {message && (
            <Section style={quoteCard}>
              <Text style={quoteLabel}>Your message</Text>
              <Text style={quoteText}>{message}</Text>
            </Section>
          )}

          <Text style={text}>
            <strong>What happens next:</strong>
          </Text>
          <Text style={listItem}>1. We review your requirements.</Text>
          <Text style={listItem}>
            2. You get a reply with a Calendly link to book a 20-minute call.
          </Text>
          <Text style={listItem}>
            3. After the call we send a Statement of Work and a Stripe invoice.
          </Text>
          <Text style={listItem}>4. Build kicks off as soon as the deposit clears.</Text>

          <Section style={ctaWrap}>
            <Text style={ctaLede}>
              In a hurry? Some of our self-serve plans can be live in minutes:
            </Text>
            <Button href={pricingHref} style={button}>
              View self-serve plans
            </Button>
          </Section>

          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ContactAcknowledgmentEmail,
  subject: "We got your message — we'll be in touch within 24 hours",
  displayName: "Contact form acknowledgment (visitor)",
  previewData: {
    name: "Jane Smith",
    message: "Looking for a custom CRM with white-label branding for our solar sales team.",
    pricingUrl: "https://genesisx.space/pricing",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "560px", margin: "0 auto" };
const h1 = {
  fontSize: "24px",
  fontWeight: "bold" as const,
  color: "#0f172a",
  margin: "0 0 24px",
};
const text = {
  fontSize: "15px",
  color: "#334155",
  lineHeight: "1.6",
  margin: "0 0 16px",
};
const listItem = {
  fontSize: "14px",
  color: "#475569",
  lineHeight: "1.6",
  margin: "0 0 6px",
  paddingLeft: "8px",
};
const quoteCard = {
  backgroundColor: "#f8fafc",
  borderLeft: "3px solid #6366f1",
  padding: "14px 18px",
  margin: "20px 0 24px",
  borderRadius: "4px",
};
const quoteLabel = {
  fontSize: "11px",
  fontWeight: "bold" as const,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 6px",
};
const quoteText = {
  fontSize: "14px",
  color: "#334155",
  lineHeight: "1.55",
  margin: 0,
  whiteSpace: "pre-wrap" as const,
};
const ctaWrap = {
  margin: "28px 0 24px",
  padding: "20px",
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  textAlign: "center" as const,
};
const ctaLede = {
  fontSize: "13px",
  color: "#475569",
  margin: "0 0 14px",
};
const button = {
  backgroundColor: "#6366f1",
  color: "#ffffff",
  padding: "11px 22px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: "bold" as const,
  display: "inline-block",
};
const footer = {
  fontSize: "13px",
  color: "#64748b",
  margin: "28px 0 0",
};
