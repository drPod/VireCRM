import { Link } from "@tanstack/react-router";
import { useDomainBranding } from "@/components/auth/DomainBrandingProvider";

export function MarketingFooter() {
  const { isCustomDomain } = useDomainBranding();
  if (isCustomDomain) return null;
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-lg font-extrabold text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-300 hover:shadow-[0_0_24px_rgba(168,85,247,0.7)] hover:scale-110">
                G
              </span>
              <span className="text-lg font-bold text-gradient-primary">Genesis</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              The AI CRM that follows up for you, so your team can close.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Product</h4>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground">
                Features
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
                Pricing
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Company</h4>
            <div className="mt-3 flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">About</span>
              <span className="text-sm text-muted-foreground">Careers</span>
              <a
                href="tel:+19403656600"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                +1 (940) 365-6600
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms of Service
              </Link>
              <Link
                to="/refund-policy"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Refund Policy
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Genesis. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
