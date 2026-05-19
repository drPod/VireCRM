/**
 * Training Academy — course catalog. Owners/managers see drafts; everyone
 * sees published courses. Click a course to view its lessons.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  GraduationCap,
  Trash2,
  Search,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  industry: string | null;
  position: number;
  published_at: string | null;
}

interface LessonMeta {
  id: string;
  course_id: string;
  duration_minutes: number | null;
}

export const Route = createFileRoute("/_app/academy")({
  component: AcademyIndex,
  head: () => ({
    meta: [{ title: "Academy — VireCRM" }],
  }),
});

function AcademyIndex() {
  const { user, role, profile, organization } = useAuth();
  const canManage = role?.role === "owner" || role?.role === "manager";
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<LessonMeta[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "in_progress" | "published">("all");

  const load = async () => {
    setLoading(true);
    const [coursesRes, lessonsRes, progressRes] = await Promise.all([
      supabase
        .from("courses")
        .select("id, title, description, status, industry, position, published_at")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase.from("lessons").select("id, course_id, duration_minutes"),
      user
        ? supabase
            .from("lesson_progress")
            .select("lesson_id, completed_at")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] as { lesson_id: string; completed_at: string | null }[] }),
    ]);
    if (coursesRes.error) toast.error(`Failed to load: ${coursesRes.error.message}`);
    setCourses((coursesRes.data ?? []) as Course[]);
    setLessons((lessonsRes.data ?? []) as LessonMeta[]);
    setCompletedLessonIds(
      new Set(
        (
          (progressRes.data ?? []) as { lesson_id: string; completed_at: string | null }[]
        )
          .filter((r) => r.completed_at)
          .map((r) => r.lesson_id),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    else {
      toast.success(next === "published" ? "Published" : "Unpublished");
      void load();
    }
  };

  const remove = async (c: Course) => {
    if (!confirm(`Delete "${c.title}"? This deletes its lessons too.`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      setCourses((p) => p.filter((x) => x.id !== c.id));
      toast.success("Deleted");
    }
  };

  // Per-course rollups: lesson count, total duration, completion %.
  const courseStats = useMemo(() => {
    const byCourse = new Map<
      string,
      { count: number; minutes: number; completed: number }
    >();
    for (const l of lessons) {
      const cur = byCourse.get(l.course_id) ?? { count: 0, minutes: 0, completed: 0 };
      cur.count += 1;
      cur.minutes += l.duration_minutes ?? 0;
      if (completedLessonIds.has(l.id)) cur.completed += 1;
      byCourse.set(l.course_id, cur);
    }
    return byCourse;
  }, [lessons, completedLessonIds]);

  // Top-line stats for the header strip.
  const totals = useMemo(() => {
    const totalLessons = lessons.length;
    const totalCompleted = lessons.filter((l) => completedLessonIds.has(l.id)).length;
    const totalMinutes = lessons.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
    const published = courses.filter((c) => c.status === "published").length;
    return {
      courses: courses.length,
      published,
      totalLessons,
      totalCompleted,
      totalMinutes,
      progress: totalLessons ? Math.round((totalCompleted / totalLessons) * 100) : 0,
    };
  }, [courses, lessons, completedLessonIds]);

  // Apply search + filter chips.
  const visibleCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (filter === "published" && c.status !== "published") return false;
      if (filter === "in_progress") {
        const s = courseStats.get(c.id);
        if (!s || s.completed === 0 || s.completed >= s.count) return false;
      }
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q)
      );
    });
  }, [courses, courseStats, query, filter]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Training Academy
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Level up your team.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Onboarding, sales playbooks, and industry-specific courses — all in one place.
              Track progress, embed videos, and publish courses as soon as they're ready.
            </p>
          </div>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="shrink-0">
                  <Plus className="h-4 w-4 mr-1.5" /> New course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create course</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Cold Outreach 101"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desc">Description</Label>
                    <Textarea
                      id="desc"
                      rows={4}
                      placeholder="What will reps learn? Who is this for?"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={create} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stat strip */}
        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            icon={<BookOpen className="h-4 w-4" />}
            label="Courses"
            value={totals.courses}
            sub={`${totals.published} published`}
          />
          <StatTile
            icon={<GraduationCap className="h-4 w-4" />}
            label="Lessons"
            value={totals.totalLessons}
          />
          <StatTile
            icon={<Clock className="h-4 w-4" />}
            label="Total runtime"
            value={formatRuntime(totals.totalMinutes)}
          />
          <StatTile
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Your progress"
            value={`${totals.progress}%`}
            sub={`${totals.totalCompleted}/${totals.totalLessons} done`}
          />
        </div>
      </header>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          {(["all", "published", "in_progress"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "published" ? "Published" : "In progress"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : visibleCourses.length === 0 ? (
        <Card className="py-16 px-6 text-center border-dashed">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {courses.length === 0 ? "Your academy is empty" : "No courses match your filters"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {courses.length === 0
              ? "Build a library of onboarding videos and playbooks so new reps ramp up in days, not weeks."
              : "Try clearing the search or switching to All."}
          </p>
          {canManage && courses.length === 0 && (
            <Button onClick={() => setOpen(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-1.5" /> Create your first course
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCourses.map((c) => {
            const stats = courseStats.get(c.id) ?? { count: 0, minutes: 0, completed: 0 };
            const pct = stats.count ? Math.round((stats.completed / stats.count) * 100) : 0;
            const isComplete = stats.count > 0 && stats.completed >= stats.count;
            return (
              <Card
                key={c.id}
                className="group relative overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                {/* Cover band */}
                <div className="h-20 bg-gradient-to-br from-primary/30 via-primary/15 to-transparent flex items-center justify-center">
                  <GraduationCap className="h-8 w-8 text-primary/70" />
                </div>
                <CardHeader className="pb-2 -mt-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{c.title}</CardTitle>
                    <Badge
                      variant={c.status === "published" ? "default" : "outline"}
                      className="text-[10px] uppercase shrink-0"
                    >
                      {c.status}
                    </Badge>
                  </div>
                  {c.industry && (
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {c.industry}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                      {c.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic min-h-[2.5rem]">
                      No description yet.
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {stats.count} {stats.count === 1 ? "lesson" : "lessons"}
                    </span>
                    {stats.minutes > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatRuntime(stats.minutes)}
                      </span>
                    )}
                    {isComplete && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </span>
                    )}
                  </div>

                  {stats.count > 0 && (
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground">
                        {stats.completed}/{stats.count} lessons · {pct}%
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Link to="/academy/$courseId" params={{ courseId: c.id }} className="flex-1">
                      <Button size="sm" className="w-full">
                        {stats.completed > 0 && !isComplete ? "Continue" : "Open"}
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                    {canManage && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void togglePublish(c)}
                          title={c.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {c.status === "published" ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => void remove(c)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
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
