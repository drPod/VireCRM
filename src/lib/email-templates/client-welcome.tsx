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

interface ClientWelcomeProps {
  brandName?: string;
  fullName?: string;
  loginUrl?: string;
}

const ClientWelcomeEmail = ({ brandName, fullName, loginUrl }: ClientWelcomeProps) => {
  const senderName = brandName || SITE_NAME;
  const greeting = fullName ? `Welcome aboard, ${fullName}!` : "Welcome aboard!";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your quick start guide to {senderName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{greeting}</Heading>
          <Text style={lede}>
            Your {senderName} CRM is live and ready to help you respond faster, follow up
            automatically, and surface your hottest leads. Here's how to get the most out of your
            first week.
          </Text>

          {loginUrl && (
            <Section style={ctaWrap}>
              <Button href={loginUrl} style={ctaBtn}>
                Open your CRM
              </Button>
            </Section>
          )}

          <Heading as="h2" style={h2}>
            Your 4-step quick start
          </Heading>

          <Section style={stepBox}>
            <Text style={stepNum}>STEP 1</Text>
            <Text style={stepTitle}>Tell the AI about your business</Text>
            <Text style={stepBody}>
              Open the <strong>AI Advisor</strong> from the sidebar and describe what you sell and
              who your ideal customer is. The AI uses this to score leads, draft outreach, and find
              new prospects that match your ICP.
            </Text>
          </Section>

          <Section style={stepBox}>
            <Text style={stepNum}>STEP 2</Text>
            <Text style={stepTitle}>Add or import your first leads</Text>
            <Text style={stepBody}>
              Go to <strong>Leads</strong> and either add them manually, import a CSV, or click{" "}
              <strong>Auto-find leads</strong> to let the AI source new prospects for you. Every
              lead gets an automatic fit score so you know who to chase first.
            </Text>
          </Section>

          <Section style={stepBox}>
            <Text style={stepNum}>STEP 3</Text>
            <Text style={stepTitle}>Move deals through your pipeline</Text>
            <Text style={stepBody}>
              The <strong>Pipeline</strong> view shows every lead by stage. Drag cards between
              columns as deals progress, and the activity feed keeps a full timeline of calls,
              emails, and notes for each contact.
            </Text>
          </Section>

          <Section style={stepBox}>
            <Text style={stepNum}>STEP 4</Text>
            <Text style={stepTitle}>Automate your follow-ups</Text>
            <Text style={stepBody}>
              Visit <strong>Workflows</strong> to set up automatic outreach sequences — first-touch
              emails, follow-ups, and reminders trigger the moment a lead enters a stage, so nothing
              slips through the cracks.
            </Text>
          </Section>

          <Heading as="h2" style={h2}>
            A few features worth exploring
          </Heading>
          <Text style={featureList}>
            • <strong>Command bar</strong> (press <code style={kbd}>⌘K</code>) — jump anywhere or
            run an AI action in one keystroke
            <br />• <strong>Campaigns</strong> — launch multi-step outbound sequences with
            AI-personalised copy
            <br />• <strong>Calendar &amp; Tasks</strong> — never miss a follow-up
            <br />• <strong>Analytics</strong> — see what's converting and where deals are stalling
          </Text>

          {loginUrl && (
            <Text style={text}>
              Ready to dive in?{" "}
              <a href={loginUrl} style={link}>
                Open your CRM
              </a>{" "}
              and start with Step 1.
            </Text>
          )}

          <Text style={footer}>
            Reply to this email any time if you have questions — we're here to help.
            <br />— The {senderName} team
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ClientWelcomeEmail,
  subject: (data: Record<string, any>) =>
    `Welcome to ${data?.brandName || SITE_NAME} — your quick start guide`,
  displayName: "Client welcome",
  previewData: {
    brandName: "Acme CRM",
    fullName: "Jane Doe",
    loginUrl: "https://acme.vireonx.space/login",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
};
const container = { padding: "32px 24px", maxWidth: "600px" };
const h1 = {
  fontSize: "24px",
  fontWeight: 600,
  color: "#0b0f1c",
  margin: "0 0 12px",
};
const h2 = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#0b0f1c",
  margin: "32px 0 12px",
};
const lede = {
  fontSize: "15px",
  color: "#334155",
  lineHeight: "1.6",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#475569",
  lineHeight: "1.6",
  margin: "20px 0 0",
};
const ctaWrap = { margin: "8px 0 24px" };
const ctaBtn = {
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 22px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};
const stepBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "16px 18px",
  margin: "12px 0",
};
const stepNum = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#3b82f6",
  letterSpacing: "0.06em",
  margin: "0 0 4px",
};
const stepTitle = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#0b0f1c",
  margin: "0 0 6px",
};
const stepBody = {
  fontSize: "13px",
  color: "#475569",
  lineHeight: "1.55",
  margin: 0,
};
const featureList = {
  fontSize: "13px",
  color: "#475569",
  lineHeight: "1.9",
  margin: "0 0 12px",
};
const kbd = {
  backgroundColor: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "4px",
  padding: "1px 6px",
  fontSize: "12px",
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
};
const link = { color: "#3b82f6", textDecoration: "none" };
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "32px 0 0",
  lineHeight: "1.5",
};
