import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// TODO(): swap placeholders for real customer logos when assets arrive
const customerLogos = [
  "Green EnergiAi",
  "Sunpath Solar",
  "Apex Roofing Co",
  "Heritage Realty Group",
  "Northbridge Coaching",
  "Vector Home Services",
];

// TODO(): swap pravatar URLs + names for real-customer assets
const testimonials = [
  {
    seed: "genesis-jessica",
    quote:
      "We were losing 60% of our leads to slow follow-up. After VireCRM, our close rate tripled because our reps finally talked to leads while they were still hot.",
    name: "Jessica Torres",
    role: "VP of Sales",
    company: "ScaleUp Inc",
  },
  {
    seed: "genesis-ryan",
    quote:
      "This isn't software — it's a follow-up engine that works 24/7. We stopped doing manual follow-ups entirely and our revenue went up 40% in the first quarter.",
    name: "Ryan Chen",
    role: "Founder",
    company: "NovaTech",
  },
  {
    seed: "genesis-marcus",
    quote:
      "Every lead that comes in gets an instant, personalized response. Our speed-to-lead went from 4 hours to 12 seconds. That alone paid for the entire system.",
    name: "Marcus Williams",
    role: "CEO",
    company: "Digital Growth Agency",
  },
];

export function SocialProofSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Customer logo strip */}
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by operators in solar, real estate, roofing &amp; coaching
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {customerLogos.map((name) => (
            <div
              key={name}
              className="flex h-14 items-center justify-center rounded-lg bg-muted px-3 grayscale transition-all hover:grayscale-0 hover:bg-primary/10"
            >
              <span className="text-center text-sm font-medium text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-xl border border-border bg-card p-6">
              <blockquote className="text-sm leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <Avatar>
                  <AvatarImage src={`https://i.pravatar.cc/96?u=${t.seed}`} alt="" />
                  <AvatarFallback>
                    {t.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.role}, {t.company}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
