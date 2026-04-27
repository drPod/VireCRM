import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  Globe,
  ShieldCheck,
  Star,
  Plug,
} from "lucide-react";
import { toast } from "sonner";

const LOVABLE_A_RECORD = "185.158.133.1";

interface Props {
  triggerLabel?: string;
}

export function CustomerDomainOnboardingDialog({
  triggerLabel = "Onboarding Guide",
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (value: string, key: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Connect Your Own Domain
          </DialogTitle>
          <DialogDescription>
            Walk through these steps to put your CRM on your own domain
            (e.g. <code className="text-foreground">crm.yourcompany.com</code>).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <Step
            number={1}
            icon={<Plug className="h-4 w-4" />}
            title="Add your hostname"
            body="Open the Custom Domains panel below, click Add Domain, and enter your full hostname — for example crm.yourcompany.com or app.yourcompany.com."
          />

          <Step
            number={2}
            icon={<Globe className="h-4 w-4" />}
            title="Add these DNS records at your registrar"
            body="Log in to your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.) and create the records below. Verification is automatic and retries in the background."
          >
            <div className="mt-3 space-y-2">
              <RecordRow
                type="A"
                name="@"
                value={LOVABLE_A_RECORD}
                copyKey="root"
                copied={copied === "root"}
                onCopy={() => copy(LOVABLE_A_RECORD, "root")}
              />
              <RecordRow
                type="A"
                name="www"
                value={LOVABLE_A_RECORD}
                copyKey="www"
                copied={copied === "www"}
                onCopy={() => copy(LOVABLE_A_RECORD, "www")}
              />
              <RecordRow
                type="TXT"
                name="_lovable"
                value="lovable_verify=<token shown in panel>"
                copyKey="txt"
                copied={copied === "txt"}
                onCopy={() => copy("_lovable", "txt")}
              />
              <p className="text-[11px] text-muted-foreground">
                The exact TXT token is generated when you add the hostname — copy it from the Custom Domains panel.
              </p>
            </div>
          </Step>

          <Step
            number={3}
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Wait for verification & SSL"
            body="DNS usually propagates in minutes but can take up to 72 hours. The panel auto-retries and the SSL & Route Health card confirms your domain is live and serving the CRM."
          >
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">Verifying</Badge>
              <Badge variant="outline" className="text-[10px]">Setting up SSL</Badge>
              <Badge variant="secondary" className="text-[10px]">Active</Badge>
            </div>
          </Step>

          <Step
            number={4}
            icon={<Star className="h-4 w-4" />}
            title="Mark it as Primary"
            body="Once it shows Active, click the star icon to make it your primary domain. Your team and clients will sign in on your branded URL with your logo, colors, and brand name."
          />

          <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
            <p className="text-xs font-medium text-foreground">Useful links</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                onClick={() =>
                  window.open("https://dnschecker.org", "_blank", "noopener,noreferrer")
                }
              >
                <ExternalLink className="h-3 w-3" />
                Check DNS propagation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1.5"
                onClick={() =>
                  window.open(
                    "https://docs.lovable.dev/features/custom-domain",
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <ExternalLink className="h-3 w-3" />
                Full custom domain docs
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stuck? Contact your account owner with the hostname and a screenshot of your DNS settings.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({
  number,
  icon,
  title,
  body,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
        {number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        {children}
      </div>
    </div>
  );
}

function RecordRow({
  type,
  name,
  value,
  copied,
  onCopy,
}: {
  type: string;
  name: string;
  value: string;
  copyKey: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
      <Badge variant="outline" className="text-[10px] shrink-0">
        {type}
      </Badge>
      <code className="text-[11px] font-mono text-muted-foreground shrink-0">
        {name}
      </code>
      <code className="flex-1 truncate text-[11px] font-mono text-foreground">
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-[10px] gap-1"
        onClick={onCopy}
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
