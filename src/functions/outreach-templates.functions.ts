import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Outreach templates — reusable email templates per organization.
 *
 * The AI uses these as the structural base when personalizing outreach for
 * each lead. Subject and body may contain `{{placeholder}}` tokens
 * (`{{name}}`, `{{first_name}}`, `{{company}}`, `{{role}}`) that the AI
 * substitutes per recipient.
 *
 * RLS enforces:
 *   - SELECT: any org member can read their org's templates.
 *   - INSERT/UPDATE/DELETE: owner or manager only.
 *
 * The handlers below still verify org membership defensively so a forged
 * organizationId in the payload can't trick the server.
 */

const baseFields = {
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  isDefault: z.boolean().optional(),
};

const listSchema = z.object({
  organizationId: z.string().uuid(),
});

const upsertSchema = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid().optional(),
  ...baseFields,
});

const deleteSchema = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid(),
});

export interface OutreachTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

async function ensureMember(
  supabase: any,
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

export const listOutreachTemplatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof listSchema>) => listSchema.parse(input))
  .handler(async ({ data, context }): Promise<OutreachTemplate[]> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { data: rows, error } = await supabase
      .from("outreach_templates")
      .select("id, organization_id, name, description, subject, body, is_default, created_at, updated_at")
      .eq("organization_id", data.organizationId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (rows ?? []) as OutreachTemplate[];
  });

export const upsertOutreachTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof upsertSchema>) => upsertSchema.parse(input))
  .handler(async ({ data, context }): Promise<OutreachTemplate> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    if (data.isDefault) {
      const clearQuery = supabase
        .from("outreach_templates")
        .update({ is_default: false })
        .eq("organization_id", data.organizationId)
        .eq("is_default", true);
      if (data.id) clearQuery.neq("id", data.id);
      const { error: clearErr } = await clearQuery;
      if (clearErr) throw new Error(clearErr.message);
    }

    const payload = {
      organization_id: data.organizationId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      subject: data.subject.trim(),
      body: data.body,
      is_default: !!data.isDefault,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("outreach_templates")
        .update(payload)
        .eq("id", data.id)
        .eq("organization_id", data.organizationId)
        .select("id, organization_id, name, description, subject, body, is_default, created_at, updated_at")
        .single();
      if (error || !row) throw new Error(error?.message || "Failed to update template");
      return row as OutreachTemplate;
    }

    const { data: row, error } = await supabase
      .from("outreach_templates")
      .insert({ ...payload, created_by: userId })
      .select("id, organization_id, name, description, subject, body, is_default, created_at, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message || "Failed to create template");
    return row as OutreachTemplate;
  });

export const deleteOutreachTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof deleteSchema>) => deleteSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ success: true }> => {
    const { supabase, userId } = context;
    await ensureMember(supabase, userId, data.organizationId);

    const { error } = await supabase
      .from("outreach_templates")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
