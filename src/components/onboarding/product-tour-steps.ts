/**
 * Default tour steps for the CRM, plus an industry-aware step builder.
 *
 * Targets must match `data-tour="<id>"` attributes on real DOM elements.
 */
import { SUPPORT_EMAIL } from "@/config/support";
import { type IndustryKey } from "@/lib/industry-templates";
import { type TourStep } from "./product-tour.types";

/** The default tour steps for the CRM. Targets must match `data-tour` ids. */
export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    target: "_center",
    title: "Welcome to VireCRM 👋",
    body: "Let's take a 60-second tour so you know where everything lives. You can replay it anytime from the sidebar.",
    placement: "center",
  },
  {
    target: "nav-dashboard",
    title: "Dashboard",
    body: "Your command center — pipeline value, today's tasks, and key metrics live here.",
    placement: "right",
  },
  {
    target: "nav-leads",
    title: "Leads",
    body: "All your contacts in one searchable table. Click a row to open the details drawer with notes, messages, and AI scoring.",
    placement: "right",
  },
  {
    target: "nav-conversations",
    title: "Conversations",
    body: "Every inbound and outbound message across email, SMS, and chat — sorted by lead.",
    placement: "right",
  },
  {
    target: "nav-workflows",
    title: "Workflows",
    body: "Drag-and-drop automations. Drop AI agents on the canvas to score leads, classify replies, personalize messages, or book appointments automatically.",
    placement: "right",
  },
  {
    target: "nav-command-chat",
    title: "Command Chat",
    body: 'Type plain English commands like "Run outreach on 200 leads" and the AI plans + executes the work for you.',
    placement: "right",
  },
  {
    target: "nav-followup-inbox",
    title: "AI Follow-ups",
    body: "AI-suggested next replies for every active lead. Approve to send, edit, or skip.",
    placement: "right",
  },
  {
    target: "nav-academy",
    title: "Academy",
    body: "Short courses on getting the most out of the CRM. Great if you're new to sales automation.",
    placement: "right",
  },
  {
    target: "nav-settings",
    title: "Settings",
    body: `Brand, integrations, team members, and billing all live in Settings. Need help? Email ${SUPPORT_EMAIL} anytime.`,
    placement: "right",
  },
  {
    target: "_center",
    title: "You're all set 🎉",
    body: 'That\'s the grand tour. Click "Restart tour" in the sidebar anytime you want to see this again.',
    placement: "center",
  },
];

/**
 * Build tour steps tailored to the tenant's industry template. Each industry
 * gets its own curated middle section that highlights the nav items actually
 * present in their sidebar, using industry-specific terminology. Shared
 * utility steps (Command Chat, AI Follow-ups, Academy, Settings) always appear
 * at the end before the "You're all set" close step.
 */
export function buildTourSteps(industryTemplate: IndustryKey): TourStep[] {
  const welcome = DEFAULT_TOUR_STEPS[0];
  const finish = DEFAULT_TOUR_STEPS[DEFAULT_TOUR_STEPS.length - 1];
  const sharedTargets = ["nav-command-chat", "nav-followup-inbox", "nav-academy", "nav-settings"];
  const shared = DEFAULT_TOUR_STEPS.filter((s) => sharedTargets.includes(s.target));

  const industryMiddle: Record<IndustryKey, TourStep[]> = {
    general: DEFAULT_TOUR_STEPS.slice(1, -1).filter((s) => !sharedTargets.includes(s.target)),
    energy: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — pipeline value, energy contracts in progress, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Prospects", body: "All your energy prospects in one searchable table. Click a row to see notes, messages, and AI scoring.", placement: "right" },
      { target: "nav-energy", title: "Energy Hub", body: "Manage LOAs, usage data, pricing quotes, and supplier info — all in one place.", placement: "right" },
      { target: "nav-energy-loa", title: "LOA Management", body: "Track Letters of Authority from submission through approval. Filter by status and export for suppliers.", placement: "right" },
      { target: "nav-energy-contracts", title: "Contracts", body: "View active energy contracts, renewal dates, and margin per account.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    solar: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — active solar projects, pipeline value, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Leads", body: "All your solar prospects. Click a row to see site details, notes, messages, and AI scoring.", placement: "right" },
      { target: "nav-solar", title: "Solar Hub", body: "Manage your full solar operation from one place.", placement: "right" },
      { target: "nav-solar-projects", title: "Projects", body: "Track every solar installation from proposal through commissioning. Status, site data, and financials.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    real_estate: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — active listings, leads in pipeline, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Leads", body: "All your real estate prospects. Click a row to see property interests, notes, and AI scoring.", placement: "right" },
      { target: "nav-real-estate", title: "Real Estate Hub", body: "Manage listings and showings from one place.", placement: "right" },
      { target: "nav-real-estate-listings", title: "Listings", body: "Track all active and pending listings — price, status, days on market.", placement: "right" },
      { target: "nav-real-estate-showings", title: "Showings", body: "Schedule and track showings across all your listings.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    insurance: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — policies active, renewals due, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Prospects", body: "All your insurance prospects. Click a row to see coverage interests, notes, and AI scoring.", placement: "right" },
      { target: "nav-insurance", title: "Insurance Hub", body: "Manage quotes and policies from one place.", placement: "right" },
      { target: "nav-insurance-quotes", title: "Quotes", body: "Track all active quotes — coverage type, premium, expiry date.", placement: "right" },
      { target: "nav-insurance-policies", title: "Policies", body: "View all in-force policies, renewal dates, and coverage details.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
    gym: [
      { target: "nav-dashboard", title: "Dashboard", body: "Your command center — active members, trial signups in pipeline, and key metrics.", placement: "right" },
      { target: "nav-leads", title: "Prospects", body: "All your gym prospects. Click a row to see membership interests, notes, and AI scoring.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-conversations")!,
      { target: "nav-calendar", title: "Calendar", body: "Manage your schedule, trial sessions, and appointments.", placement: "right" },
      { target: "nav-appointments", title: "Appointments", body: "Book and track individual appointments with leads and members.", placement: "right" },
      DEFAULT_TOUR_STEPS.find((s) => s.target === "nav-workflows")!,
    ],
  };

  return [welcome, ...industryMiddle[industryTemplate], ...shared, finish];
}
