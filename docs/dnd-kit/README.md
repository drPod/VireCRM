# `@dnd-kit/core` v6.3.1 (kanban DnD, MIT)

- **Snapshot date:** 2026-05-22
- **Origin:** https://docs.dndkit.com  (legacy site for v6) +
  https://github.com/clauderic/dnd-kit at tag `@dnd-kit/core@6.3.1`
- **Pinned version:** **v6.3.1** (per `CLAUDE.md` stack invariants)
- **Refresh via:** `bash scripts/sync-dnd-kit-docs.sh`
  (regenerate `reference.md` separately via Claude Code context7 MCP)

Used in the SPA for the deal-pipeline kanban (per
`docs/decisions/10-...` — custom kanban, not Atomic CRM, not iframe).
Sister packages also vendored here: `@dnd-kit/sortable`, `@dnd-kit/modifiers`,
`@dnd-kit/utilities`, `@dnd-kit/accessibility`.

## How to use this mirror

1. Skim this README. Each row tells you when to open which file.
2. Start at `01-getting-started.md` if you've never touched dnd-kit.
3. For a question about a specific hook or component, jump straight to its
   row below.
4. Don't WebFetch docs.dndkit.com from the agent — read the local mirror.
   It's pinned to v6.3.1; the live site has drifted toward v7.

## Files

### Quickstart + concepts

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `reference.md` | 8.4 KB | You want a curated v6-only cheat sheet covering the kanban shape we're building. Context7-synthesized. | `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `closestCenter`, `PointerSensor`, `KeyboardSensor`, `SortableContext`, `useSortable`, `arrayMove` |
| `01-getting-started.md` | 10.1 KB | First time on dnd-kit; need the minimal working draggable + droppable. | `useDraggable`, `useDroppable`, `setNodeRef`, `listeners`, `attributes` |
| `02-installation.md` | 4.5 KB | Setting up the package(s) and peer deps. | `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` |

### Context provider

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `03-dnd-context.md` | 12.5 KB | Building `DndContext`: prop list, event callbacks, lifecycle. | `<DndContext>`, `onDragStart`, `onDragMove`, `onDragOver`, `onDragEnd`, `onDragCancel`, `autoScroll`, `sensors`, `collisionDetection`, `modifiers`, `accessibility`, `screenReaderInstructions` |
| `04-collision-detection.md` | 10.7 KB | Choosing or writing a collision detector. | `rectIntersection`, `closestCenter`, `closestCorners`, `pointerWithin`, `getFirstCollision`, custom `CollisionDetection` fn |
| `05-use-dnd-monitor.md` | 2.2 KB | Listening to drag events from a child component without lifting handlers to the provider. | `useDndMonitor`, `DragStartEvent`, `DragMoveEvent`, `DragOverEvent`, `DragEndEvent`, `DragCancelEvent` |

### Draggable

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `06-draggable.md` | 12.0 KB | Conceptual overview of draggables: node ref, listeners, attributes, drag handles, transform math. | `useDraggable`, `setNodeRef`, `listeners`, `attributes`, drag-handle pattern, `CSS.Translate.toString(transform)` |
| `07-use-draggable.md` | 12.8 KB | API contract for `useDraggable` — every argument and return value. | `useDraggable({id, data, disabled, attributes})`, returns `{active, activatorEvent, isDragging, listeners, node, over, setNodeRef, transform}` |
| `08-drag-overlay.md` | 11.7 KB | Rendering a portal-based drag preview / animating drop. | `<DragOverlay>`, `dropAnimation`, `defaultDropAnimation`, `DragOverlay.Portal`, `zIndex` |

### Droppable

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `09-droppable.md` | 4.1 KB | Conceptual overview of droppables. | `useDroppable`, `isOver`, `disabled`, `data` |
| `10-use-droppable.md` | 4.8 KB | API contract for `useDroppable`. | `useDroppable({id, disabled, data})`, returns `{active, isOver, node, over, rect, setNodeRef}` |

### Sensors

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `11-sensors.md` | 5.0 KB | Concept overview, when to mix multiple sensors, activation constraints. | `useSensor`, `useSensors`, `activationConstraint` |
| `12-sensor-pointer.md` | 6.1 KB | Default sensor for mouse + touch + pen. Activation distance / delay. | `PointerSensor`, `PointerSensorOptions` |
| `13-sensor-keyboard.md` | 5.5 KB | Adding keyboard support (required for a11y). | `KeyboardSensor`, `coordinateGetter`, `sortableKeyboardCoordinates` |
| `14-sensor-mouse.md` | 2.9 KB | Mouse-only flows (alternative to `PointerSensor`). | `MouseSensor` |
| `15-sensor-touch.md` | 3.9 KB | Touch-only flows (alternative to `PointerSensor`). | `TouchSensor` |

### Modifiers

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `16-modifiers.md` | 3.8 KB | Constraining or transforming the drag motion (snap-to-grid, restrict-to-axis, etc.). | `modifiers` prop, `Modifier`, `restrictToVerticalAxis`, `restrictToHorizontalAxis`, `restrictToParentElement`, `restrictToWindowEdges`, `snapCenterToCursor`, `createSnapModifier` |

### Accessibility

| File | Size | Consult when… | Key APIs |
|---|---:|---|---|
| `17-accessibility-guide.md` | 15.6 KB | Screen-reader announcements, semantic markup, drag-handle ARIA, customizing `announcements` + `screenReaderInstructions`. | `announcements`, `screenReaderInstructions`, `aria-roledescription`, live regions |

### Package READMEs (verbatim from v6.3.1 tag)

| File | Size | What it is |
|---|---:|---|
| `package-readme.md` | 10.7 KB | Monorepo root README (project pitch, feature list). |
| `core-readme.md` | 0.4 KB | `@dnd-kit/core` package README (install pointer). |
| `sortable-readme.md` | 1.0 KB | `@dnd-kit/sortable` package README. |
| `modifiers-readme.md` | 2.8 KB | `@dnd-kit/modifiers` package README. |
| `utilities-readme.md` | 0.2 KB | `@dnd-kit/utilities` package README. |
| `accessibility-readme.md` | 0.3 KB | `@dnd-kit/accessibility` package README. |
| `core-changelog.md` | 73.4 KB | Full changelog for `@dnd-kit/core` through v6.3.1. Use to chase down behavior changes between minor versions. |

## Provenance

- `_urls.txt` — list of every source URL pulled.
- `_snapshot_date.txt` — `2026-05-22` (matches the date in this header).
- All scrapes flow through `pandoc` (HTML → GFM). Code blocks preserved
  verbatim; surrounding Astro chrome and base64 SVG icons stripped.
