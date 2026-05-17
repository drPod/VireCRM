import type { Node } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { NODE_TYPE_BY_KIND } from "./nodeTypes";
import type { WorkflowNodeData } from "./WorkflowNode";

interface NodeInspectorProps {
  node: Node | null;
  onUpdate: (id: string, config: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

const LEAD_STATUSES = ["new", "contacted", "qualified", "negotiation", "won", "lost"];
const LEAD_FIELDS = ["score", "status", "source", "company"];
const OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "contains"];

export function NodeInspector({ node, onUpdate, onDelete }: NodeInspectorProps) {
  if (!node) {
    return (
      <div className="flex h-full w-72 flex-col items-center justify-center border-l border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Select a node to configure it</p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Drag nodes from the left panel to start building your workflow
        </p>
      </div>
    );
  }

  const data = node.data as unknown as WorkflowNodeData;
  const meta = NODE_TYPE_BY_KIND[data.kind];
  if (!meta) return null;
  const config = data.config || {};

  const set = (key: string, value: unknown) => onUpdate(node.id, { ...config, [key]: value });

  return (
    <div className="flex h-full w-72 flex-col overflow-y-auto border-l border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {meta.category}
        </div>
        <h3 className="text-base font-semibold text-foreground">{meta.label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {data.kind === "trigger.status_changed" && (
          <>
            <Field label="From status">
              <Select
                value={(config.fromStatus as string) || "any"}
                onValueChange={(v) => set("fromStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any status</SelectItem>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="To status">
              <Select
                value={(config.toStatus as string) || "qualified"}
                onValueChange={(v) => set("toStatus", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        {data.kind === "trigger.message_received" && (
          <Field label="Channel">
            <Select
              value={(config.channel as string) || "any"}
              onValueChange={(v) => set("channel", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any channel</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {data.kind === "action.send_email" && (
          <>
            <Field label="Subject">
              <Input
                value={(config.subject as string) || ""}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="Welcome to {{company}}"
              />
            </Field>
            <Field label="Body" hint="Use {{name}}, {{company}} for personalization">
              <Textarea
                value={(config.body as string) || ""}
                onChange={(e) => set("body", e.target.value)}
                placeholder="Hi {{name}},..."
                rows={6}
              />
            </Field>
          </>
        )}

        {data.kind === "action.add_tag" && (
          <Field label="Tag">
            <Input
              value={(config.tag as string) || ""}
              onChange={(e) => set("tag", e.target.value)}
              placeholder="hot-lead"
            />
          </Field>
        )}

        {data.kind === "action.update_field" && (
          <>
            <Field
              label="Field"
              hint="Allowed: status, score, stage, priority, notes, company, phone, email, name, next_followup_at"
            >
              <Input
                value={(config.field as string) || ""}
                onChange={(e) => set("field", e.target.value)}
                placeholder="status"
              />
            </Field>
            <Field label="Value">
              <Input
                value={(config.value as string) || ""}
                onChange={(e) => set("value", e.target.value)}
                placeholder="qualified"
              />
            </Field>
          </>
        )}

        {data.kind === "action.webhook_post" && (
          <>
            <Field label="URL">
              <Input
                value={(config.url as string) || ""}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://example.com/hook"
              />
            </Field>
            <Field
              label="Body (JSON)"
              hint="Sent inside { lead_id, organization_id, data: <body>, sent_at }"
            >
              <Textarea
                value={
                  typeof config.body === "string"
                    ? (config.body as string)
                    : JSON.stringify(config.body ?? {}, null, 2)
                }
                onChange={(e) => {
                  try {
                    set("body", JSON.parse(e.target.value));
                  } catch {
                    // Keep as raw string so user can keep typing; runtime falls
                    // back to {} when the parsed body is missing.
                    set("body", e.target.value);
                  }
                }}
                placeholder='{ "event": "lead_qualified" }'
                rows={4}
              />
            </Field>
          </>
        )}

        {data.kind === "action.wait" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount">
              <Input
                type="number"
                min={1}
                value={(config.amount as number) || 1}
                onChange={(e) => set("amount", Number(e.target.value))}
              />
            </Field>
            <Field label="Unit">
              <Select
                value={(config.unit as string) || "days"}
                onValueChange={(v) => set("unit", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        {data.kind === "action.branch" && (
          <>
            <Field label="Field">
              <Select
                value={(config.field as string) || "score"}
                onValueChange={(v) => set("field", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Operator">
              <Select
                value={(config.operator as string) || ">"}
                onValueChange={(v) => set("operator", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Value">
              <Input
                value={(config.value as string) || ""}
                onChange={(e) => set("value", e.target.value)}
                placeholder="80"
              />
            </Field>
          </>
        )}

        {meta.category === "trigger" && data.kind === "trigger.lead_created" && (
          <p className="text-xs text-muted-foreground">
            No configuration needed. This trigger fires every time a new lead is created.
          </p>
        )}
      </div>

      <div className="border-t border-border p-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete node
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
