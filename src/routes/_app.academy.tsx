/**
 * Training Academy — course catalog. Owners/managers see drafts; everyone
 * sees published courses. Click a course to view its lessons.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, GraduationCap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  industry: string | null;
  position: number;
  published_at: string | null;
}

export const Route = createFileRoute("/_app/academy")({
  component: AcademyIndex,
});

function AcademyIndex() {
  const { role, profile, organization } = useAuth();
  const canManage = role?.role === "owner" || role?.role === "manager";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, description, status, industry, position, published_at")
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(`Failed to load: ${error.message}`);
    else setCourses((data ?? []) as Course[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!profile?.organization_id || !form.title.trim()) {
      toast.error("Title required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("courses").insert({
      organization_id: profile.organization_id,
      title: form.title,
      description: form.description || null,
      industry: organization?.industry_template ?? null,
      status: "draft",
      created_by: profile.id,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(`Create failed: ${error.message}`);
      return;
    }
    toast.success("Course created");
    setOpen(false);
    setForm({ title: "", description: "" });
    void load();
  };

  const togglePublish = async (c: Course) => {
    const next = c.status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("courses")
      .update({
        status: next,
        published_at: next === "published" ? new Date().toISOString() : null,
      } as never)
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(next === "published" ? "Published" : "Unpublished"); void load(); }
  };

  const remove = async (c: Course) => {
    if (!confirm(`Delete "${c.title}"? This deletes its lessons too.`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { setCourses((p) => p.filter((x) => x.id !== c.id)); toast.success("Deleted"); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Training Academy
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Onboarding, sales playbooks, and industry-specific courses for your team.
          </p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> New course</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create course</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea id="desc" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : courses.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No courses yet.</p>
          {canManage && <p className="text-xs text-muted-foreground mt-1">Click "New course" to start your library.</p>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Card key={c.id} className="hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  <Badge variant={c.status === "published" ? "default" : "outline"} className="text-[10px] uppercase">
                    {c.status}
                  </Badge>
                </div>
                {c.industry && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.industry}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                {c.description && <p className="text-sm text-muted-foreground line-clamp-3">{c.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  <Link to="/academy/$courseId" params={{ courseId: c.id }}>
                    <Button size="sm" variant="outline">Open</Button>
                  </Link>
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => void togglePublish(c)}>
                        {c.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
