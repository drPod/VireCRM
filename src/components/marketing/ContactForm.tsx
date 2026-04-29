import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/config/support";

// Simple math CAPTCHA — no third-party dep, no PII, no tracking.
// Defends against naive bots that bypass the honeypot. Server still
// enforces honeypot + per-IP rate limit as defense in depth.
function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1; // 1-9
  const b = Math.floor(Math.random() * 9) + 1; // 1-9
  return { a, b, answer: a + b };
}

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const captchaPrompt = useMemo(() => `What is ${captcha.a} + ${captcha.b}?`, [captcha]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    budget: "",
    message: "",
    // Honeypot — real users never see/fill this. Bots do.
    website: "",
  });

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const expected = String(captcha.answer);
    if (captchaInput.trim() !== expected) {
      toast.error("Incorrect answer to the security question. Please try again.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim() || null,
          phone: form.phone.trim() || null,
          budget: form.budget || null,
          message: form.message.trim(),
          website: form.website, // honeypot
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
          <a
            href={SUPPORT_MAILTO}
            className="font-semibold text-foreground hover:text-primary"
          >
            {SUPPORT_EMAIL}
          </a>
          . We'll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            placeholder="Jane Smith"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="jane@company.com"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            maxLength={255}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            placeholder="Acme Corp"
            value={form.company}
            onChange={(e) => handleChange("company", e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (940) 365-6600"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            maxLength={50}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="budget">Budget Range</Label>
        <Select value={form.budget} onValueChange={(v) => handleChange("budget", v)}>
          <SelectTrigger id="budget">
            <SelectValue placeholder="Select a budget range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14k">$14,000 — Custom Enterprise</SelectItem>
            <SelectItem value="14k-25k">$14,000 – $25,000</SelectItem>
            <SelectItem value="25k+">$25,000+</SelectItem>
            <SelectItem value="unsure">Not sure yet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Tell us about your project *</Label>
        <Textarea
          id="message"
          placeholder="Describe your business, the features you need, integrations, and any specific requirements…"
          value={form.message}
          onChange={(e) => handleChange("message", e.target.value)}
          maxLength={2000}
          rows={5}
          required
        />
      </div>

      {/* Honeypot — visually hidden, off-screen, not focusable. Bots fill it; humans don't. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
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
        <Label htmlFor="captcha">Security check *</Label>
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
            onChange={(e) => setCaptchaInput(e.target.value.replace(/[^0-9-]/g, "").slice(0, 4))}
            maxLength={4}
            className="w-28"
            required
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
      </div>

      <Button type="submit" variant="command" size="lg" className="w-full gap-2" disabled={loading}>
        {loading ? "Sending…" : "Send Inquiry"}
        <Send className="h-4 w-4" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        We typically respond within 24 hours. No spam, ever.
      </p>
    </form>
  );
}
