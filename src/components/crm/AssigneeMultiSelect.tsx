import { useState } from "react";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

export interface AssigneeOption {
  user_id: string;
  full_name: string;
}

/**
 * Multi-select dropdown of organization members. Used by owners to either
 * filter the lead list by assignee(s) or to bulk-assign leads to several
 * employees at once.
 */
export function AssigneeMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Filter by assignee",
  emptyText = "No employees found.",
  className = "",
}: {
  options: AssigneeOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (userId: string) => {
    if (selected.includes(userId)) {
      onChange(selected.filter((id) => id !== userId));
    } else {
      onChange([...selected, userId]);
    }
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.user_id === selected[0])?.full_name ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`h-9 justify-between gap-2 ${className}`}
        >
          <span className="flex items-center gap-2 truncate">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{label}</span>
            {selected.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {selected.length}
              </Badge>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search employees..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.user_id);
                return (
                  <CommandItem
                    key={opt.user_id}
                    value={opt.full_name}
                    onSelect={() => toggle(opt.user_id)}
                  >
                    <div
                      className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input opacity-50"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{opt.full_name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="text-muted-foreground"
                  >
                    <X className="mr-2 h-4 w-4" /> Clear selection
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
