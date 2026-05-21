/** Shared types for the credit top-up surface (panel + child sections + hook). */

export interface PackBalance {
  total: number;
  packs: Array<{
    id: string;
    pack_key: string;
    credits_remaining: number;
    credits_total: number;
    expires_at: string;
    receipt_url: string | null;
    hosted_invoice_url: string | null;
  }>;
}

export interface AutoRechargeSettings {
  enabled: boolean;
  pack_key: string;
  threshold_pct: number;
}

export interface LowBalanceSettings {
  enabled: boolean;
  threshold: number;
}
