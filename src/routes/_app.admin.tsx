import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  Inbox,
  FileText,
  DollarSign,
  Receipt,
} from "lucide-react";
import { PlatformAdminPanel } from "@/components/crm/PlatformAdminPanel";
import { PlatformAdminsPanel } from "@/components/crm/PlatformAdminsPanel";
import { QuotesPanel } from "@/components/admin/QuotesPanel";
import { FinancialsPanel } from "@/components/admin/FinancialsPanel";
import { OrganizationsPanel } from "@/components/admin/OrganizationsPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { ContactSubmissionsPanel } from "@/components/admin/ContactSubmissionsPanel";
import { TemplateAuditPanel } from "@/components/admin/TemplateAuditPanel";

export const Route = createFileRoute("/_app/admin")({
  component: AdminConsole,
  head: () => ({
    meta: [
      { title: "VireCRM — Platform Admin" },
      { name: "description", content: "Host-only platform administration console" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminConsole() {
  const { user } = useAuth();
  const { loading: checking, isAdmin } = usePlatformAdmin();

  if (checking) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Card className="border-destructive/40">
          <CardHeader className="flex flex-row items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <CardTitle>Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The platform admin console is only available to host administrators.
              {user?.email ? (
                <>
                  {" "}
                  You're signed in as <span className="font-mono">{user.email}</span>.
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Platform Admin Console</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Host-level controls. Every action here applies across all customer organizations.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Crown className="h-3 w-3" /> Super Admin
        </Badge>
      </div>

      <Tabs defaultValue="financials" className="w-full">
        <TabsList>
          <TabsTrigger value="financials" className="gap-2">
            <DollarSign className="h-4 w-4" /> Financials
          </TabsTrigger>
          <TabsTrigger value="orgs" className="gap-2">
            <Building2 className="h-4 w-4" /> Organizations
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="submissions" className="gap-2">
            <Inbox className="h-4 w-4" /> Contact Submissions
          </TabsTrigger>
          <TabsTrigger value="quotes" className="gap-2">
            <Receipt className="h-4 w-4" /> Quotes
          </TabsTrigger>
          <TabsTrigger value="subs" className="gap-2">
            <FileText className="h-4 w-4" /> Manual Subscriptions
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Admins
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldAlert className="h-4 w-4" /> Template Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financials" className="mt-6">
          <FinancialsPanel />
        </TabsContent>
        <TabsContent value="orgs" className="mt-6">
          <OrganizationsPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="submissions" className="mt-6">
          <ContactSubmissionsPanel />
        </TabsContent>
        <TabsContent value="quotes" className="mt-6">
          <QuotesPanel />
        </TabsContent>
        <TabsContent value="subs" className="mt-6">
          <PlatformAdminPanel />
        </TabsContent>
        <TabsContent value="admins" className="mt-6">
          <PlatformAdminsPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <TemplateAuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
