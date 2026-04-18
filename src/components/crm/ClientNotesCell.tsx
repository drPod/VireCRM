import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, StickyNote, Pencil } from "lucide-react";
import { toast } from "sonner";

interface ClientNotesCellProps {
  clientId: string;
  clientName: string;
  initialNotes: string | null;
  onSaved: (newNotes: string | null) => void;
}

export function ClientNotesCell({
  clientId,
  clientName,
  initialNotes,
  onSaved,
}: ClientNotesCellProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialNotes ?? "");
  }, [initialNotes]);

  useEffect(() => {
    if (open) {
      // Reset to latest known value on open
      setValue(initialNotes ?? "");
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    const trimmed = value.trim();
    const payload = trimmed.length === 0 ? null : trimmed;
    const { error } = await supabase
      .from("organizations")
      .update({ notes: payload })
      .eq("id", clientId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save note: " + error.message);
      return;
    }
    toast.success("Note saved");
    onSaved(payload);
    setOpen(false);
  };

  const hasNote = !!(initialNotes && initialNotes.trim().length > 0);
  const preview = hasNote ? initialNotes!.trim() : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex w-full max-w-[240px] items-start gap-1.5 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
          aria-label={hasNote ? "Edit deal note" : "Add deal note"}
        >
          {hasNote ? (
            <>
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="line-clamp-2 text-foreground/90">{preview}</span>
            </>
          ) : (
            <>
              <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
              <span className="italic opacity-70">Add note…</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="mb-2">
          <div className="text-xs font-semibold text-foreground">
            Deal note · {clientName}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Private to your team. Record terms, payment, ownership, etc.
          </div>
        </div>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Paid $10K — lifetime ownership, no recurring billing"
          className="min-h-[100px] text-xs"
          maxLength={2000}
          disabled={saving}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {value.length}/2000
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="command"
              size="sm"
              onClick={handleSave}
              disabled={saving || value === (initialNotes ?? "")}
              className="h-7 text-xs gap-1.5"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
