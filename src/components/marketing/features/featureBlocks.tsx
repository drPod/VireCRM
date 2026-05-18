import type { ReactNode } from "react";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarCheck,
  MessageSquare,
  Shield,
  Terminal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommandCenterMock } from "./mocks/CommandCenterMock";
import { FollowUpMock } from "./mocks/FollowUpMock";
import { LeadScoringMock } from "./mocks/LeadScoringMock";
import { InboxMock } from "./mocks/InboxMock";
import { CalendarMock } from "./mocks/CalendarMock";
import { AnalyticsMock } from "./mocks/AnalyticsMock";
import { WhiteLabelMock } from "./mocks/WhiteLabelMock";

export interface FeatureSpec {
  id: string;
  chapter: "capture" | "convert" | "scale";
  eyebrow: string;
  icon: LucideIcon;
  title: ReactNode;
  tagline: string;
  body: string;
  bullets: { title: string; body: string }[];
  mock: ReactNode;
  reverse?: boolean;
}

export const FEATURES: FeatureSpec[] = [
  {
    id: "lead-scoring",
    chapter: "capture",
    eyebrow: "Smart lead scoring",
    icon: BrainCircuit,
    title: (
      <>
        Stop guessing which leads
        <br />
        are <span className="text-gradient-primary [-webkit-text-fill-color:transparent]">about to buy.</span>
      </>
    ),
    tagline: "AI ranks every lead the moment activity changes.",
    body: "Majix scores every contact in real time based on intent signals — opens, replies, pricing views, calendar clicks, dwell time. Hot leads bubble to the top of the queue. Cold ones get auto-nurtured. Your reps wake up with a pre-sorted list of who to chase first, and why.",
    bullets: [
      {
        title: "Explainable scores",
        body: "Hover any score to see which signals drove it — not a black box.",
      },
      {
        title: "Re-scores on every event",
        body: "Workflow opens, replies, page visits all feed the model in real time.",
      },
      {
        title: "Owner notifications",
        body: "When a lead hits 85+, the assigned rep gets a Slack ping with context.",
      },
    ],
    mock: <LeadScoringMock />,
  },
  {
    id: "inbox",
    chapter: "capture",
    eyebrow: "Unified inbox",
    icon: MessageSquare,
    title: <>One inbox for every channel your leads use.</>,
    tagline: "Email, SMS, WhatsApp, Instagram DMs — all in one timeline.",
    body: "Stop juggling four apps. Majix unifies every customer conversation, attaches it to the right contact, and lets your AI draft a reply you can send in one click. Sentiment + reply-intent classification means hot threads never sit unread.",
    bullets: [
      {
        title: "AI-drafted replies",
        body: "Click-to-send drafts that read like you, with brand voice tuned per workspace.",
      },
      {
        title: "Reply classification",
        body: "Auto-tag interested / objection / out-of-office / unsubscribe so you triage by signal.",
      },
      {
        title: "Channel handoffs",
        body: "Started on Instagram, want to move to email? Same thread, same context.",
      },
    ],
    mock: <InboxMock />,
    reverse: true,
  },
  {
    id: "command-center",
    chapter: "convert",
    eyebrow: "AI command center",
    icon: Terminal,
    title: <>Run your CRM with a single sentence.</>,
    tagline: "Type what you want done. Majix plans it, runs it, reports back.",
    body: "The command bar isn't a search box. It's the orchestration layer. Type \"chase the energy leads that went cold last week\" and Majix figures out who matches, drafts a personalized 3-step sequence, schedules sends at the right times, and enrolls them in a workflow — with every step audit-logged and reversible.",
    bullets: [
      {
        title: "Plans before it acts",
        body: "You see the full step-by-step before anything runs. Approve or edit any step.",
      },
      {
        title: "Audit log of every action",
        body: "Who or what changed each lead, when, and why — exportable to CSV.",
      },
      {
        title: "Rollback any AI action",
        body: "One click to undo a sequence enrollment, message send, or field change.",
      },
    ],
    mock: <CommandCenterMock />,
  },
  {
    id: "follow-up",
    chapter: "convert",
    eyebrow: "Auto follow-ups",
    icon: Bot,
    title: <>Follow up relentlessly without being annoying.</>,
    tagline: "Multi-channel sequences with AI timing and copy.",
    body: "Drop a lead into a sequence and Majix handles the cadence — first email in 12 seconds, SMS 24 hours later, hand-off to a rep when the model detects intent. Copy is personalized per lead using their pipeline context, industry, and last-touch history. Reply-detection auto-pauses sequences so you never double-send.",
    bullets: [
      {
        title: "Time-zone aware sending",
        body: "Messages send at the best opening hour per recipient, not yours.",
      },
      {
        title: "Auto-pause on reply",
        body: "Inbound message kills the sequence instantly — no awkward double-tap.",
      },
      {
        title: "Per-industry templates",
        body: "Energy, solar, real estate, gym, insurance — battle-tested copy out of the box.",
      },
    ],
    mock: <FollowUpMock />,
    reverse: true,
  },
  {
    id: "calendar",
    chapter: "convert",
    eyebrow: "Booking + calendar",
    icon: CalendarCheck,
    title: <>From inbound lead to booked meeting in one tap.</>,
    tagline: "Public booking links, round-robin, automated reminders.",
    body: "Every workspace gets a public booking link your leads can self-serve. Round-robin across your team, sync to everyone's Google Calendar, send automated reminders by SMS + email. Bookings auto-create a CRM record and notify the assigned rep with context from the lead's history.",
    bullets: [
      {
        title: "Round-robin or rule-based",
        body: "Distribute by region, vertical, lead score, or simple rotation.",
      },
      {
        title: "Reminder cascades",
        body: "Day-before email, 1-hour SMS, 10-minute push — fewer no-shows by ~40%.",
      },
      {
        title: "Reschedule without humans",
        body: "Self-serve reschedule preserves the original thread and rep assignment.",
      },
    ],
    mock: <CalendarMock />,
  },
  {
    id: "analytics",
    chapter: "scale",
    eyebrow: "Revenue analytics",
    icon: BarChart3,
    title: <>Know what's working before the quarter ends.</>,
    tagline: "Pipeline reports, revenue forecasting, campaign ROI in one place.",
    body: "Most CRMs ship reports that take a BI consultant to make useful. Majix ships pipeline funnels, revenue trends, campaign ROI, and rep performance dashboards out of the box — wired to live data, exportable, and screenshot-able for board decks. Forecasts use AI conversion probabilities, not naive stage averages.",
    bullets: [
      {
        title: "Live, not batched",
        body: "Every event updates the dashboard in real time. No 24-hour ETL lag.",
      },
      {
        title: "Forecast confidence intervals",
        body: "Range-bound revenue forecast (low / likely / high) you can defend to leadership.",
      },
      {
        title: "CSV + image export",
        body: "Every chart exports to PNG for slides or CSV for your own modeling.",
      },
    ],
    mock: <AnalyticsMock />,
    reverse: true,
  },
  {
    id: "white-label",
    chapter: "scale",
    eyebrow: "White-label + reseller",
    icon: Shield,
    title: <>Resell Majix as your own product.</>,
    tagline: "Custom domains, custom theming, custom billing — per tenant.",
    body: "Most CRMs treat white-label as an afterthought bolted onto an enterprise tier. We built Majix multi-tenant from day one. Each of your customers gets their own custom domain, logo, palette, email templates, and billing relationship with you. We never appear in their UI. You set pricing; we charge you wholesale per active workspace.",
    bullets: [
      {
        title: "Custom domains via Cloudflare for SaaS",
        body: "Automatic SSL, custom CNAME, branded sender email — no DNS surgery for your customers.",
      },
      {
        title: "Per-tenant themes",
        body: "Logo, palette, email templates, login screen, support footer — all tenant-scoped.",
      },
      {
        title: "Reseller billing with Stripe Connect",
        body: "Each child workspace has its own Stripe subscription that flows to your account.",
      },
    ],
    mock: <WhiteLabelMock />,
  },
];

export const CHAPTERS = [
  {
    id: "capture",
    number: "01",
    eyebrow: "Capture",
    title: (
      <>
        Catch every lead.
        <br />
        Score every signal.
      </>
    ),
    subtitle:
      "Most leads die in the gap between landing on your site and reaching a human. Majix closes that gap — instantly.",
  },
  {
    id: "convert",
    number: "02",
    eyebrow: "Convert",
    title: (
      <>
        Reach them on every channel.
        <br />
        Book the meeting.
      </>
    ),
    subtitle:
      "AI runs the cadence. Your reps close the deal. Nothing slips through manual follow-up gaps.",
  },
  {
    id: "scale",
    number: "03",
    eyebrow: "Scale",
    title: (
      <>
        Measure what's working.
        <br />
        Resell it as your own.
      </>
    ),
    subtitle:
      "Live revenue analytics, AI-driven forecasting, and the white-label layer that turns Majix into your branded product.",
  },
] as const;
