import { createFileRoute } from "@tanstack/react-router";
import { WhiteLabelSettings } from "@/components/crm/WhiteLabelSettings";
import { TeamMembers } from "@/components/crm/TeamMembers";
import { EmailAuditLog } from "@/components/crm/EmailAuditLog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Palette, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Genesis — Settings" },
      { name: "description", content: "Organization, team, and white-label settings" },
    ],
  }),
});

function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization, team, and branding
        </p>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            White-Label
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <TeamMembers />
        </TabsContent>

        <TabsContent value="branding">
          <WhiteLabelSettings />
        </TabsContent>

        <TabsContent value="emails">
          <EmailAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
