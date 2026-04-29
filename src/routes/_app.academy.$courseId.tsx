/**
 * Course detail — lesson list with inline create/edit/complete tracking.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, ArrowLeft, Check, Trash2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Lesson {
  id: string;
  title: string;
  body: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  position: number;
}

interface Course { id: string; title: string; description: string | null; status: string }

export const Route = createFileRoute("/_app/academy/$courseId")({
  component: CourseDetail,
});

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user, role, profile } = useAuth();
  const canManage = role?.role === "owner" || role?.role === "manager";
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", video_url: "", duration_minutes: "" });
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: l }, { data: p }] = await Promise.all([
      supabase.from("courses").select("id, title, description, status").eq("id", courseId).maybeSingle(),
      supabase.from("lessons").select("*").eq("course_id", courseId).order("position", { ascending: true }),
      user ? supabase.from("lesson_progress").select("lesson_id, completed_at").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setCourse((c as Course) ?? null);
    const list = (l ?? []) as Lesson[];
    setLessons(list);
    setActiveId(list[0]?.id ?? null);
    setCompleted(new Set(((p as { lesson_id: string; completed_at: string | null }[]) ?? []).filter((r) => r.completed_at).map((r) => r.lesson_id)));
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [courseId, user?.id]);

  const create = async () => {
    if (!profile?.organization_id || !form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const { error } = await supabase.from("lessons").insert({
      course_id: courseId,
      organization_id: profile.organization_id,
      title: form.title,
      body: form.body || null,
      video_url: form.video_url || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      position: lessons.length,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lesson added");
    setOpen(false);
    setForm({ title: "", body: "", video_url: "", duration_minutes: "" });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setLessons((p) => p.filter((l) => l.id !== id));
  };

  const markComplete = async (lessonId: string) => {
    if (!user || !profile?.organization_id) return;
    const isDone = completed.has(lessonId);
    const next = new Set(completed);
    if (isDone) next.delete(lessonId); else next.add(lessonId);
    setCompleted(next);
    const { error } = await supabase.from("lesson_progress").upsert({
      user_id: user.id,
      lesson_id: lessonId,
      organization_id: profile.organization_id,
      completed_at: isDone ? null : new Date().toISOString(),
      last_viewed_at: new Date().toISOString(),
    } as never, { onConflict: "user_id,lesson_id" });
    if (error) toast.error(error.message);
  };

  const active = lessons.find((l) => l.id === activeId);
  const progressPct = lessons.length ? Math.round((completed.size / lessons.length) * 100) : 0;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!course) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-muted-foreground">Course not found.</p>
        <Link to="/academy"><Button variant="outline" size="sm" className="mt-3"><ArrowLeft className="h-4 w-4 mr-1.5" />Back</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/academy" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Academy
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{course.title}</h1>
          {course.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{course.description}</p>}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-[10px] uppercase">{course.status}</Badge>
            <span className="text-xs text-muted-foreground">{progressPct}% complete</span>
          </div>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Add lesson</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add lesson</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Video URL</Label><Input placeholder="https://… (YouTube, Loom, MP4)" value={form.video_url} onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Body / notes</Label><Textarea rows={5} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="p-2 h-fit max-h-[70vh] overflow-y-auto">
          {lessons.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No lessons yet.</p>
          ) : (
            lessons.map((l, i) => {
              const done = completed.has(l.id);
              const isActive = l.id === activeId;
              return (
                <button
                  key={l.id}
                  onClick={() => setActiveId(l.id)}
                  className={`w-full text-left p-2.5 rounded-md flex items-start gap-2 transition-colors ${
                    isActive ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="flex-1 text-sm text-foreground line-clamp-2">{l.title}</span>
                </button>
              );
            })
          )}
        </Card>

        <Card className="p-5 space-y-4">
          {active ? (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{active.title}</h2>
                  {active.duration_minutes && <p className="text-xs text-muted-foreground">{active.duration_minutes} min</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={completed.has(active.id) ? "outline" : "default"} onClick={() => void markComplete(active.id)}>
                    <Check className="h-4 w-4 mr-1.5" />
                    {completed.has(active.id) ? "Completed" : "Mark complete"}
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(active.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {active.video_url && (
                <a href={active.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <PlayCircle className="h-4 w-4" /> Open video
                </a>
              )}
              {active.body && <div className="text-sm text-foreground/90 whitespace-pre-wrap">{active.body}</div>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Select a lesson on the left.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
