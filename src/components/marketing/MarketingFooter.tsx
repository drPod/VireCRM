import { Link } from "@tanstack/react-router";
import { Terminal } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Terminal className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-gradient-primary">Vireon</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              The autonomous CRM that sells for you.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Product</h4>
            <div className="mt-3 flex flex-col gap-2">
              <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Company</h4>
            <div className="mt-3 flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">About</span>
              <span className="text-sm text-muted-foreground">Blog</span>
              <span className="text-sm text-muted-foreground">Careers</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <div className="mt-3 flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Privacy</span>
              <span className="text-sm text-muted-foreground">Terms</span>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Vireon. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
