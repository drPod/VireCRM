import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

// Simple math CAPTCHA — no third-party dep, no PII, no tracking.
// Defends against naive bots that bypass the honeypot. Server still
// enforces honeypot + per-IP rate limit as defense in depth.
function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

// Single source of truth for client-side validation. Mirrors the server
// schema in src/routes/api/public/contact.ts so users get inline feedback
// before round-tripping the network.
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(200, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email is too long"),
  company: z.string().trim().max(200, "Company name is too long").optional().or(z.literal("")),
  phone: z.string().trim().max(50, "Phone is too long").optional().or(z.literal("")),
  projectType: z.string().optional().or(z.literal("")),
  budget: z.string().optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(20, "Please share at least a sentence or two so we can help")
    .max(2000, "Message is too long"),
});

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  projectType: string;
  budget: string;
  message: string;
  website: string; // honeypot
};

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  projectType: "",
  budget: "",
  message: "",
  website: "",
};

const DRAFT_KEY = "genesis:contact-draft";
const MESSAGE_MAX = 2000;

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "captcha", string>>>({});
  const captchaPrompt = useMemo(() => `What is ${captcha.a} + ${captcha.b}?`, [captcha]);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  // Restore draft on mount (sessionStorage — cleared on tab close, no PII leak across users)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<FormState>;
        setForm((prev) => ({ ...prev, ...draft, website: "" }));
      }
    } catch {
      // ignore corrupt drafts
    }
  }, []);

  // Persist draft as user types (debounced via microtask is fine for a small form)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (submitted) return;
    try {
      const { website: _w, ...persistable } = form;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(persistable));
    } catch {
      // storage may be full / disabled — non-fatal
    }
  }, [form, submitted]);

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field-level error as user edits
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const focusFirstError = (errs: Partial<Record<string, string>>) => {
    const first = Object.keys(errs)[0];
    if (!first || !formRef.current) return;
    const el = formRef.current.querySelector<HTMLElement>(`[name="${first}"], #${first}`);
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setCaptchaInput("");
    setErrors({});
    setSubmitted(false);
    refreshCaptcha();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = contactSchema.safeParse({
      name: form.name,
      email: form.email,
      company: form.company,
      phone: form.phone,
      projectType: form.projectType,
      budget: form.budget,
      message: form.message,
    });

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      focusFirstError(fieldErrors);
      return;
    }

    const expected = String(captcha.answer);
    if (captchaInput.trim() !== expected) {
      setErrors({ captcha: "Incorrect answer. Please try again." });
      refreshCaptcha();
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          company: parsed.data.company || null,
          phone: parsed.data.phone || null,
          // Server may not know projectType yet — fold into message as a tagged prefix
          // so the inquiry email still surfaces it.
          budget: parsed.data.budget || null,
          message: parsed.data.projectType
            ? `[Project type: ${parsed.data.projectType}]\n\n${parsed.data.message}`
            : parsed.data.message,
          website: form.website,
          captcha: { a: captcha.a, b: captcha.b, answer: Number(captchaInput.trim()) },
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok || body.success === false) {
        toast.error(body.error || "Something went wrong. Please try again.");
        refreshCaptcha();
        return;
      }

      setSubmitted(true);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-12 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-success" />
        <h2 className="mt-4 text-2xl font-bold text-foreground">Message Sent!</h2>
        <p className="mt-2 text-muted-foreground">
          Your inquiry was delivered to our team at{" "}
          <a href={SUPPORT_MAILTO} className="font-semibold text-foreground hover:text-primary">
            {SUPPORT_EMAIL}
          </a>
          . We'll get back to you within 24 hours.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-6" onClick={resetForm}>
          Send another message
        </Button>
      </div>
    );
  }

  const messageLen = form.message.length;
  const messageNearLimit = messageLen > MESSAGE_MAX * 0.85;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6 rounded-2xl border border-border bg-card p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldWrapper id="name" label="Full Name" required error={errors.name}>
          <Input
            id="name"
            name="name"
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            maxLength={200}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
        </FieldWrapper>
        <FieldWrapper id="email" label="Email" required error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="jane@company.com"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            maxLength={255}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
        </FieldWrapper>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldWrapper id="company" label="Company" error={errors.company}>
          <Input
            id="company"
            name="company"
            placeholder="Acme Corp"
            value={form.company}
            onChange={(e) => handleChange("company", e.target.value)}
            maxLength={200}
            autoComplete="organization"
          />
        </FieldWrapper>
        <FieldWrapper id="phone" label="Phone" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+1 (940) 365-6600"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            maxLength={50}
            autoComplete="tel"
          />
        </FieldWrapper>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="projectType">I'm interested in</Label>
          <Select value={form.projectType} onValueChange={(v) => handleChange("projectType", v)}>
            <SelectTrigger id="projectType">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom-crm">Custom CRM build</SelectItem>
              <SelectItem value="white-label">White-label / reseller</SelectItem>
              <SelectItem value="full-ownership">Full ownership / source code</SelectItem>
              <SelectItem value="enterprise">Custom Enterprise</SelectItem>
              <SelectItem value="integration">Custom integration</SelectItem>
              <SelectItem value="other">Something else</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget">Budget Range</Label>
          <Select value={form.budget} onValueChange={(v) => handleChange("budget", v)}>
            <SelectTrigger id="budget">
              <SelectValue placeholder="Select a budget range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under-14k">Under $14,000</SelectItem>
              <SelectItem value="14k">$14,000 — Custom Enterprise</SelectItem>
              <SelectItem value="14k-25k">$14,000 – $25,000</SelectItem>
              <SelectItem value="25k+">$25,000+</SelectItem>
              <SelectItem value="unsure">Not sure yet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="message">
            Tell us about your project <span className="text-destructive">*</span>
          </Label>
          <span
            className={`text-xs tabular-nums ${
              messageNearLimit ? "text-warning" : "text-muted-foreground"
            }`}
            aria-live="polite"
          >
            {messageLen}/{MESSAGE_MAX}
          </span>
        </div>
        <Textarea
          id="message"
          name="message"
          placeholder="Describe your business, the features you need, integrations, and any specific requirements…"
          value={form.message}
          onChange={(e) => handleChange("message", e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={5}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        <FieldError id="message-error" message={errors.message} />
      </div>

      {/* Honeypot — visually hidden, off-screen, not focusable. Bots fill it; humans don't. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
      >
        <label htmlFor="website">Website (leave blank)</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => handleChange("website", e.target.value)}
        />
      </div>

      {/* Math CAPTCHA — blocks naive scripted submissions. */}
      <div className="space-y-2">
        <Label htmlFor="captcha">
          Security check <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {captchaPrompt}
          </div>
          <Input
            id="captcha"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Answer"
            value={captchaInput}
            onChange={(e) => {
              setCaptchaInput(e.target.value.replace(/[^0-9-]/g, "").slice(0, 4));
              if (errors.captcha) setErrors((p) => ({ ...p, captcha: undefined }));
            }}
            maxLength={4}
            className="w-28"
            aria-invalid={Boolean(errors.captcha)}
            aria-label="Answer to the security question"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={refreshCaptcha}
            aria-label="Get a new security question"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <FieldError id="captcha-error" message={errors.captcha} />
      </div>

      <Button type="submit" variant="command" size="lg" className="w-full gap-2" disabled={loading}>
        {loading ? "Sending…" : "Send Inquiry"}
        <Send className="h-4 w-4" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        We typically respond within 24 hours. No spam, ever. Your draft is saved while you type.
      </p>
    </form>
  );
}

function FieldWrapper({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1.5 text-xs font-medium text-destructive"
    >
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {message}
    </p>
  );
}
