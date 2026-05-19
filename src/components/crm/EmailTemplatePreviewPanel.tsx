/**
 * Email template preview panel — owner-only.
 *
 * Lets the owner click any registered transactional template and see
 * exactly how it renders (subject + full HTML) before any send happens.
 *
 * The template HTML is rendered server-side via React Email so the preview
 * is a 1:1 match with what recipients will receive — no in-browser
 * approximation. The HTML is dropped into a sandboxed iframe via `srcdoc`
 * so styles can't leak into the CRM shell.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import {
  listEmailTemplatesFn,
  renderEmailTemplateFn,
} from "@/functions/preview-template.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";

interface TemplateSummary {
  name: string;
  displayName: string;
  previewData: Record<string, unknown>;
  fixedRecipient: string | null;
}

interface RenderedTemplate {
  name: string;
  displayName: string;
  subject: string;
  fixedRecipient: string | null;
  previewData: Record<string, unknown>;
  html: string;
}

export function EmailTemplatePreviewPanel() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const listTemplates = useAuthedServerFn(listEmailTemplatesFn);
  const renderTemplate = useAuthedServerFn(renderEmailTemplateFn);

  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [rendered, setRendered] = useState<RenderedTemplate | null>(null);
  const [loadingRender, setLoadingRender] = useState(false);

  // Initial template list
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoadingList(true);
    listTemplates({ data: { organizationId } })
      .then((rows: TemplateSummary[]) => {
        if (cancelled) return;
        setTemplates(rows);
        if (rows.length > 0 && !activeName) {
          setActiveName(rows[0].name);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Couldn't load email templates");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
    // listTemplates identity is stable enough for this one-shot fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Render whichever template is selected
  useEffect(() => {
    if (!organizationId || !activeName) return;
    let cancelled = false;
    setLoadingRender(true);
    renderTemplate({ data: { organizationId, templateName: activeName } })
      .then((row: RenderedTemplate) => {
        if (cancelled) return;
        setRendered(row);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Couldn't render template");
      })
      .finally(() => {
        if (!cancelled) setLoadingRender(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, activeName]);

  const sortedTemplates = useMemo(
    () => (templates ?? []).slice().sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [templates],
  );

  if (!organizationId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Email template previews
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Click a VireCRM transactional template to see exactly how it will render in a recipient's
          inbox. Previews use sample data — no email is sent.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          {/* Template list */}
          <div className="border rounded-lg overflow-hidden bg-card">
            <ScrollArea className="h-[560px]">
              <div className="p-2 space-y-1">
                {loadingList && templates === null
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))
                  : sortedTemplates.map((tpl) => {
                      const isActive = tpl.name === activeName;
                      return (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => setActiveName(tpl.name)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            isActive
                              ? "bg-primary/15 text-foreground"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="font-medium truncate">{tpl.displayName}</div>
                          <div className="text-xs text-muted-foreground/80 font-mono truncate">
                            {tpl.name}
                          </div>
                        </button>
                      );
                    })}
                {!loadingList && sortedTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground p-3">No registered templates yet.</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preview pane */}
          <div className="border rounded-lg bg-background overflow-hidden flex flex-col h-[560px]">
            <div className="px-4 py-3 border-b bg-muted/40 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Subject</div>
                <div className="text-sm font-medium truncate">
                  {loadingRender && !rendered ? "Loading…" : (rendered?.subject ?? "—")}
                </div>
                {rendered?.fixedRecipient && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Always sent to <span className="font-mono">{rendered.fixedRecipient}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rendered && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {rendered.name}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => activeName && setActiveName(activeName)}
                  disabled={!activeName || loadingRender}
                  title="Re-render preview"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRender ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-white">
              {loadingRender && !rendered ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : rendered ? (
                <iframe
                  // `srcdoc` keeps the email styles isolated from the CRM shell.
                  // `sandbox` allows same-origin styles but blocks scripts/forms.
                  srcDoc={rendered.html}
                  title={`${rendered.displayName} preview`}
                  sandbox="allow-same-origin"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="p-6 text-sm text-muted-foreground">
                  Pick a template on the left to preview it.
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
