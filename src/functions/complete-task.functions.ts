// AI Task Completer — owner-only.
// Drafts a follow-up email with AI, saves it as a message, marks the task done,
// updates lead.last_contact, and returns the draft so the client can fire off
// the actual email through the transactional pipeline (which requires the
// user's JWT, so it's done client-side).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiWithFallback, DEFAULT_TEXT_MODELS } from "@/lib/ai-gateway";
import { z } from "zod";

const inputSchema = z.object({
  taskId: z.string().uuid(),
});

interface CompleteTaskResult {
  taskId: string;
  draft: { subject: string; body: string };
  lead: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  brandName: string;
  senderName: string;
  supportEmail: string | null;
}

export const completeTaskWithAiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<CompleteTaskResult> => {
    const { supabase, userId } = context;

    // 1. Load task (RLS scopes to org) — maybeSingle to fail gracefully
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .select("id, organization_id, title, description, lead_id, status, due_date, priority")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskErr || !task) {
      throw new Error("Task not found or you don't have access to it.");
    }

    // 2. Owner-only
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", task.organization_id)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleRow) {
      throw new Error("Only organization owners can auto-complete tasks with AI.");
    }

    // 3. Org context + token check
    const { data: org } = await supabase
      .from("organizations")
      .select("name, brand_name, support_email, ai_tokens_used, ai_tokens_limit")
      .eq("id", task.organization_id)
      .maybeSingle();

    if (!org) throw new Error("Organization not found.");
    if (org.ai_tokens_used >= org.ai_tokens_limit) {
      throw new Error("AI token limit reached. Upgrade your plan to continue.");
    }

    // 4. Owner profile (for sender name)
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();

    const senderName = ownerProfile?.full_name || "The team";
    const brandName = org.brand_name || org.name;

    // 5. Linked lead
    let lead: {
      id: string;
      name: string;
      email: string | null;
      company: string | null;
      status: string;
      notes: string | null;
    } | null = null;

    if (task.lead_id) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("id, name, email, company, status, notes")
        .eq("id", task.lead_id)
        .maybeSingle();
      lead = leadRow ?? null;
    }

    // 6. AI draft
    const leadCtx = lead
      ? `Lead: ${lead.name}${lead.company ? ` at ${lead.company}` : ""}. Current status: ${lead.status}.${lead.notes ? ` Notes: ${lead.notes}` : ""}`
      : "No lead is linked to this task — write a generic but warm follow-up.";

    const draft = await callAiWithFallback<{ subject: string; body: string }>({
      featureLabel: "AI complete-task",
      models: DEFAULT_TEXT_MODELS,
      organizationId: profile.organization_id,
      userId,
      toolName: "draft_followup_email",
      toolDescription: "Draft a follow-up email for the task",
      systemPrompt: `You are a sales assistant for ${brandName}. Draft a short, human, professional follow-up email that completes the task described. Keep it 3-5 sentences. Address the lead by first name when possible. Reference the task naturally. End with a soft call to action. Avoid templated sales clichés. Sign off as "${senderName}".`,
      userPrompt: `Task title: ${task.title}\nTask description: ${task.description ?? "(none)"}\nPriority: ${task.priority}\n\n${leadCtx}`,
      toolSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Email subject, max 70 chars" },
          body: { type: "string", description: "Email body in plain text" },
        },
        required: ["subject", "body"],
      },
    });

    // 7. Save activity to messages (always — visible in lead drawer)
    if (lead) {
      const { error: msgErr } = await supabase.from("messages").insert({
        organization_id: task.organization_id,
        lead_id: lead.id,
        subject: draft.subject,
        content: draft.body,
        type: "email",
        status: lead.email ? "sent" : "draft",
      });
      if (msgErr) console.warn("complete-task: failed to save message", msgErr);
    }

    // 8. Update lead last_contact
    if (lead && lead.email) {
      await supabase
        .from("leads")
        .update({ last_contact: new Date().toISOString() })
        .eq("id", lead.id);
    }

    // 9. Mark task done
    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", task.id);

    if (updateErr) {
      console.error("complete-task: failed to mark task done", updateErr);
      throw new Error("Failed to update task status.");
    }

    // 10. Increment AI usage
    await supabaseAdmin.rpc("increment_ai_tokens", { p_org_id: task.organization_id });

    return {
      taskId: task.id,
      draft,
      lead: lead ? { id: lead.id, name: lead.name, email: lead.email } : null,
      brandName,
      senderName,
      supportEmail: org.support_email,
    };
  });
