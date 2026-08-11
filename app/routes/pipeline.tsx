import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { apiFetch } from "~/lib/api";
import { agentsById, resolveCustomers } from "~/lib/entities";
import { fmtDate } from "~/lib/format";
import { DomainTerm } from "~/components/domain-term";
import { STAGES, type DealListItem, type ListPage, type Stage } from "~/lib/types";
import type { Route } from "./+types/pipeline";

export function meta() {
  return [{ title: "Pipeline · VireCRM" }];
}

interface Column {
  items: DealListItem[];
  nextCursor: string | null;
}

type Board = Record<Stage, Column>;

function fetchStage(stage: Stage, cursor?: string | null): Promise<ListPage<DealListItem>> {
  const qs = new URLSearchParams({ stage, limit: "100" });
  if (cursor) qs.set("cursor", cursor);
  return apiFetch(`/api/deals?${qs}`);
}

export async function clientLoader() {
  // One indexed query per stage (deals_tenant_stage_idx), fetched in parallel.
  const pages = await Promise.all(STAGES.map((s) => fetchStage(s)));
  const board = Object.fromEntries(
    STAGES.map((s, i) => [s, { items: pages[i]!.items, nextCursor: pages[i]!.nextCursor }]),
  ) as Board;

  const [customers, agents] = await Promise.all([
    resolveCustomers(pages.flatMap((p) => p.items.map((d) => d.customerId))),
    agentsById(),
  ]);
  return { board, customers, agents };
}

export function HydrateFallback() {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {STAGES.map((s) => (
        <div key={s} className="w-72 shrink-0 space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function Pipeline({ loaderData }: Route.ComponentProps) {
  const { customers, agents } = loaderData;
  const [board, setBoard] = useState<Board>(loaderData.board);
  const [activeDeal, setActiveDeal] = useState<DealListItem | null>(null);
  const [loadingMore, setLoadingMore] = useState<Stage | null>(null);
  const [customerNames, setCustomerNames] = useState<Map<string, string>>(
    () => new Map([...customers].map(([id, c]) => [id, c.name])),
  );

  // Require a small drag distance so plain clicks still open the deal link.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function findDeal(id: string): { deal: DealListItem; stage: Stage } | null {
    for (const stage of STAGES) {
      const deal = board[stage].items.find((d) => d.id === id);
      if (deal) return { deal, stage };
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveDeal(findDeal(String(e.active.id))?.deal ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveDeal(null);
    const target = e.over?.id as Stage | undefined;
    const found = findDeal(String(e.active.id));
    if (!target || !found || found.stage === target) return;

    const { deal, stage: from } = found;
    const prev = board;
    setBoard({
      ...board,
      [from]: { ...board[from], items: board[from].items.filter((d) => d.id !== deal.id) },
      [target]: {
        ...board[target],
        items: [{ ...deal, stage: target }, ...board[target].items],
      },
    });

    try {
      await apiFetch(`/api/deals/${deal.id}`, { method: "PATCH", body: { stage: target } });
    } catch (err) {
      setBoard(prev);
      toast.error("Couldn't move deal", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function loadMore(stage: Stage) {
    const cursor = board[stage].nextCursor;
    if (!cursor) return;
    setLoadingMore(stage);
    try {
      const page = await fetchStage(stage, cursor);
      const more = await resolveCustomers(page.items.map((d) => d.customerId));
      setCustomerNames((prevNames) => {
        const next = new Map(prevNames);
        for (const [id, c] of more) next.set(id, c.name);
        return next;
      });
      setBoard((prevBoard) => ({
        ...prevBoard,
        [stage]: {
          items: [...prevBoard[stage].items, ...page.items],
          nextCursor: page.nextCursor,
        },
      }));
    } catch (err) {
      toast.error("Couldn't load more deals", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoadingMore(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <DomainTerm term="Pipeline Stage">Pipeline</DomainTerm>
        </h1>
        <p className="text-sm text-muted-foreground">
          Drag a deal between columns to move it through the pipeline.
        </p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              column={board[stage]}
              customerNames={customerNames}
              agents={agents}
              loading={loadingMore === stage}
              onLoadMore={() => loadMore(stage)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? (
            <DealCard
              deal={activeDeal}
              customerName={customerNames.get(activeDeal.customerId)}
              agents={agents}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function StageColumn({
  stage,
  column,
  customerNames,
  agents,
  loading,
  onLoadMore,
}: {
  stage: Stage;
  column: Column;
  customerNames: Map<string, string>;
  agents: Map<string, { name: string }>;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-semibold">
          {stage === "In Pricing" ? <DomainTerm term="In Pricing" /> : stage}
        </span>
        <Badge variant="secondary">
          {column.items.length}
          {column.nextCursor ? "+" : ""}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 px-2 pb-2">
        {column.items.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No deals</p>
        ) : (
          column.items.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              customerName={customerNames.get(deal.customerId)}
              agents={agents}
            />
          ))
        )}
        {column.nextCursor ? (
          <Button variant="ghost" size="sm" disabled={loading} onClick={onLoadMore}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DraggableDealCard(props: {
  deal: DealListItem;
  customerName: string | undefined;
  agents: Map<string, { name: string }>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.deal.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <DealCard {...props} />
    </div>
  );
}

function DealCard({
  deal,
  customerName,
  agents,
  overlay = false,
}: {
  deal: DealListItem;
  customerName: string | undefined;
  agents: Map<string, { name: string }>;
  overlay?: boolean;
}) {
  const agentNames = [deal.primaryAgentId, deal.secondaryAgentId]
    .map((id) => (id ? agents.get(id)?.name : null))
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-md border bg-card p-3 text-card-foreground shadow-sm",
        overlay ? "cursor-grabbing shadow-md" : "cursor-grab",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/deals/${deal.id}`}
          className="text-sm font-medium leading-snug hover:underline"
          // Keep card drag listeners from swallowing link clicks.
          onPointerDown={(e) => e.stopPropagation()}
        >
          {deal.name || customerName || "Untitled deal"}
        </Link>
        {deal.saleStatus ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {deal.saleStatus}
          </Badge>
        ) : null}
      </div>
      {customerName && deal.name !== customerName ? (
        <p className="truncate text-xs text-muted-foreground">{customerName}</p>
      ) : null}
      {agentNames ? (
        <p className="truncate text-xs text-muted-foreground">{agentNames}</p>
      ) : null}
      {deal.saleDate ? (
        <p className="text-xs text-muted-foreground">Sale date: {fmtDate(deal.saleDate)}</p>
      ) : null}
    </div>
  );
}
