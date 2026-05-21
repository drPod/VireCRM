import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DomainHealthResult } from "@/functions/domain-health.functions";
import { REQUIRED_CNAME_TARGET, TOKEN_PREFIX, TXT_VERIFICATION_PREFIX } from "@/lib/dns-check";
import { RecordRow } from "./DomainHealthRecordRow";

/**
 * Spells out the expected DNS + redirect setup for a hostname so the user can
 * copy/paste exact values into their registrar.
 */
export function DomainHealthRedirectGuide({
  result,
  onClose,
}: {
  result: DomainHealthResult | null;
  onClose: () => void;
}) {
  if (!result) return null;
  const host = result.hostname;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Expected DNS records</DialogTitle>
          <DialogDescription>
            Configure these records at your DNS registrar for{" "}
            <code className="text-foreground">{host}</code>. Copy any value with one click.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <RecordRow
            label="CNAME (hostname → SaaS)"
            type="CNAME"
            name={host}
            value={REQUIRED_CNAME_TARGET}
            note={`Points ${host} at our Cloudflare for SaaS fallback. SSL is issued automatically.`}
          />
          <RecordRow
            label="Verification TXT"
            type="TXT"
            name={`${TXT_VERIFICATION_PREFIX}.${host}`}
            value={`${TOKEN_PREFIX}…`}
            note="Use the token shown when you added the hostname (not this placeholder)."
          />

          <div className="rounded-md border border-border bg-secondary/20 p-3 text-xs space-y-2">
            <p className="font-medium text-foreground">Setup notes</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>
                Use a subdomain (e.g. <code className="text-foreground">crm.yourcompany.com</code>)
                — apex domains can't legally hold a CNAME at most registrars.
              </li>
              <li>
                Both HTTP and HTTPS on <code className="text-foreground">{host}</code> are served —
                Cloudflare upgrades to HTTPS automatically.
              </li>
              <li>
                Don't add a 301 at your registrar; the app handles redirects between configured
                hostnames.
              </li>
            </ul>
          </div>

          {result.redirected && result.finalUrl && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <p className="font-medium">Currently redirecting to</p>
              <code className="text-foreground">{result.finalUrl}</code>
              <p className="mt-1 opacity-80">
                If this isn't the URL you expect, remove any 301/302 rules at your registrar or
                upstream proxy.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
