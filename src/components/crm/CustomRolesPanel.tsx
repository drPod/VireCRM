import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Loader2,
  Shield,
  Trash2,
  Pencil,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  type PermissionKey,
} from "@/lib/permissions/catalog";

type BaseRole = "owner" | "manager" | "sales_rep";

export interface CustomRole {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  base_role: BaseRole;
  permissions: string[];
  is_builtin: boolean;
  created_at: string;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  color: string;
  base_role: Exclude<BaseRole, "owner">;
  permissions: PermissionKey[];
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  color: "#6366f1",
  base_role: "sales_rep",
  permissions: ["leads.view", "tasks.view"],
};

export function CustomRolesPanel() {
  const { organization, role } = useAuth();
  const isOwner = role?.role === "owner";

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);

  const load = async () => {
    if (!organization) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .eq("organization_id", organization.id)
      .order("is_builtin", { ascending: false })
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setRoles((data ?? []) as CustomRole[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEdit = (r: CustomRole) => {
    setForm({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      color: r.color ?? "#6366f1",
      base_role: r.base_role === "owner" ? "manager" : r.base_role,
      permissions: r.permissions as PermissionKey[],
    });
    setEditorOpen(true);
  };

  const togglePerm = (key: PermissionKey) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  };

  const save = async () => {
    if (!organization) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase
          .from("custom_roles")
          .update({
            name,
            description: form.description.trim() || null,
            color: form.color,
            base_role: form.base_role,
            permissions: form.permissions,
          })
          .eq("id", form.id);
        if (error) throw error;
        toast.success("Role updated");
      } else {
        const { error } = await supabase.from("custom_roles").insert({
          organization_id: organization.id,
          name,
          description: form.description.trim() || null,
          color: form.color,
          base_role: form.base_role,
          permissions: form.permissions,
          is_builtin: false,
        });
        if (error) throw error;
        toast.success("Role created");
      }
      setEditorOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("custom_roles")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Role deleted");
      load();
    }
    setDeleteTarget(null);
  };

  const groupedPerms = useMemo(() => {
    return PERMISSION_GROUPS.map((g) => ({
      group: g,
      perms: PERMISSION_CATALOG.filter((p) => p.group === g),
    }));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Custom Roles
          </h2>
          <p className="text-sm text-muted-foreground">
            Define roles with granular permissions and assign them to your team.
          </p>
        </div>
        {isOwner && (
          <Button variant="command" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New role
          </Button>
        )}
      </div>

      {!isOwner && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Only owners can create or edit custom roles.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No roles yet</div>
        ) : (
          <ul className="divide-y divide-border">
            {roles.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: r.color ?? "#6366f1" }}
                    />
                    <h3 className="text-sm font-semibold text-foreground">{r.name}</h3>
                    {r.is_builtin && (
                      <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {r.base_role.replace("_", " ")} tier
                    </Badge>
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {r.permissions.length} permission{r.permissions.length === 1 ? "" : "s"}
                  </p>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(r)}
                      title={r.is_builtin ? "Edit permissions" : "Edit role"}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!r.is_builtin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit role" : "New custom role"}</DialogTitle>
            <DialogDescription>
              Pick the permissions this role should grant. The base tier is used as a fallback for
              any permission you don&apos;t explicitly toggle here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Solar Specialist"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Base tier</label>
                <Select
                  value={form.base_role}
                  onValueChange={(v) =>
                    setForm({ ...form, base_role: v as "manager" | "sales_rep" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager tier</SelectItem>
                    <SelectItem value="sales_rep">Sales Rep tier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this role is for…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-9 w-16 rounded-lg border border-input bg-input cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Permissions</h4>
              {groupedPerms.map(({ group, perms }) => (
                <div key={group} className="rounded-lg border border-border p-3">
                  <h5 className="text-xs font-semibold text-foreground mb-2">{group}</h5>
                  <div className="space-y-2">
                    {perms.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-start gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={form.permissions.includes(p.key)}
                          onCheckedChange={() => togglePerm(p.key)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{p.label}</p>
                          <p className="text-[11px] text-muted-foreground">{p.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="command" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              Members assigned this role will fall back to their base tier&apos;s default permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
