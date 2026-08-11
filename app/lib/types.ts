// Client-side mirrors of the Worker API response shapes
// (workers/db/queries/*.ts). Dates arrive as strings over JSON: timestamps
// are ISO 8601, `date` columns are "YYYY-MM-DD". Postgres numerics are
// strings — never Number() money.

export interface ListPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CustomerListItem {
  id: string;
  name: string;
  externalCustomerId: string | null;
  primaryContactName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  createdAt: string;
}

export interface AgentListItem {
  id: string;
  name: string;
  email: string | null;
  houseSplitPct: string | null;
  createdAt: string;
}

export interface ServiceAddressListItem {
  id: string;
  customerId: string;
  streetNo: string | null;
  streetName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  govtArea: string | null;
  createdAt: string;
}

// `id` = row UUID (what contracts.esiId references); `esiId` = the canonical
// ERCOT Electric Service Identifier text.
export interface EsiListItem {
  id: string;
  serviceAddressId: string;
  esiId: string;
  physicalMeterSerial: string | null;
  eacKwh: string | null;
  billingAqKwh: string | null;
  annualUsageKwh: string | null;
  createdAt: string;
}

export interface DealListItem {
  id: string;
  customerId: string;
  primaryAgentId: string | null;
  secondaryAgentId: string | null;
  contractId: string | null;
  name: string | null;
  externalSaleId: string | null;
  saleDate: string | null;
  stage: string;
  saleStatus: string | null;
  objectionStatus: string | null;
  objectionType: string | null;
  sourceOfLead: string | null;
  createdAt: string;
}

export interface ContractRow {
  id: string;
  tenantId: string;
  esiId: string;
  externalSaleId: string | null;
  supplier: string | null;
  supplyType: string | null;
  startDate: string | null;
  endDate: string | null;
  costPerKwh: string | null;
  agentMils: string | null;
  currency: string;
  fxRate: string;
  pipelineStatus: string;
  isLive: boolean;
  saleType: string | null;
  lostDate: string | null;
  lostReason: string | null;
  lostBeforeStart: boolean;
  lostAfterLive: boolean;
  completedPostLive: boolean;
  dropDate: string | null;
  dropReason: string | null;
  nomination: string | null;
  paymentTerm: string | null;
  resoldStatus: string | null;
  isResold: boolean;
  resoldFromContractId: string | null;
  annualUsageKwh: string | null;
  grossTcv: string | null;
  grossTcvXlsx: string | null;
  lostTcv: string | null;
  netTcv: string | null;
  netTcvXlsx: string | null;
  aqLoss: string | null;
  aqGain: string | null;
  netAq: string | null;
  aqCheck: string | null;
  lostPartial: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoaListItem {
  id: string;
  customerId: string;
  pdfStoragePath: string | null;
  signedDate: string | null;
  expirationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentClientRow {
  contractId: string;
  supplier: string | null;
  supplyType: string | null;
  startDate: string | null;
  endDate: string | null;
  costPerKwh: string | null;
  agentMils: string | null;
  currency: string;
  annualUsageKwh: string | null;
  grossTcv: string | null;
  netTcv: string | null;
  isLive: boolean;
  esiRowId: string;
  esiId: string;
  physicalMeterSerial: string | null;
  serviceAddressId: string;
  streetNo: string | null;
  streetName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  customerId: string;
  customerName: string;
  createdAt: string;
}

// Row from /api/renewals — active contracts ending within the window.
export interface RenewalRow {
  contractId: string;
  supplier: string | null;
  supplyType: string | null;
  startDate: string | null;
  endDate: string;
  costPerKwh: string | null;
  agentMils: string | null;
  currency: string;
  annualUsageKwh: string | null;
  grossTcv: string | null;
  netTcv: string | null;
  isLive: boolean;
  esiRowId: string;
  esiId: string;
  serviceAddressId: string;
  streetNo: string | null;
  streetName: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  customerId: string;
  customerName: string;
}

// Deal pipeline stage vocabulary — enforced in the UI only (the API accepts
// free text by design; docs/decisions/06-domain-schema.md §stage).
export const STAGES = ["Lead", "Qualified", "In Pricing", "Sent", "Won", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

// Observed deal-level sale statuses (docs/decisions/06-domain-schema.md).
export const SALE_STATUSES = [
  "Approved",
  "Lost",
  "Completed",
  "Meter Check",
  "Declined",
  "Objection",
] as const;

// Contract pipeline status — real Postgres enum.
export const PIPELINE_STATUSES = ["pending", "active", "expired", "lost"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];
