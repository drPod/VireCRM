import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Priority = "low" | "medium" | "high";

interface LeadOption {
  id: string;
  name: string;
  company: string | null;
}

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  defaultDate?: Date;
  onCreated?: () => void;
}

const NO_LEAD = "__none__";

export function NewTaskDialog({
  open,
  onOpenChange,
  organizationId,
  defaultDate,
  onCreated,
}: NewTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(defaultDate);
  const [time, setTime] = useState("09:00");
  const [priority, setPriority] = useState<Priority>("medium");
  const [leadId, setLeadId] = useState<string>(NO_LEAD);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, company")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true })
        .limit(500);
      if (!cancelled && !error && data) {
        setLeads(data as LeadOption[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, defaultDate]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setDate(undefined);
    setTime("09:00");
    setPriority("medium");
    setLeadId(NO_LEAD);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Task title is required");
      return;
    }
    if (!date) {
      toast.error("Pick a due date");
      return;
    }
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const due = new Date(date);
    due.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);

    setSubmitting(true);
    const { error } = await supabase.from("tasks").insert({
      organization_id: organizationId,
      title: trimmedTitle,
      description: description.trim() || null,
      due_date: due.toISOString(),
      priority,
      status: "todo",
      lead_id: leadId === NO_LEAD ? null : leadId,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to create task");
      return;
    }
    toast.success("Task created");
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>
              Schedule a follow-up, call, or internal task. It will appear on your calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Follow up with Acme Inc."
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-time">Time</Label>
                <Input
                  id="task-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-lead">Lead (optional)</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger id="task-lead">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LEAD}>None</SelectItem>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                        {l.company ? ` · ${l.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Notes (optional)</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Context, agenda, or links"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="command" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
