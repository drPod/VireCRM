/**
 * Renders any registered transactional template to HTML for in-app preview.
 *
 * - Owner-only (templates can contain customer data placeholders).
 * - Uses each template's `previewData` so the preview matches what the rest
 *   of the email pipeline already shows in dashboard previews.
 * - Returns the resolved subject + a self-contained HTML document so the
 *   client can drop it straight into an iframe srcdoc with no extra wrapping.
 */
import { createServerFn } from "@tanstack/react-start";
import { render } from "@react-email/components";
import { createElement } from "react";
import { z } from "zod";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { assertOwner } from "@/lib/auth-helpers";

const listSchema = z.object({ organizationId: z.string().uuid() });

export const listEmailTemplatesFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof listSchema>) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(supabaseAdmin, context.userId, data.organizationId);

    return Object.entries(TEMPLATES).map(([name, entry]) => ({
      name,
      displayName: entry.displayName ?? name,
      previewData: entry.previewData ?? {},
      fixedRecipient: entry.to ?? null,
    }));
  });

const renderSchema = z.object({
  organizationId: z.string().uuid(),
  templateName: z.string().min(1).max(80),
});

export const renderEmailTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof renderSchema>) => renderSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(supabaseAdmin, context.userId, data.organizationId);

    const entry = TEMPLATES[data.templateName];
    if (!entry) {
      throw new Error(`Unknown template: ${data.templateName}`);
    }

    const previewData = entry.previewData ?? {};
    const subject =
      typeof entry.subject === "function" ? entry.subject(previewData) : entry.subject;

    const html = await render(createElement(entry.component, previewData));

    return {
      name: data.templateName,
      displayName: entry.displayName ?? data.templateName,
      subject,
      fixedRecipient: entry.to ?? null,
      previewData,
      html,
    };
  });
