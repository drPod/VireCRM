import { Fragment } from "react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminSubmissionRow } from "@/types/admin";

import { SubmissionDetail } from "./SubmissionDetail";

/**
 * The contact-submissions table: header row + summary row per submission
 * with an expanded `SubmissionDetail` row beneath when toggled open.
 * Pure rendering — state lives in `useContactSubmissions` via the parent.
 */
export function SubmissionTable({
  rows,
  expanded,
  savingId,
  onToggleRow,
  onSetStatus,
}: {
  rows: AdminSubmissionRow[];
  expanded: Set<string>;
  savingId: string | null;
  onToggleRow: (id: string) => void;
  onSetStatus: (id: string, status: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>From</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const isOpen = expanded.has(s.id);
            return (
              <Fragment key={s.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onToggleRow(s.id)}
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{s.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{s.email}</div>
                    {s.test_mode ? (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        test
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{s.company ?? "—"}</TableCell>
                  <TableCell>
                    {s.project_type ? <Badge variant="outline">{s.project_type}</Badge> : "—"}
                  </TableCell>
                  <TableCell>{s.budget ?? "—"}</TableCell>
                  <TableCell>
                    {s.priority_suggestion ? (
                      <Badge
                        variant={
                          s.priority_suggestion === "critical" ||
                          s.priority_suggestion === "high"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {s.priority_suggestion}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "replied" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
                {isOpen ? (
                  <SubmissionDetail
                    key={`${s.id}-detail`}
                    submission={s}
                    savingId={savingId}
                    onSetStatus={onSetStatus}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
