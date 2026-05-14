import type { ComponentType } from "react";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

import { template as clientCredentials } from "./client-credentials";
import { template as clientPasswordReset } from "./client-password-reset";
import { template as clientWelcome } from "./client-welcome";
import { template as reviewRequest } from "./review-request";
import { template as outreachEmail } from "./outreach-email";
import { template as contactInquiry } from "./contact-inquiry";
import { template as contactAcknowledgment } from "./contact-acknowledgment";
import { template as contactFollowupReminder } from "./contact-followup-reminder";
import { template as teamInvite } from "./team-invite";
import { template as creditLowBalance } from "./credit-low-balance";

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "client-credentials": clientCredentials,
  "client-password-reset": clientPasswordReset,
  "client-welcome": clientWelcome,
  "review-request": reviewRequest,
  "outreach-email": outreachEmail,
  "contact-inquiry": contactInquiry,
  "contact-acknowledgment": contactAcknowledgment,
  "contact-followup-reminder": contactFollowupReminder,
  "team-invite": teamInvite,
  "credit-low-balance": creditLowBalance,
};
