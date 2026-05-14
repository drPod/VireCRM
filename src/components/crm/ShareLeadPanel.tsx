import { useEffect, useState, useCallback } from "react";
import { Loader2, Share2, X, Users, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Member = { user_id: string; full_name: string };
type ShareRow = {
  id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  message: string | null;
  created_at: string;
};

interface ShareLeadPanelProps {
  leadId: string;
  /** uid of the lead's creator — required to know if current user can share */
  createdBy: string | null;
  /** uid of the lead's primary assignee — also counts as owner */
  assignedTo: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ShareLeadPanel({ leadId, createdBy, assignedTo }: ShareLeadPanelProps) {
  const { user, organization, role } = useAuth();
  const myId = user?.id ?? "";
  const isOrgOwner = role?.role === "owner";
  const canShare = Boolean(isOrgOwner || (myId && (createdBy === myId || assignedTo === myId)));

  const [members, setMembers] = useState<Member[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  // Map of user_id -> name for quick lookup
  const nameOf = useCallback(
    (uid: string) => members.find((m) => m.user_id === uid)?.full_name ?? "Unknown",
    [members],
  );

  // Load org members + existing shares
  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const [membersRes, sharesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").eq("organization_id", organization.id),
      supabase
        .from("lead_shares")
        .select("id, shared_with_user_id, shared_by_user_id, message, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
    ]);

    setMembers(
      (membersRes.data ?? [])
        .filter((p): p is { user_id: string; full_name: string | null } => Boolean(p.user_id))
        .map((p) => ({ user_id: p.user_id, full_name: p.full_name ?? "Unnamed" }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    );
    setShares(sharesRes.data ?? []);
    setLoading(false);
  }, [organization?.id, leadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sharedIds = new Set(shares.map((s) => s.shared_with_user_id));
  // Eligible recipients: org members minus self, owner of lead, current shares
  const candidates = members.filter(
    (m) =>
      m.user_id !== myId &&
      m.user_id !== createdBy &&
      m.user_id !== assignedTo &&
      !sharedIds.has(m.user_id) &&
      m.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleShare = async (recipientId: string) => {
    setPending(recipientId);
    try {
      const { data, error } = await supabase.rpc("share_lead", {
        p_lead_id: leadId,
        p_recipient_user_id: recipientId,
        p_message: message.trim() || undefined,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? "Could not share lead");
      toast.success(`Shared with ${nameOf(recipientId)}`);
      setMessage("");
      setSearch("");
      setPickerOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setPending(null);
    }
  };

  const handleUnshare = async (recipientId: string) => {
    setPending(recipientId);
    try {
      const { data, error } = await supabase.rpc("unshare_lead", {
        p_lead_id: leadId,
        p_recipient_user_id: recipientId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? "Could not unshare");
      toast.success(`Removed ${nameOf(recipientId)} from share list`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unshare");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Shared with</span>
          {shares.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {shares.length}
            </Badge>
          )}
        </div>
        {canShare && (
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-2">
              <div className="text-xs font-medium text-foreground">Share this lead with…</div>
              <Input
                placeholder="Search teammates"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="relative">
                <MessageSquarePlus className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Textarea
                  placeholder="Optional note (e.g. 'Can you call them tomorrow?')"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                  className="min-h-[52px] resize-none pl-7 text-xs"
                />
              </div>
              <div className="max-h-48 space-y-0.5 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    {members.length <= 1
                      ? "No other employees in your org yet."
                      : "No matching teammates left to share with."}
                  </p>
                ) : (
                  candidates.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      disabled={pending === m.user_id}
                      onClick={() => handleShare(m.user_id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        pending === m.user_id && "opacity-50",
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {initials(m.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-xs">{m.full_name}</span>
                      {pending === m.user_id && <Loader2 className="h-3 w-3 animate-spin" />}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading shares…
        </div>
      ) : shares.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canShare
            ? "Not shared yet. Click Share to give a teammate access."
            : "This lead hasn't been shared with anyone."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {shares.map((s) => {
            const recipient = nameOf(s.shared_with_user_id);
            const sharer = nameOf(s.shared_by_user_id);
            const canRemove = canShare || s.shared_with_user_id === myId; // recipient can self-remove
            return (
              <li
                key={s.id}
                className="group flex items-start gap-2 rounded-md border border-border/60 bg-card/40 px-2 py-1.5"
              >
                <Avatar className="mt-0.5 h-7 w-7">
                  <AvatarFallback className="text-[10px]">{initials(recipient)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{recipient}</span>
                    {s.shared_with_user_id === myId && (
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">
                        you
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Shared by {s.shared_by_user_id === myId ? "you" : sharer} ·{" "}
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {s.message && (
                    <p className="mt-1 rounded bg-muted/40 px-1.5 py-1 text-[11px] text-foreground/80">
                      “{s.message}”
                    </p>
                  )}
                </div>
                {canRemove && (
                  <button
                    type="button"
                    disabled={pending === s.shared_with_user_id}
                    onClick={() => handleUnshare(s.shared_with_user_id)}
                    title={s.shared_with_user_id === myId ? "Remove yourself" : "Revoke access"}
                    className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {pending === s.shared_with_user_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
