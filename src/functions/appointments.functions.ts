import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createHash } from "crypto";
import { z } from "zod";

async function hashPassword(plain: string): Promise<string> {
  return createHash("sha256").update(plain.trim()).digest("hex");
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Appointment booking server functions.
 *
 * - Calendar management (CRUD, availability rules)
 * - Appointment management (CRUD, list)
 * - Public slot computation + booking (no auth required)
 *
 * Availability is stored on `calendars.availability` as:
 *   { mon: [{ start: "09:00", end: "17:00" }], tue: [...], ... }
 * with weekday keys: sun, mon, tue, wed, thu, fri, sat.
 */

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type DayWindow = { start: string; end: string };
export type Availability = Record<Weekday, DayWindow[]>;

export interface CalendarRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  color: string | null;
  is_active: boolean;
  slot_duration_minutes: number;
  buffer_minutes: number;
  availability: Availability;
  created_at: string;
  updated_at: string;
  has_access_password: boolean;
}

export interface AppointmentRow {
  id: string;
  organization_id: string;
  calendar_id: string | null;
  lead_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  meeting_url: string | null;
  location: string | null;
  assigned_to: string | null;
  created_at: string;
  lead?: { id: string; name: string; email: string | null } | null;
  calendar?: { id: string; name: string; color: string | null } | null;
}

const orgScope = z.object({ organizationId: z.string().uuid() });

const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function emptyAvailability(): Availability {
  return WEEKDAYS.reduce((acc, d) => {
    acc[d] = d === "sat" || d === "sun" ? [] : [{ start: "09:00", end: "17:00" }];
    return acc;
  }, {} as Availability);
}

async function ensureMember(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  organizationId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile || profile.organization_id !== organizationId) {
    throw new Error("Unauthorized: not a member of this organization");
  }
}

// ---------- Calendars ----------

export const listCalendarsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof orgScope>) => orgScope.parse(input))
  .handler(async ({ data, context }): Promise<CalendarRow[]> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { data: rows, error } = await supabase
      .from("calendars")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows || []).map((r) => {
      const row = r as unknown as CalendarRow & { access_password_hash: string | null };
      return {
        ...row,
        availability: (r.availability as unknown as Availability) || emptyAvailability(),
        has_access_password: !!row.access_password_hash,
      };
    });
  });

const upsertCalendarSchema = orgScope.extend({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
  color: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
  slot_duration_minutes: z.number().int().min(5).max(480).optional(),
  buffer_minutes: z.number().int().min(0).max(240).optional(),
  availability: z
    .record(
      z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
      z.array(z.object({ start: z.string(), end: z.string() })),
    )
    .optional(),
  // Access password control:
  //   - undefined  → leave existing password unchanged
  //   - ""         → clear (remove) any existing password
  //   - "abc..."   → set a new password (hashed server-side)
  access_password: z.string().max(200).optional(),
});

export const upsertCalendarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof upsertCalendarSchema>) =>
    upsertCalendarSchema.parse(input),
  )
  .handler(async ({ data, context }): Promise<CalendarRow> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { id, organizationId, access_password, ...fields } = data;

    // Translate the plain access_password into a stored hash (or clear it).
    const passwordPatch: { access_password_hash?: string | null } = {};
    if (access_password !== undefined) {
      passwordPatch.access_password_hash =
        access_password.trim().length > 0 ? await hashPassword(access_password) : null;
    }

    if (id) {
      const { data: row, error } = await supabase
        .from("calendars")
        .update({ ...fields, ...passwordPatch } as never)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error || !row) throw new Error(error?.message || "Update failed");
      const r = row as unknown as CalendarRow & { access_password_hash: string | null };
      return { ...r, has_access_password: !!r.access_password_hash };
    }
    const { data: row, error } = await supabase
      .from("calendars")
      .insert({
        ...fields,
        ...passwordPatch,
        availability: fields.availability || emptyAvailability(),
        organization_id: organizationId,
        created_by: userId,
      } as never)
      .select()
      .single();
    if (error || !row) throw new Error(error?.message || "Create failed");
    const r = row as unknown as CalendarRow & { access_password_hash: string | null };
    return { ...r, has_access_password: !!r.access_password_hash };
  });

export const deleteCalendarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof orgScope> & { id: string }) =>
    orgScope.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { error } = await supabase
      .from("calendars")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  });

// ---------- Appointments ----------

export const listAppointmentsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof orgScope> & { calendarId?: string; leadId?: string }) =>
    orgScope
      .extend({ calendarId: z.string().uuid().optional(), leadId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AppointmentRow[]> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    let q = supabase
      .from("appointments")
      .select(
        "id, organization_id, calendar_id, lead_id, title, starts_at, ends_at, status, notes, meeting_url, location, assigned_to, created_at, leads(id, name, email), calendars(id, name, color)",
      )
      .eq("organization_id", data.organizationId)
      .order("starts_at", { ascending: true })
      .limit(500);
    if (data.calendarId) q = q.eq("calendar_id", data.calendarId);
    if (data.leadId) q = q.eq("lead_id", data.leadId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows || []).map((r) => {
      const row = r as unknown as AppointmentRow & {
        leads?: AppointmentRow["lead"];
        calendars?: AppointmentRow["calendar"];
      };
      return {
        ...row,
        lead: row.leads,
        calendar: row.calendars,
      };
    });
  });

const createAppointmentSchema = orgScope.extend({
  calendarId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  starts_at: z.string(),
  ends_at: z.string(),
  notes: z.string().max(2000).optional().nullable(),
  meeting_url: z.string().url().max(500).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
});

export const createAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof createAppointmentSchema>) =>
    createAppointmentSchema.parse(input),
  )
  .handler(async ({ data, context }): Promise<AppointmentRow> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { data: row, error } = await supabase
      .from("appointments")
      .insert({
        organization_id: data.organizationId,
        calendar_id: data.calendarId || null,
        lead_id: data.leadId || null,
        title: data.title,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        notes: data.notes || null,
        meeting_url: data.meeting_url || null,
        location: data.location || null,
        assigned_to: userId,
        status: "confirmed",
      })
      .select()
      .single();
    if (error || !row) throw new Error(error?.message || "Create failed");
    return row as unknown as AppointmentRow;
  });

export const cancelAppointmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof orgScope> & { id: string }) =>
    orgScope.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { success: true as const };
  });

// ---------- Public booking (no auth) ----------

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Backend not configured");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface PublicCalendar {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  slot_duration_minutes: number;
  buffer_minutes: number;
  availability: Availability;
  organization_id: string;
  organization_name: string;
  brand_logo: string | null;
  /** When true, the visitor must supply a password before slots/booking work. */
  requires_password: boolean;
}

/**
 * Verifies a calendar's optional access password. Returns the row if access is
 * granted, or throws a consistent error if the calendar is missing/disabled or
 * the password is wrong/missing.
 */
async function loadPublicCalendarOrThrow(
  supabase: ReturnType<typeof createClient<Database>>,
  calendarId: string,
  password: string | undefined,
) {
  const { data: cal, error } = await supabase
    .from("calendars")
    .select(
      "id, organization_id, slot_duration_minutes, buffer_minutes, availability, name, is_active, access_password_hash",
    )
    .eq("id", calendarId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cal || !cal.is_active) throw new Error("Calendar not available");
  const hash = (cal as { access_password_hash: string | null }).access_password_hash;
  if (hash) {
    if (!password) throw new Error("Password required");
    const candidate = await hashPassword(password);
    if (!timingSafeStringEqual(candidate, hash)) throw new Error("Incorrect password");
  }
  return cal;
}

export const getPublicCalendarFn = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(100) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicCalendar | null> => {
    const supabase = getServiceClient();
    const { data: row, error } = await supabase
      .from("calendars")
      .select(
        "id, name, slug, color, slot_duration_minutes, buffer_minutes, availability, organization_id, access_password_hash, organizations(name, brand_name, logo_url)",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const org = (
      row as unknown as {
        organizations?: { name: string; brand_name: string | null; logo_url: string | null };
      }
    ).organizations;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      color: row.color,
      slot_duration_minutes: row.slot_duration_minutes,
      buffer_minutes: row.buffer_minutes,
      availability: (row.availability as unknown as Availability) || emptyAvailability(),
      organization_id: row.organization_id,
      organization_name: org?.brand_name || org?.name || "Genesis",
      brand_logo: org?.logo_url || null,
      requires_password: !!(row as { access_password_hash: string | null }).access_password_hash,
    };
  });

/**
 * Verifies an access password for a calendar. The public booking page calls
 * this once when the visitor submits the password gate; afterwards it passes
 * the password back into the slot/booking calls.
 */
export const verifyCalendarPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((input: { calendarId: string; password: string }) =>
    z.object({ calendarId: z.string().uuid(), password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = getServiceClient();
    await loadPublicCalendarOrThrow(supabase, data.calendarId, data.password);
    return { ok: true as const };
  });

/**
 * Compute available slots for a given calendar between two dates.
 * Subtracts already-booked appointments (excluding cancelled).
 */
export const getAvailableSlotsFn = createServerFn({ method: "POST" })
  .inputValidator((input: { calendarId: string; from: string; to: string; password?: string }) =>
    z
      .object({
        calendarId: z.string().uuid(),
        from: z.string(),
        to: z.string(),
        password: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ slots: string[] }> => {
    const supabase = getServiceClient();
    let cal;
    try {
      cal = await loadPublicCalendarOrThrow(supabase, data.calendarId, data.password);
    } catch {
      // Don't leak whether the password was wrong vs. calendar disabled — the
      // public booking page handles the password gate up-front via getPublicCalendarFn.
      return { slots: [] };
    }

    const availability = (cal.availability as unknown as Availability) || emptyAvailability();
    const slotMs = cal.slot_duration_minutes * 60 * 1000;
    const bufferMs = cal.buffer_minutes * 60 * 1000;
    const fromDate = new Date(data.from);
    const toDate = new Date(data.to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return { slots: [] };

    // Pull existing appointments in window
    const { data: existing } = await supabase
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("calendar_id", data.calendarId)
      .gte("starts_at", fromDate.toISOString())
      .lte("ends_at", new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString());
    const taken = (existing || [])
      .filter((a) => a.status !== "cancelled")
      .map((a) => ({
        start: new Date(a.starts_at).getTime(),
        end: new Date(a.ends_at).getTime(),
      }));

    const slots: string[] = [];
    const cursor = new Date(fromDate);
    cursor.setUTCHours(0, 0, 0, 0);
    const nowMs = Date.now();

    while (cursor.getTime() <= toDate.getTime() && slots.length < 500) {
      const dayKey = WEEKDAYS[cursor.getUTCDay()];
      const windows = availability[dayKey] || [];
      for (const w of windows) {
        const [sh, sm] = w.start.split(":").map((n) => Number(n) || 0);
        const [eh, em] = w.end.split(":").map((n) => Number(n) || 0);
        const dayStart = new Date(cursor);
        dayStart.setUTCHours(sh, sm, 0, 0);
        const dayEnd = new Date(cursor);
        dayEnd.setUTCHours(eh, em, 0, 0);

        for (let t = dayStart.getTime(); t + slotMs <= dayEnd.getTime(); t += slotMs + bufferMs) {
          if (t < nowMs) continue; // skip past
          if (t < fromDate.getTime() || t > toDate.getTime()) continue;
          const slotEnd = t + slotMs;
          const conflict = taken.some((b) => !(slotEnd <= b.start || t >= b.end));
          if (!conflict) slots.push(new Date(t).toISOString());
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { slots };
  });

const publicBookSchema = z.object({
  calendarId: z.string().uuid(),
  starts_at: z.string(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  password: z.string().max(200).optional(),
});

export const bookPublicAppointmentFn = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof publicBookSchema>) => publicBookSchema.parse(input))
  .handler(async ({ data }): Promise<{ id: string; starts_at: string; ends_at: string }> => {
    const supabase = getServiceClient();
    // Validates calendar is active and password (if any) is correct.
    const cal = await loadPublicCalendarOrThrow(supabase, data.calendarId, data.password);

    const startMs = new Date(data.starts_at).getTime();
    if (Number.isNaN(startMs)) throw new Error("Invalid start time");
    if (startMs < Date.now() - 60_000) throw new Error("Cannot book a past slot");
    const endMs = startMs + cal.slot_duration_minutes * 60 * 1000;

    // Conflict check
    const { data: conflicts } = await supabase
      .from("appointments")
      .select("id")
      .eq("calendar_id", cal.id)
      .neq("status", "cancelled")
      .lt("starts_at", new Date(endMs).toISOString())
      .gt("ends_at", new Date(startMs).toISOString())
      .limit(1);
    if (conflicts && conflicts.length > 0) {
      throw new Error("This slot was just taken — please pick another");
    }

    // Find or create lead by email within the org
    let leadId: string | null = null;
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", cal.organization_id)
      .eq("email", data.email)
      .maybeSingle();
    if (existingLead) {
      leadId = existingLead.id;
    } else {
      const { data: newLead } = await supabase
        .from("leads")
        .insert({
          organization_id: cal.organization_id,
          created_by: cal.owner_user_id,
          assigned_to: cal.owner_user_id,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          source: "booking_link",
          status: "new",
          notes: `Booked via "${cal.name}" calendar`,
        })
        .select("id")
        .single();
      leadId = newLead?.id || null;
    }

    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        organization_id: cal.organization_id,
        calendar_id: cal.id,
        lead_id: leadId,
        title: `${data.name} — ${cal.name}`,
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
        status: "confirmed",
        notes: data.notes || null,
      })
      .select("id, starts_at, ends_at")
      .single();
    if (apptErr || !appt) throw new Error(apptErr?.message || "Booking failed");

    return { id: appt.id, starts_at: appt.starts_at, ends_at: appt.ends_at };
  });
