import { Body, Container, Head, Html, Img, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Majix";

interface OutreachEmailProps {
  /** AI-generated body text. Newlines become paragraph breaks. */
  body?: string;
  /** Sender's brand name (org/reseller name shown in sign-off). */
  brandName?: string;
  /** Optional sender display name appended to the sign-off. */
  senderName?: string;
  /** Optional brand logo shown above the email body. */
  logoUrl?: string;
  /** Optional brand accent color (hex) used for links and the divider. */
  accentColor?: string;
  /** Optional Google Font name (e.g. "Poppins") to use in the email body. */
  fontFamily?: string;
  /** Optional plain-text signature (multi-line) appended below the sign-off. */
  signature?: string;
}

/**
 * Generic AI cold-outreach template. The subject and body are produced by
 * the auto-outreach server function and passed in as templateData. Keeping
 * formatting minimal so the AI's copy reads naturally and doesn't look
 * "templated."
 */
const OutreachEmail = ({
  body,
  brandName,
  senderName,
  logoUrl,
  accentColor,
  fontFamily,
  signature,
}: OutreachEmailProps) => {
  const fromBrand = brandName || SITE_NAME;
  const signOff = senderName ? `— ${senderName}, ${fromBrand}` : `— ${fromBrand}`;
  const paragraphs = (body || "Hello — wanted to reach out.")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const fontStack = fontFamily
    ? `'${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`
    : "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  const accent = accentColor || "#3b82f6";

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{paragraphs[0]?.slice(0, 90) || `A note from ${fromBrand}`}</Preview>
      <Body
        style={{ backgroundColor: "#f6f8fb", fontFamily: fontStack, margin: 0, padding: "24px 0" }}
      >
        <Container style={card}>
          {logoUrl ? (
            <div style={logoWrap}>
              <Img
                src={logoUrl}
                alt={fromBrand}
                height="40"
                style={{ maxHeight: "40px", objectFit: "contain" }}
              />
            </div>
          ) : (
            <div style={{ ...logoWrap, ...brandWordmark, color: accent }}>{fromBrand}</div>
          )}
          <div style={{ borderTop: `3px solid ${accent}`, width: "48px", margin: "4px 0 22px" }} />
          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>
              {p}
            </Text>
          ))}
          <Text style={signOffStyle}>{signOff}</Text>
          {signature
            ? signature
                .split(/\n/)
                .filter(Boolean)
                .map((line, i) => (
                  <Text key={i} style={signatureLine}>
                    {line}
                  </Text>
                ))
            : null}
          <div style={divider} />
          <Text style={legalFooter}>
            You received this email because {fromBrand} is reaching out about a potential fit. If
            this isn't relevant, just reply and let us know — a real person will read it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: OutreachEmail,
  subject: (data: Record<string, any>) =>
    (data?.subject as string) || `A quick note from ${SITE_NAME}`,
  displayName: "AI outreach email",
  previewData: {
    subject: "Quick question about your sales pipeline",
    brandName: "Acme CRM",
    senderName: "Alex",
    logoUrl: "",
    accentColor: "#7c3aed",
    fontFamily: "Inter",
    signature: "hello@acme.com",
    body: "Hi Jane,\n\nNoticed Acme is scaling fast — congrats on the recent growth. We help teams like yours automate cold outreach and book 3x more meetings without adding headcount.\n\nWould you be open to a 15-minute chat next week to see if it'd be a fit?",
  },
} satisfies TemplateEntry;

const card = {
  padding: "36px 32px",
  maxWidth: "600px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  margin: "0 auto",
  border: "1px solid #e5e9f0",
};
const logoWrap = { marginBottom: "14px" };
const brandWordmark = {
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "-0.01em",
};
const text = {
  fontSize: "15px",
  color: "#0b0f1c",
  lineHeight: "1.7",
  margin: "0 0 14px",
};
const signOffStyle = {
  fontSize: "14px",
  color: "#0b0f1c",
  margin: "24px 0 4px",
  lineHeight: "1.5",
};
const signatureLine = {
  fontSize: "13px",
  color: "#64748b",
  margin: "0 0 2px",
  lineHeight: "1.5",
};
const divider = {
  borderTop: "1px solid #e5e9f0",
  margin: "28px 0 16px",
};
const legalFooter = {
  fontSize: "11px",
  color: "#94a3b8",
  lineHeight: "1.5",
  margin: 0,
};
