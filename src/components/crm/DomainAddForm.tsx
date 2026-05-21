import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { provisionCustomHostnameFn } from "@/functions/custom-hostnames.functions";
import { isNotConfigured, describeError } from "@/lib/cf-saas-errors";
import { HOSTNAME_RE, logEvent } from "@/components/crm/custom-domains.types";

interface Props {
  organizationId: string;
  onAdded: () => void;
  onAuditEvent: () => void;
}

export function DomainAddForm({ organizationId, onAdded, onAuditEvent }: Props) {
  const provisionCf = useServerFn(provisionCustomHostnameFn);
  const [newHost, setNewHost] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const clean = newHost
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!HOSTNAME_RE.test(clean)) {
      toast.error("Enter a valid hostname like crm.yourbrand.com");
      return;
    }
    setAdding(true);
    const { data, error } = await supabase.rpc("add_custom_domain", {
      p_org_id: organizationId,
      p_hostname: clean,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      void logEvent({
        orgId: organizationId,
        domainId: null,
        hostname: clean,
        eventType: "added",
        status: "error",
        message: error.message,
      }).then(onAuditEvent);
      return;
    }
    const result = data as { success: boolean; error?: string; id?: string } | null;
    if (!result?.success) {
      toast.error(result?.error || "Could not add hostname");
      void logEvent({
        orgId: organizationId,
        domainId: null,
        hostname: clean,
        eventType: "added",
        status: "error",
        message: result?.error || "Could not add hostname",
      }).then(onAuditEvent);
      return;
    }
    toast.success("Hostname added — we'll keep checking DNS automatically");
    void logEvent({
      orgId: organizationId,
      domainId: result.id ?? null,
      hostname: clean,
      eventType: "added",
      status: "success",
      message: `Added ${clean}`,
    }).then(onAuditEvent);

    // Sync Cloudflare for SaaS state. Best-effort: a 503 means the operator
    // hasn't finished CF setup yet; anything else is a real failure but we
    // don't unwind the add — operator can retry from the panel once CF is
    // healthy. Mirrors EditClientWhiteLabelDialog.handleSave.
    try {
      await provisionCf({ data: { organizationId, hostname: clean } });
      toast.success("Cloudflare custom hostname provisioned");
    } catch (err) {
      if (isNotConfigured(err)) {
        toast.warning(
          "Hostname added, but Cloudflare for SaaS isn't configured on this worker yet — customer DNS won't resolve until that's done.",
        );
      } else {
        toast.error(`Cloudflare provisioning failed: ${describeError(err)}`);
      }
    }

    setNewHost("");
    onAdded();
  };

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={newHost}
        onChange={(e) => setNewHost(e.target.value)}
        placeholder="crm.yourbrand.com"
        className="h-10 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleAdd();
        }}
      />
      <Button
        variant="command"
        onClick={handleAdd}
        disabled={adding || !newHost.trim()}
        className="gap-1.5"
      >
        {adding ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Add
      </Button>
    </div>
  );
}
