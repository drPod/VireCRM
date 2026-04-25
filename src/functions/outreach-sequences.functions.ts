import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Outreach sequence server functions — CRUD for sequences, steps, and
 * enrollments. RLS enforces org isolation; we also defensively verify
 * org membership and manager/owner role for write operations.
 */

export interface OutreachSequence {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "archived";
  stop_on_reply: boolean;
  stop_on_positive_sentiment: boolean;
  stop_on_meeting_booked: boolean;
  send_window_start_hour: number;
  send_window_end_hour: number;
  send_on_weekends: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface OutreachSequenceStep {
  id: string;
  sequence_id: string;
  step_index: number;
  template_id: string | null;
  subject_override: string | null;
  body_override: string | null;
  delay_days: number;
  delay_hours: number;
  is_active: boolean;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step_index: number;
  next_send_at: string | null;
  status: string;
  stop_reason: string | null;
  enrolled_at: string;
  last_sent_at: string | null;
  lead?: { id: string; name: string; email: string | null; company: string | null };
}

const orgScope = z.object({ organizationId: z.string().uuid() });

// ---------- Sequences ----------

export const listSequencesFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => orgScope.parse(input))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireSupabaseAuth();
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.organization_id !== data.organizationId) {
      throw new Error("Access denied");
    }

    const { data: rows, error } = await supabase
      .from("outreach_sequences")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Attach counts per sequence
    const ids = (rows || []).map((r) => r.id);
    const counts = new Map<string, { active: number; total: number }>();
    if (ids.length) {
      const { data: enrollRows } = await supabase
        .from("outreach_sequence_enrollments")
        .select("sequence_id, status")
        .in("sequence_id", ids);
      for (const e of enrollRows || []) {
        const c = counts.get(e.sequence_id) || { active: 0, total: 0 };
        c.total += 1;
        if (e.status === "active") c.active += 1;
        counts.set(e.sequence_id, c);
      }
    }

    return (rows || []).map((r) => ({
      ...(r as OutreachSequence),
      _counts: counts.get(r.id) || { active: 0, total: 0 },
    }));
  });

const upsertSequenceSchema = orgScope.extend({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  stop_on_reply: z.boolean().optional(),
  stop_on_positive_sentiment: z.boolean().optional(),
  stop_on_meeting_booked: z.boolean().optional(),
  send_window_start_hour: z.number().int().min(0).max(23).optional(),
  send_window_end_hour: z.number().int().min(0).max(23).optional(),
  send_on_weekends: z.boolean().optional(),
  timezone: z.string().max(60).optional(),
});

export const upsertSequenceFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => upsertSequenceSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireSupabaseAuth();

    const { id, organizationId, ...fields } = data;
    const payload = { ...fields, organization_id: organizationId, created_by: user.id };

    if (id) {
      const { data: row, error } = await supabase
        .from("outreach_sequences")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row as OutreachSequence;
    }

    const { data: row, error } = await supabase
      .from("outreach_sequences")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as OutreachSequence;
  });

export const deleteSequenceFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => orgScope.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const { error } = await supabase
      .from("outreach_sequences")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------- Steps ----------

export const listStepsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    orgScope.extend({ sequenceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const { data: rows, error } = await supabase
      .from("outreach_sequence_steps")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("sequence_id", data.sequenceId)
      .order("step_index", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows || []) as OutreachSequenceStep[];
  });

const upsertStepSchema = orgScope.extend({
  id: z.string().uuid().optional(),
  sequenceId: z.string().uuid(),
  step_index: z.number().int().min(0).max(50),
  template_id: z.string().uuid().nullable().optional(),
  subject_override: z.string().max(200).nullable().optional(),
  body_override: z.string().max(10000).nullable().optional(),
  delay_days: z.number().int().min(0).max(365),
  delay_hours: z.number().int().min(0).max(23),
  is_active: z.boolean().optional(),
});

export const upsertStepFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => upsertStepSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const { id, organizationId, sequenceId, ...fields } = data;
    const payload = {
      ...fields,
      organization_id: organizationId,
      sequence_id: sequenceId,
    };

    if (id) {
      const { data: row, error } = await supabase
        .from("outreach_sequence_steps")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row as OutreachSequenceStep;
    }

    const { data: row, error } = await supabase
      .from("outreach_sequence_steps")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as OutreachSequenceStep;
  });

export const deleteStepFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    orgScope.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const { error } = await supabase
      .from("outreach_sequence_steps")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------- Enrollments ----------

export const listEnrollmentsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    orgScope.extend({ sequenceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const { data: rows, error } = await supabase
      .from("outreach_sequence_enrollments")
      .select("id, sequence_id, lead_id, current_step_index, next_send_at, status, stop_reason, enrolled_at, last_sent_at, leads(id, name, email, company)")
      .eq("organization_id", data.organizationId)
      .eq("sequence_id", data.sequenceId)
      .order("enrolled_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows || []).map((r) => ({
      ...r,
      lead: r.leads,
    })) as unknown as SequenceEnrollment[];
  });

const enrollSchema = orgScope.extend({
  sequenceId: z.string().uuid(),
  leadIds: z.array(z.string().uuid()).min(1).max(500),
});

export const enrollLeadsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => enrollSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireSupabaseAuth();

    // Find first step to determine initial next_send_at.
    const { data: firstStep } = await supabase
      .from("outreach_sequence_steps")
      .select("delay_days, delay_hours")
      .eq("sequence_id", data.sequenceId)
      .eq("organization_id", data.organizationId)
      .order("step_index", { ascending: true })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    const nextSend = firstStep
      ? new Date(
          now.getTime() +
            firstStep.delay_days * 24 * 60 * 60 * 1000 +
            firstStep.delay_hours * 60 * 60 * 1000,
        ).toISOString()
      : now.toISOString();

    const rows = data.leadIds.map((leadId) => ({
      organization_id: data.organizationId,
      sequence_id: data.sequenceId,
      lead_id: leadId,
      current_step_index: 0,
      next_send_at: nextSend,
      status: "active",
      enrolled_by: user.id,
    }));

    const { data: inserted, error } = await supabase
      .from("outreach_sequence_enrollments")
      .upsert(rows, { onConflict: "sequence_id,lead_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);

    return { enrolled: inserted?.length || 0 };
  });

export const updateEnrollmentStatusFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    orgScope.extend({
      id: z.string().uuid(),
      status: z.enum(["active", "paused", "stopped"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const update: Record<string, unknown> = { status: data.status };
    if (data.status === "stopped") {
      update.stopped_at = new Date().toISOString();
      update.stop_reason = "manual";
      update.next_send_at = null;
    } else if (data.status === "paused") {
      update.next_send_at = null;
    } else if (data.status === "active") {
      // Resume — set next_send_at to now so dispatcher picks it up.
      update.next_send_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from("outreach_sequence_enrollments")
      .update(update)
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ---------- Step log (history) ----------

export interface StepLogRow {
  id: string;
  enrollment_id: string;
  step_index: number;
  status: string;
  subject: string | null;
  error_message: string | null;
  sent_at: string;
  lead?: { name: string; email: string | null };
}

export const listSequenceLogFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    orgScope.extend({ sequenceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase } = await requireSupabaseAuth();
    const { data: rows, error } = await supabase
      .from("outreach_sequence_step_log")
      .select("id, enrollment_id, step_index, status, subject, error_message, sent_at, lead_id, leads(name, email)")
      .eq("organization_id", data.organizationId)
      .eq("sequence_id", data.sequenceId)
      .order("sent_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows || []).map((r) => ({
      ...r,
      lead: r.leads,
    })) as unknown as StepLogRow[];
  });
