# `@dnd-kit/core` v6 reference (context7-sourced)

Source: context7 library `/clauderic/dnd-kit` (GitHub repo's `apps/docs`), queried 2026-05-22.

> **Note on version drift:** the upstream context7 corpus mixes legacy v6
> (`@dnd-kit/core`, `DndContext`, hook returns destructured as
> `{attributes, listeners, setNodeRef, transform}`) with newer pre-v7
> (`@dnd-kit/react`, `DragDropProvider`, hook returns `{ref, isDragging, ...}`).
> We pin v6.3.1 — only v6 snippets below.

## Cross-column kanban (canonical pattern)

Pulled from the upstream `multiple-sortable-lists.mdx`. This is the exact
shape we will use for greenergiai's deal-pipeline kanban.

```jsx
import React, {useState} from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {Column} from './Column';
import {Item} from './Item';

export default function App() {
  const [items, setItems] = useState({
    todo: ['Task 1', 'Task 2', 'Task 3'],
    doing: ['Task 4', 'Task 5'],
    done: ['Task 6', 'Task 7', 'Task 8'],
  });
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function findColumn(id) {
    if (id in items) return id;
    return Object.keys(items).find((key) => items[key].includes(id));
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    const {active, over} = event;
    const activeContainer = findColumn(active.id);
    const overContainer = findColumn(over.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.indexOf(active.id);
      const overIndex = overItems.indexOf(over.id);

      if (activeContainer === overContainer) {
        return {...prev, [overContainer]: arrayMove(overItems, activeIndex, overIndex)};
      }

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((item) => item !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, overIndex),
          active.id,
          ...prev[overContainer].slice(overIndex),
        ],
      };
    });
  }

  function handleDragEnd(event) {
    const {active, over} = event;
    const activeContainer = findColumn(active.id);
    const overContainer = findColumn(over.id);

    if (!activeContainer || !overContainer || activeContainer !== overContainer) {
      return;
    }

    const oldIndex = items[activeContainer].indexOf(active.id);
    const newIndex = items[overContainer].indexOf(over.id);

    setItems((prev) => ({
      ...prev,
      [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
    }));
    setActiveId(null);
  }

  const activeItem = activeId ? <Item id={activeId} isDragging /> : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 20}}>
        {Object.keys(items).map((columnId) => (
          <Column id={columnId} key={columnId} items={items[columnId]}>
            <SortableContext
              items={items[columnId]}
              strategy={verticalListSortingStrategy}
            >
              {items[columnId].map((id) => (
                <Item key={id} id={id} />
              ))}
            </SortableContext>
          </Column>
        ))}
      </div>
      <DragOverlay>{activeItem}</DragOverlay>
    </DndContext>
  );
}
```

```jsx
// Column.js
import React from 'react';
import {useDroppable} from '@dnd-kit/core';

export function Column({children, id}) {
  const {setNodeRef} = useDroppable({id});

  return (
    <div
      ref={setNodeRef}
      style={{padding: 10, border: '1px solid #ccc', borderRadius: 5, minHeight: 100}}
    >
      <h3>{id}</h3>
      {children}
    </div>
  );
}
```

```jsx
// Item.js
import React from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

export function Item({id}) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="item"
    >
      {id}
    </div>
  );
}
```

## `useDraggable` v6 return shape

```jsx
function DraggableItem({id}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({id});

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      Item {id}
    </div>
  );
}
```

## `useDroppable` v6 return shape

```jsx
function Dropzone() {
  const {setNodeRef, isOver} = useDroppable({id: 'drop-zone'});

  return (
    <div
      ref={setNodeRef}
      style={{background: isOver ? 'lightblue' : 'white'}}
    >
      Drop here
    </div>
  );
}
```

## `DragOverlay` drop-animation customization

```jsx
{/* Disable drop animation */}
<DragOverlay dropAnimation={null}>
  <div>No animation on drop</div>
</DragOverlay>

{/* Custom timing */}
<DragOverlay dropAnimation={{duration: 150, easing: 'ease-out'}}>
  <div>Fast drop animation</div>
</DragOverlay>
```

## Sortable hook (v6)

```jsx
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

function Item({id}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {id}
    </div>
  );
}
```

Strategies exported from `@dnd-kit/sortable`:

- `verticalListSortingStrategy` — vertical lists
- `horizontalListSortingStrategy` — horizontal lists
- `rectSortingStrategy` — 2D grids (no swapping)
- `rectSwappingStrategy` — 2D grids, swap on hover
- `arraySwap` / `arrayMove` — helpers for reordering arrays

## Sensors (v6)

```jsx
import {
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {sortableKeyboardCoordinates} from '@dnd-kit/sortable';

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // px to move before drag starts
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);
```

Activation-constraint shapes:

- `{distance: number}` — drag starts after N px of pointer movement.
- `{delay: number, tolerance: number}` — drag starts after N ms hold, aborted
  if the pointer moves more than `tolerance` px during the delay.

## Collision-detection algorithms (v6)

Exported from `@dnd-kit/core`:

- `rectIntersection` — default; bounding-box intersection.
- `closestCenter` — closest center point. Recommended for sortable lists +
  kanban columns.
- `closestCorners` — closest corner; useful when items have widely varying
  sizes.
- `pointerWithin` — checks whether the pointer is inside the droppable rect.
  Pairs well with explicit drop-zones, less so with sortable lists.
- `getFirstCollision` — utility to pull the first collision from a collision
  array.

```jsx
<DndContext collisionDetection={closestCenter}>
```

## See also

- `01-getting-started.md` — quickstart and minimal example.
- `03-dnd-context.md` — full `DndContext` prop list and event payloads.
- `07-use-draggable.md` — full `useDraggable` arguments and return value.
- `10-use-droppable.md` — full `useDroppable` arguments and return value.
- `11-sensors.md` … `15-sensor-touch.md` — per-sensor docs.
- `16-modifiers.md` — modifier system (snap-to-grid, restrict to axis, etc.).
- `17-accessibility-guide.md` — screen-reader announcements, keyboard support.
- `core-changelog.md` — full changelog through v6.3.1.
