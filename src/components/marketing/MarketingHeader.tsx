import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { BusinessEmailBanner } from "@/components/marketing/BusinessEmailBanner";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
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
    <div className="sticky top-0 z-50 flex flex-col">
      <PaymentTestModeBanner />
      <BusinessEmailBanner />
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.65_0.16_320)] text-lg font-extrabold text-primary-foreground shadow-[0_0_14px_-2px_var(--color-primary)] transition-[box-shadow,transform] duration-300 hover:shadow-[0_0_24px_-2px_var(--color-primary)] hover:scale-105">
              M
            </span>
            <span className="text-lg font-bold text-gradient-primary">VireCRM</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeProps={{ "aria-current": "page" }}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:font-semibold"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild variant="command" size="sm">
              <Link to="/signup">Start Free Trial</Link>
            </Button>
          </div>

          {/* Mobile toggle — Sheet from Radix Dialog handles portal, overlay,
              body scroll lock, focus trap, role=dialog + aria-modal. */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="rounded-md p-1.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-3/4 sm:max-w-sm">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <nav className="mt-6 flex flex-col gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    activeProps={{ "aria-current": "page" }}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:font-semibold"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-2 flex flex-col gap-2">
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/login" onClick={() => setMobileOpen(false)}>
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild variant="default" size="sm" className="w-full">
                    <Link to="/signup" onClick={() => setMobileOpen(false)}>
                      Start Free Trial
                    </Link>
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </div>
  );
}
