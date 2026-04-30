import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PromoBanner } from "@/components/marketing/PromoBanner";
import { BusinessEmailBanner } from "@/components/marketing/BusinessEmailBanner";
import { useDomainBranding } from "@/components/auth/DomainBrandingProvider";


const navLinks = [
  { to: "/", label: "Home" },
  { to: "/preview", label: "Preview" },
  { to: "/pricing", label: "Pricing" },
  { to: "/features", label: "Features" },
  { to: "/contact", label: "Contact" },
];

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isCustomDomain } = useDomainBranding();
  // Never show platform marketing chrome on a verified white-label domain
  if (isCustomDomain) return null;

  return (
    <>
    <BusinessEmailBanner />
    <PromoBanner />
    <header className="fixed top-[64px] z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-lg font-extrabold text-primary-foreground shadow-[0_0_14px_-2px_var(--color-primary)] transition-all duration-300 hover:shadow-[0_0_24px_-2px_var(--color-primary)] hover:scale-105">G</span>
          <span className="text-lg font-bold text-gradient-primary">Genesis</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button variant="command" size="sm">Start Free Trial</Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t border-border bg-background p-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-muted-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="w-full">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button variant="command" size="sm" className="w-full">Start Free Trial</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
