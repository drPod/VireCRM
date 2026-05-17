import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Majix";

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface QuoteProposalProps {
  recipientName?: string;
  recipientCompany?: string | null;
  quoteNumber?: string;
  title?: string;
  totalFormatted?: string;
  validUntil?: string | null;
  lineItems?: LineItem[];
  currency?: string;
  pdfUrl?: string;
  paymentLinkUrl?: string | null;
  notes?: string | null;
  senderName?: string;
}

const formatMoney = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);

const QuoteProposalEmail = ({
  recipientName,
  recipientCompany,
  quoteNumber,
  title,
  totalFormatted,
  validUntil,
  lineItems = [],
  currency = "usd",
  pdfUrl,
  paymentLinkUrl,
  notes,
  senderName,
}: QuoteProposalProps) => {
  const greetingName = recipientName ? recipientName.split(" ")[0] : "there";
  const company = senderName || SITE_NAME;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Your {company} proposal{title ? `: ${title}` : ""}
        {totalFormatted ? ` — ${totalFormatted}` : ""}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>{company.toUpperCase()}</Text>
          <Heading style={h1}>Hi {greetingName}, your proposal is ready</Heading>
          <Text style={lede}>
            {recipientCompany ? `For ${recipientCompany}. ` : ""}
            We've put together {title ? `"${title}"` : "a custom proposal"} based on what we
            discussed. The full details are attached as a PDF, and a quick summary is below.
          </Text>

          <Section style={summaryCard}>
            <Row>
              <Column>
                <Text style={summaryLabel}>Quote</Text>
                <Text style={summaryValue}>{quoteNumber || "—"}</Text>
              </Column>
              <Column align="right">
                <Text style={summaryLabel}>Total</Text>
                <Text style={summaryTotal}>{totalFormatted || "—"}</Text>
              </Column>
            </Row>
            {validUntil ? (
              <Text style={summaryMeta}>Valid until {validUntil}</Text>
            ) : null}
          </Section>

          {pdfUrl ? (
            <Section style={ctaWrap}>
              <Button href={pdfUrl} style={ctaPrimary}>
                Download proposal PDF
              </Button>
            </Section>
          ) : null}

          {paymentLinkUrl ? (
            <Section style={ctaWrap}>
              <Button href={paymentLinkUrl} style={ctaSecondary}>
                Approve & pay securely
              </Button>
              <Text style={ctaHint}>
                Powered by Stripe — no account required. The link locks in this proposal as
                ordered.
              </Text>
            </Section>
          ) : null}

          {lineItems.length > 0 ? (
            <>
              <Heading as="h2" style={h2}>
                What's included
              </Heading>
              <Section style={itemsBox}>
                {lineItems.map((li, idx) => (
                  <Row key={idx} style={itemRow}>
                    <Column>
                      <Text style={itemDesc}>{li.description || "—"}</Text>
                      <Text style={itemMeta}>
                        {li.quantity} × {formatMoney(li.unit_price_cents, currency)}
                      </Text>
                    </Column>
                    <Column align="right">
                      <Text style={itemTotal}>
                        {formatMoney(li.unit_price_cents * li.quantity, currency)}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Section>
            </>
          ) : null}

          {notes ? (
            <>
              <Hr style={hr} />
              <Heading as="h2" style={h2}>
                Notes
              </Heading>
              <Text style={text}>{notes}</Text>
            </>
          ) : null}

          <Hr style={hr} />
          <Text style={text}>
            Questions or want to tweak the scope? Just reply to this email — I'll get right back to
            you.
          </Text>
          <Text style={signature}>— The {company} team</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: QuoteProposalEmail,
  subject: (data: Record<string, any>) => {
    const t = data?.title ? `: ${data.title}` : "";
    return `Your ${data?.senderName || SITE_NAME} proposal${t}`;
  },
  displayName: "Quote / Proposal",
  previewData: {
    recipientName: "Crystal Cameron",
    recipientCompany: "Green EnergiAI",
    quoteNumber: "Q-2026-0042",
    title: "White-label CRM rollout",
    totalFormatted: "$4,800.00",
    validUntil: "2026-06-30",
    lineItems: [
      { description: "Majix White-label — Annual", quantity: 1, unit_price_cents: 360000 },
      { description: "Onboarding & migration", quantity: 1, unit_price_cents: 120000 },
    ],
    currency: "usd",
    pdfUrl: "https://example.com/proposal.pdf",
    paymentLinkUrl: "https://buy.stripe.com/test_xyz",
    notes: "Pricing locks in for 30 days.",
    senderName: "Majix",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 28px", maxWidth: "600px" };
const brand = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "2px",
  color: "#3b82f6",
  margin: "0 0 12px",
};
const h1 = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 16px",
  lineHeight: "1.3",
};
const h2 = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#0f172a",
  margin: "28px 0 12px",
};
const lede = { fontSize: "15px", color: "#334155", lineHeight: "1.55", margin: "0 0 24px" };
const text = { fontSize: "14px", color: "#475569", lineHeight: "1.55", margin: "0 0 12px" };
const summaryCard = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "18px 20px",
  margin: "0 0 24px",
};
const summaryLabel = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
  margin: "0 0 4px",
};
const summaryValue = { fontSize: "16px", fontWeight: 600, color: "#0f172a", margin: 0 };
const summaryTotal = { fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 };
const summaryMeta = { fontSize: "12px", color: "#64748b", margin: "12px 0 0" };
const ctaWrap = { textAlign: "center" as const, margin: "0 0 16px" };
const ctaPrimary = {
  background: "#3b82f6",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "14px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};
const ctaSecondary = {
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "14px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};
const ctaHint = { fontSize: "12px", color: "#94a3b8", margin: "10px 0 0" };
const itemsBox = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "8px 16px",
  margin: "0 0 16px",
};
const itemRow = { borderBottom: "1px solid #f1f5f9", padding: "12px 0" };
const itemDesc = { fontSize: "14px", color: "#0f172a", margin: 0, fontWeight: 500 };
const itemMeta = { fontSize: "12px", color: "#64748b", margin: "2px 0 0" };
const itemTotal = { fontSize: "14px", color: "#0f172a", margin: 0, fontWeight: 600 };
const hr = { border: "none", borderTop: "1px solid #e2e8f0", margin: "24px 0" };
const signature = { fontSize: "14px", color: "#0f172a", fontWeight: 500, margin: "12px 0 0" };
