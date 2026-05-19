/**
 * Course detail — lesson list with inline create/edit/complete tracking.
 * Embeds YouTube/Loom/Vimeo/MP4 videos directly so reps don't have to
 * leave the app, and surfaces total runtime + progress at the top.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  Trash2,
  PlayCircle,
  Clock,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getVideoEmbed } from "@/lib/academy/video-embed";

interface Lesson {
  id: string;
  title: string;
  body: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  position: number;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

export const Route = createFileRoute("/_app/academy/$courseId")({
  component: CourseDetail,
  head: () => ({
    meta: [{ title: "Academy — VireCRM" }],
  }),
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
      supabase
        .from("courses")
        .select("id, title, description, status")
        .eq("id", courseId)
        .maybeSingle(),
      supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("position", { ascending: true }),
      user
        ? supabase.from("lesson_progress").select("lesson_id, completed_at").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);
    setCourse((c as Course) ?? null);
    const list = (l ?? []) as Lesson[];
    setLessons(list);
    // Pick up where the user left off: first incomplete lesson, or first lesson.
    const doneSet = new Set(
      ((p as { lesson_id: string; completed_at: string | null }[]) ?? [])
        .filter((r) => r.completed_at)
        .map((r) => r.lesson_id),
    );
    setCompleted(doneSet);
    const firstIncomplete = list.find((x) => !doneSet.has(x.id));
    setActiveId((firstIncomplete ?? list[0])?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [courseId, user?.id]);

  const create = async () => {
    if (!profile?.organization_id || !form.title.trim()) {
      toast.error("Title required");
      return;
    }
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lesson added");
    setOpen(false);
    setForm({ title: "", body: "", video_url: "", duration_minutes: "" });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      setLessons((p) => p.filter((l) => l.id !== id));
      if (activeId === id) setActiveId(null);
    }
  };

  const markComplete = async (lessonId: string, autoAdvance = false) => {
    if (!user || !profile?.organization_id) return;
    const isDone = completed.has(lessonId);
    const next = new Set(completed);
    if (isDone) next.delete(lessonId);
    else next.add(lessonId);
    setCompleted(next);
    const { error } = await supabase.from("lesson_progress").upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        organization_id: profile.organization_id,
        completed_at: isDone ? null : new Date().toISOString(),
        last_viewed_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,lesson_id" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    // After marking complete, jump to the next lesson if asked.
    if (autoAdvance && !isDone) {
      const idx = lessons.findIndex((l) => l.id === lessonId);
      const next = lessons[idx + 1];
      if (next) setActiveId(next.id);
    }
  };

  const active = lessons.find((l) => l.id === activeId);
  const activeIndex = active ? lessons.findIndex((l) => l.id === active.id) : -1;
  const prevLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex >= 0 && activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;
  const totalMinutes = useMemo(
    () => lessons.reduce((s, l) => s + (l.duration_minutes ?? 0), 0),
    [lessons],
  );
  const progressPct = lessons.length ? Math.round((completed.size / lessons.length) * 100) : 0;
  const embed = useMemo(() => getVideoEmbed(active?.video_url), [active?.video_url]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!course) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-sm text-muted-foreground">Course not found.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/academy">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header card with progress */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/10 via-card to-card border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 max-w-2xl">
            <Link
              to="/academy"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Academy
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-muted-foreground">{course.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
              <Badge variant="outline" className="text-[10px] uppercase">
                {course.status}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </span>
              {totalMinutes > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRuntime(totalMinutes)} total
                </span>
              )}
            </div>
          </div>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1.5" /> Add lesson
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add lesson</DialogTitle>
                  <DialogDescription>
                    Title, video URL, duration, and optional notes for this lesson.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Video URL</Label>
                    <Input
                      placeholder="YouTube, Loom, Vimeo, Wistia, or .mp4"
                      value={form.video_url}
                      onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Pasted videos will play inline — no need to leave the app.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration (min)</Label>
                    <Input
                      type="number"
                      value={form.duration_minutes}
                      onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body / notes</Label>
                    <Textarea
                      rows={5}
                      value={form.body}
                      onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={create} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Course progress</span>
            <span className="font-medium text-foreground">
              {completed.size}/{lessons.length} · {progressPct}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Lesson sidebar */}
        <Card className="p-2 h-fit max-h-[75vh] overflow-y-auto">
          {lessons.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No lessons yet.</p>
              {canManage && (
                <p className="text-xs text-muted-foreground">
                  Click "Add lesson" to build the curriculum.
                </p>
              )}
            </div>
          ) : (
            lessons.map((l, i) => {
              const done = completed.has(l.id);
              const isActive = l.id === activeId;
              return (
                <button
                  key={l.id}
                  onClick={() => setActiveId(l.id)}
                  className={`w-full text-left p-2.5 rounded-md flex items-start gap-2.5 transition-colors ${
                    isActive
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      done
                        ? "bg-success text-success-foreground"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-sm line-clamp-2 ${
                        isActive ? "text-foreground font-medium" : "text-foreground/90"
                      }`}
                    >
                      {l.title}
                    </span>
                    <span className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      {l.video_url && <PlayCircle className="h-3 w-3" />}
                      {l.duration_minutes ? `${l.duration_minutes} min` : "—"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </Card>

        {/* Lesson player */}
        <Card className="p-5 space-y-4">
          {active ? (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Lesson {activeIndex + 1} of {lessons.length}
                  </p>
                  <h2 className="text-xl font-semibold text-foreground mt-0.5">{active.title}</h2>
                  {active.duration_minutes && (
                    <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {active.duration_minutes} min
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={completed.has(active.id) ? "outline" : "default"}
                    onClick={() => void markComplete(active.id, true)}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    {completed.has(active.id) ? "Completed" : "Mark complete"}
                  </Button>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void remove(active.id)}
                      title="Delete lesson"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Embedded video */}
              {embed?.kind === "iframe" ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                  <iframe
                    src={embed.src}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    title={active.title}
                  />
                </div>
              ) : embed?.kind === "video" ? (
                <video
                  src={embed.src}
                  controls
                  className="aspect-video w-full rounded-lg border border-border bg-black"
                />
              ) : active.video_url ? (
                <a
                  href={active.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Open video in new tab
                </a>
              ) : null}

              {active.body && (
                <div className="prose prose-sm max-w-none text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {active.body}
                </div>
              )}

              {!active.video_url && !active.body && (
                <p className="text-sm text-muted-foreground italic">
                  No content for this lesson yet.
                </p>
              )}

              {/* Prev / Next */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!prevLesson}
                  onClick={() => prevLesson && setActiveId(prevLesson.id)}
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  {prevLesson ? prevLesson.title.slice(0, 30) : "Previous"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!nextLesson}
                  onClick={() => nextLesson && setActiveId(nextLesson.id)}
                >
                  {nextLesson ? nextLesson.title.slice(0, 30) : "Next"}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-2">
              <PlayCircle className="h-10 w-10 mx-auto text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                {lessons.length === 0
                  ? "Add a lesson to get started."
                  : "Select a lesson on the left."}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatRuntime(totalMinutes: number): string {
  if (!totalMinutes) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
