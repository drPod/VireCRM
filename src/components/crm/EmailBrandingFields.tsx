import { Mail, PenLine } from "lucide-react";

export function EmailSignatureField({
  emailSignature,
  setEmailSignature,
  brandName,
}: {
  emailSignature: string;
  setEmailSignature: (next: string) => void;
  brandName: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <PenLine className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">Email Signature</label>
      </div>
      <textarea
        value={emailSignature}
        onChange={(e) => setEmailSignature(e.target.value)}
        placeholder={"— The Acme team\nhello@acme.com"}
        rows={3}
        className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Appended to outbound emails sent through VireCRM. Leave blank to use the default sign-off
        ("— {brandName || "Your brand"}").
      </p>
    </div>
  );
}

export function BusinessEmailField({
  supportEmail,
  setSupportEmail,
}: {
  supportEmail: string;
  setSupportEmail: (next: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium text-foreground">Business Email</label>
      </div>
      <input
        type="email"
        value={supportEmail}
        onChange={(e) => setSupportEmail(e.target.value)}
        placeholder="you@yourcompany.com"
        className="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Used as the <strong className="text-foreground">Reply-To</strong> on outreach emails sent
        through VireCRM, and as the support address on your branded error screens. When a lead hits
        Reply, the message lands in this inbox. To also send <em>from</em> your own domain, connect
        SendGrid under Integrations.
      </p>
    </div>
  );
}
