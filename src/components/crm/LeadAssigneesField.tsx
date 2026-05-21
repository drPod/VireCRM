import { AssigneeAvatars } from "./AssigneeAvatars";
import { AssigneeMultiSelect } from "./AssigneeMultiSelect";
import type { OrgMember } from "./LeadDetailDrawer.types";

/**
 * Assignees control for the details form. Owner/manager → editable
 * multi-select. Everyone else → read-only avatar strip with the assignee
 * names. Both layouts collapse to "Unassigned" when there are no assignees.
 */
export function LeadAssigneesField({
  members,
  assigneeIds,
  setAssigneeIds,
  canAssign,
}: {
  members: OrgMember[];
  assigneeIds: string[];
  setAssigneeIds: (ids: string[]) => void;
  canAssign: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">
        Assignees
        {!canAssign && (
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            (owners & managers only)
          </span>
        )}
      </label>
      {canAssign ? (
        <div className="space-y-2">
          <AssigneeMultiSelect
            options={members.map((m) => ({
              user_id: m.user_id,
              full_name: `${m.full_name} (${m.role.replace("_", " ")})`,
            }))}
            selected={assigneeIds}
            onChange={setAssigneeIds}
            placeholder="Unassigned"
            emptyText="No employees yet."
            className="w-full"
          />
          {assigneeIds.length > 0 && (
            <div className="flex items-center gap-2">
              <AssigneeAvatars
                assignees={assigneeIds.map((id) => ({
                  user_id: id,
                  full_name: members.find((m) => m.user_id === id)?.full_name ?? "Unnamed",
                }))}
                size="sm"
                max={5}
              />
              <span className="text-[11px] text-muted-foreground">
                {assigneeIds.length === 1
                  ? "1 employee assigned"
                  : `${assigneeIds.length} employees assigned`}
                {assigneeIds.length > 1 && " · first is primary"}
              </span>
            </div>
          )}
        </div>
      ) : assigneeIds.length > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-input bg-input/40 px-3 py-2">
          <AssigneeAvatars
            assignees={assigneeIds.map((id) => ({
              user_id: id,
              full_name: members.find((m) => m.user_id === id)?.full_name ?? "Unnamed",
            }))}
            size="sm"
            max={5}
          />
          <span className="text-xs text-muted-foreground truncate">
            {assigneeIds
              .map((id) => members.find((m) => m.user_id === id)?.full_name ?? "Unnamed")
              .join(", ")}
          </span>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">Unassigned</p>
      )}
    </div>
  );
}
