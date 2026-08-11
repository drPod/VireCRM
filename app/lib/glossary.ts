// Canonical UI definitions for domain terms. Source of truth: CLAUDE.md
// "Domain glossary" — keep the two in sync when editing either.
// Every non-obvious domain label rendered in the UI must carry one of these
// via <DomainTerm> (app/components/domain-term.tsx).

export const GLOSSARY = {
  "ESI ID":
    "Electric Service Identifier — ERCOT's unique 17–22-digit ID for a service address (Oncor prefix 1044372…, East TX 1017699…). One ESI per service address; survives meter swaps. The master sheet calls this \"Meter Number\".",
  "Physical Meter Serial":
    "Device serial printed on the physical meter — distinct from the ESI ID and changes when the meter is swapped. The master sheet calls this \"Meter Id\". Kept for cross-referencing supplier invoices.",
  EAC: "Estimated Annual Consumption (kWh), set at contract signing.",
  AQ: "Annual Quantity — annual electricity volume in kWh.",
  "Billing AQ":
    "Actual billed annual volume (kWh). Commission is paid against Billing AQ, not the EAC estimate — variance between the two drives most reconciliation disputes.",
  Mils: "Agent commission per kWh, in thousandths of a dollar (1 mil = $0.001/kWh). The master sheet calls this \"Unit Uplift\".",
  TCV: "Total Contract Value = Annual Usage × Term Years × Agent Mils ÷ 1000.",
  "Gross TCV":
    "Total Contract Value before losses: Annual Usage × Term Years × Agent Mils ÷ 1000.",
  "Net TCV": "Gross TCV minus Lost TCV.",
  "Lost TCV": "Contract value lost when a contract is lost or dropped before term end.",
  REP: "Retail Electric Provider — the supplier on the contract.",
  LOA: "Letter of Authorization — customer-signed document letting the broker pull usage data and shop on their behalf. Required before a deal enters In Pricing.",
  Drop: "Supplier kicked the customer off the contract mid-term (supplier action) — distinct from \"lost\", where the customer leaves.",
  Aggregator:
    "Upstream broker. When operating as a sub-broker, the aggregator takes a percentage cut of commission.",
  "Pri/Sec Agent":
    "Dual-agent attribution — every deal can carry a primary and a secondary agent; both earn credit.",
  "Primary Agent": "First of up to two agents attributed to a deal.",
  "Secondary Agent":
    "Second of up to two agents attributed to a deal. Dual-agent attribution is first-class — never collapsed to one.",
  "Is Live":
    "Contract reached its start date and billing began. Distinct from pipeline status \"active\" (signed but possibly future-dated).",
  "In Pricing":
    "Pipeline stage where a deal is being quoted across REPs — pre-won.",
  "Sale Status":
    "Approved / Pending / Lost — orthogonal to Pipeline Stage (a deal has both).",
  "Pipeline Stage":
    "Where the deal sits in the sales pipeline — orthogonal to Sale Status.",
  "Non-HH":
    "UK-origin label: Non-Half-Hourly metered (small-commercial) electricity. Stored and displayed exactly as the master sheet encoded it.",
  Nomination:
    "UK-origin label carried over from the master sheet — stored and displayed verbatim.",
  "SIC Code":
    "Standard Industrial Classification code for the customer's business, carried over from the master sheet.",
  "Govt Area":
    "UK-origin label for governmental/administrative area, carried over from the master sheet — stored and displayed verbatim.",
  "Acq/Ren":
    "Whether the contract is a new Acquisition or a Renewal of an existing contract.",
  "Resold Status":
    "Whether the contract has been resold, carried over from the master sheet — stored and displayed verbatim.",
  "Current Clients":
    "Customers with at least one active contract. Deals graduate here automatically on close-won.",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
