import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { WhiteLabelSettings } from "@/components/crm/WhiteLabelSettings";
import { TeamMembers } from "@/components/crm/TeamMembers";
import { CustomRolesPanel } from "@/components/crm/CustomRolesPanel";
import { EmailAuditLog } from "@/components/crm/EmailAuditLog";
import { TestEmailReport } from "@/components/crm/TestEmailReport";
import { EmailTemplatePreviewPanel } from "@/components/crm/EmailTemplatePreviewPanel";
import { PlatformAdminPanel } from "@/components/crm/PlatformAdminPanel";
import { IntegrationsSettings } from "@/components/crm/IntegrationsSettings";
import { N8nWebhookSettings } from "@/components/crm/N8nWebhookSettings";
import { OutreachTemplatesManager } from "@/components/crm/OutreachTemplatesManager";
import { StripeConnectCard } from "@/components/crm/StripeConnectCard";
import { IndustryTemplatePanel } from "@/components/onboarding/IndustryTemplatePanel";
import { IndustryTemplatePicker } from "@/components/onboarding/IndustryTemplatePicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Palette, Mail, Plug, FileText, Shield, CreditCard, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

// Tab keys mirror the TabsTrigger `value` attrs below. Kept in sync manually
// so the URL ?tab= param can deep-link straight to a section (e.g. Publish in
// Settings → ?tab=branding from the branding preview page, or the
// IndustryGate empty state → ?tab=industry).
const TAB_KEYS = [
  "team",
  "roles",
  "branding",
  "industry",
  "emails",
  "outreach",
  "payments",
  "integrations",
  "admin",
] as const;

const settingsSearchSchema = z.object({
  tab: z.enum(TAB_KEYS).optional(),
  stripe: z.string().optional(),
});

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  validateSearch: settingsSearchSchema,
  head: () => ({
    meta: [
      { title: "Genesis — Settings" },
      { name: "description", content: "Organization, team, and white-label settings" },
    ],
  }),
});

function SettingsPage() {
  useAuth();
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/settings" });
  const activeTab = search.tab ?? "team";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization, team, and branding
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          navigate({
            search: (prev) => ({ ...prev, tab: v === "team" ? undefined : (v as (typeof TAB_KEYS)[number]) }),
            replace: true,
          })
        }
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            White-Label
          </TabsTrigger>
          <TabsTrigger value="industry" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Industry
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="outreach" className="gap-2">
            <FileText className="h-4 w-4" />
            Outreach
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          {isPlatformAdmin && (
            <TabsTrigger value="admin" className="gap-2">
              👑 Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="team">
          <TeamMembers />
        </TabsContent>

        <TabsContent value="roles">
          <CustomRolesPanel />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          {isPlatformAdmin && <IndustryTemplatePanel />}
          <WhiteLabelSettings />
        </TabsContent>

        <TabsContent value="industry" className="space-y-6">
          <IndustryTemplatePicker />
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <TestEmailReport />
          <EmailTemplatePreviewPanel />
          <EmailAuditLog />
        </TabsContent>

        <TabsContent value="outreach">
          <OutreachTemplatesManager />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <StripeConnectCard />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsSettings />
          <N8nWebhookSettings />
        </TabsContent>

        {isPlatformAdmin && (
          <TabsContent value="admin">
            <PlatformAdminPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
