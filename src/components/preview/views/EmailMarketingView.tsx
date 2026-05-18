import { Mail, PenLine, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EMAIL_CAMPAIGNS } from "../data/email";

export function EmailMarketingView() {
  const totals = EMAIL_CAMPAIGNS.reduce(
    (acc, c) => {
      acc.recipients += c.recipients;
      acc.opened += c.recipients * (c.openRate / 100);
      acc.clicked += c.recipients * (c.clickRate / 100);
      return acc;
    },
    { recipients: 0, opened: 0, clicked: 0 },
  );
  const avgOpen = totals.recipients > 0 ? (totals.opened / totals.recipients) * 100 : 0;
  const avgClick = totals.recipients > 0 ? (totals.clicked / totals.recipients) * 100 : 0;

  return (
    <div data-tour="email" className="space-y-6 scroll-mt-24">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recipients (lifetime)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{totals.recipients.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg open rate</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{avgOpen.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">Industry: ~21%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg click rate</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{avgClick.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">Industry: ~2.6%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Deliverability</p>
          <p className="mt-1 text-2xl font-bold text-success">99.4%</p>
          <p className="text-[10px] text-muted-foreground">Resend · majix.ai SPF/DKIM verified</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Email campaigns</h3>
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 cursor-not-allowed opacity-70"
                    aria-disabled="true"
                    onClick={(e) => e.preventDefault()}
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    New template
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign up to build branded email templates.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="command"
                    size="sm"
                    className="gap-1.5 cursor-not-allowed opacity-70"
                    aria-disabled="true"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    New broadcast
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign up to send broadcasts.</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">List</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Click</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EMAIL_CAMPAIGNS.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">{c.subject}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {c.list}
                  </TableCell>
                  <TableCell className="text-right text-sm">{c.recipients.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-sm">
                    {c.openRate > 0 ? `${c.openRate}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {c.clickRate > 0 ? `${c.clickRate}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        c.status === "Sent"
                          ? "border-success/30 bg-success/10 text-success"
                          : c.status === "Scheduled"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                    {c.sentAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
