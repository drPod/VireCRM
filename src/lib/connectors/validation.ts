/**
 * Format validation for connector config inputs (Send-from address,
 * default channel, send-from phone number, etc.).
 *
 * Keeps Save/Edit buttons disabled until each required field passes a basic
 * format check. Validation is intentionally lenient — we only catch obvious
 * mistakes (missing values, malformed emails / phone numbers / channels).
 * Provider-side validation still has the final word.
 */

export interface FieldValidation {
  /** Whether the field must be filled in. Defaults to false. */
  required?: boolean;
  /** Inline error message when format is invalid. */
  invalidMessage?: string;
  /** Returns true when the value passes the format check. Empty values pass. */
  validate?: (value: string) => boolean;
}

// Loose-but-useful email regex. Provider verification has the final say.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// E.164: leading +, 8–15 digits.
const E164_RE = /^\+[1-9]\d{7,14}$/;
// Slack channel: # then lowercase letters, digits, dashes, underscores, dots.
const SLACK_CHANNEL_RE = /^#[a-z0-9][a-z0-9._-]{0,79}$/;
// IANA tz: Region/City, with optional underscores.
const IANA_TZ_RE = /^[A-Za-z]+(?:\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)?$/;
// Microsoft Teams team id is a GUID.
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Rules keyed by `${providerId}.${fieldKey}`. A missing entry means
 * "no extra format check, and not required".
 */
export const FIELD_RULES: Record<string, FieldValidation> = {
  // ---- Email senders ----
  "gmail.fromAddress": {
    required: true,
    invalidMessage: "Enter a valid email address (e.g. you@gmail.com).",
    validate: (v) => EMAIL_RE.test(v),
  },
  "microsoft_outlook.fromAddress": {
    required: true,
    invalidMessage: "Enter a valid email address (e.g. you@company.com).",
    validate: (v) => EMAIL_RE.test(v),
  },
  "sendgrid.defaultFromAddress": {
    required: true,
    invalidMessage: "Enter a valid sender email (e.g. you@yourcompany.com).",
    validate: (v) => EMAIL_RE.test(v),
  },

  // ---- Slack ----
  "slack.defaultChannel": {
    required: true,
    invalidMessage:
      "Channel must start with # and use lowercase letters, numbers, dashes or dots.",
    validate: (v) => SLACK_CHANNEL_RE.test(v),
  },

  // ---- Teams ----
  "microsoft_teams.teamId": {
    required: true,
    invalidMessage: "Team ID must be a GUID like 00000000-0000-0000-0000-000000000000.",
    validate: (v) => GUID_RE.test(v),
  },
  "microsoft_teams.channelId": {
    required: true,
    invalidMessage: "Channel ID looks like 19:abc…@thread.tacv2.",
    validate: (v) => /^19:[A-Za-z0-9_-]+@thread\.(tacv2|skype)$/.test(v),
  },

  // ---- Twilio ----
  "twilio.fromNumber": {
    required: true,
    invalidMessage: "Use E.164 format starting with + and country code, e.g. +15551234567.",
    validate: (v) => E164_RE.test(v),
  },

  // ---- Google Calendar ----
  "google_calendar.defaultDurationMinutes": {
    required: false,
    invalidMessage: "Enter a whole number of minutes between 5 and 480.",
    validate: (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 5 && n <= 480;
    },
  },
  "google_calendar.timeZone": {
    required: false,
    invalidMessage: "Use an IANA time zone like America/New_York or Europe/London.",
    validate: (v) => IANA_TZ_RE.test(v),
  },
  // defaultCalendarId is free-form (primary or any id) — no rule.

  // ---- HubSpot ----
  "hubspot.importLimit": {
    required: false,
    invalidMessage: "Enter a whole number between 1 and 200.",
    validate: (v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 200;
    },
  },
};

export interface FieldValidationResult {
  /** Inline error to render under the input, or null when valid. */
  error: string | null;
  /** True when this field is required-but-empty. */
  missing: boolean;
}

export function validateField(
  ruleKey: string,
  rawValue: string,
): FieldValidationResult {
  const rule = FIELD_RULES[ruleKey];
  const value = (rawValue ?? "").trim();

  if (!rule) {
    return { error: null, missing: false };
  }
  if (!value) {
    return rule.required
      ? { error: "This field is required.", missing: true }
      : { error: null, missing: false };
  }
  if (rule.validate && !rule.validate(value)) {
    return { error: rule.invalidMessage ?? "Invalid value.", missing: false };
  }
  return { error: null, missing: false };
}

/**
 * Validate a draft against the field list. Returns the per-field error map
 * and a single `valid` flag suitable for disabling Save buttons.
 */
export function validateDraft(
  providerId: string,
  fields: { key: string }[],
  draft: Record<string, string>,
): { errors: Record<string, string | null>; valid: boolean } {
  const errors: Record<string, string | null> = {};
  let valid = true;
  for (const f of fields) {
    const res = validateField(`${providerId}.${f.key}`, draft[f.key] ?? "");
    errors[f.key] = res.error;
    if (res.error) valid = false;
  }
  return { errors, valid };
}
