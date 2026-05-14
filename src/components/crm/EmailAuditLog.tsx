import { useEffect, useState } from "react";
import { listRecentEmailLogsFn, type EmailLogEntry } from "@/functions/email-log.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Mail, AlertCircle, Clock, Ban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "sent")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
        <Mail className="h-3 w-3 mr-1" /> Sent
      </Badge>
    );
  if (s === "pending")
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Clock className="h-3 w-3 mr-1" /> Queued
      </Badge>
    );
  if (s === "suppressed")
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15">
        <Ban className="h-3 w-3 mr-1" /> Suppressed
      </Badge>
    );
  // failed / dlq / bounced / complained
  return (
    <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15">
      <AlertCircle className="h-3 w-3 mr-1" /> {status}
    </Badge>
  );
}

export function EmailAuditLog() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("You must be signed in.");
        return;
      }
      const result = await listRecentEmailLogsFn({
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("Forbidden") ? "Only organization owners can view email logs." : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Email audit log</CardTitle>
          <CardDescription>
            Most recent send attempts (last 50 unique messages). Useful for verifying credential and
            transactional emails went out.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && loading && logs.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        )}

        {!error && !loading && logs.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No email activity yet.
          </div>
        )}

        {logs.length > 0 && (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-6 py-2 font-medium">Template</th>
                  <th className="px-6 py-2 font-medium">Recipient</th>
                  <th className="px-6 py-2 font-medium">Status</th>
                  <th className="px-6 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 font-mono text-xs text-foreground">
                      {log.template_name}
                    </td>
                    <td className="px-6 py-3 text-foreground">{log.recipient_email}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        {statusBadge(log.status)}
                        {log.error_message && (
                          <span
                            className="text-xs text-destructive/80 max-w-xs truncate"
                            title={log.error_message}
                          >
                            {log.error_message}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
