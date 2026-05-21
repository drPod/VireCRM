// Shared types for the /leads container + its extracted siblings/hooks.

export type LeadsAction = "add" | "import" | "auto-find";

export type LeadsSearch = {
  q?: string;
  action?: LeadsAction;
  ai_desc?: string;
  ai_industry?: string;
};

export type BulkAssignMode = "share" | "round_robin";

export type BulkDeleteMode = "soft" | "hard";
