Extensibility

# Modifiers

Transform and constrain drag movement.

Modifiers let you dynamically modify the movement coordinates that are detected by sensors. They can be used for a wide range of use cases, for example:

- Restricting motion to a single axis
- Restricting motion to the draggable node container’s bounding rectangle
- Restricting motion to the draggable node’s scroll container bounding rectangle
- Applying resistance or clamping the motion

## Installation

To start using modifiers, install the modifiers package via yarn or npm:

```
npm install @dnd-kit/modifiers
```

## Usage

The modifiers repository contains a number of useful modifiers that can be applied on [`DndContext`](/legacy/api-documentation/context-provider/dnd-context) as well as [`DragOverlay`](/legacy/api-documentation/draggable/drag-overlay).

```
import {DndContext, DragOverlay} from '@dnd-kit';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';

function App() {
  return (
    <DndContext modifiers={[restrictToVerticalAxis]}>
      {/* ... */}
      <DragOverlay modifiers={[restrictToWindowEdges]}>
        {/* ... */}
      </DragOverlay>
    </DndContext>
  )
}
```

As you can see from the example above, `DndContext` and `DragOverlay` can both have different modifiers.

## Built-in modifiers

restrictToHorizontalAxis

Restrict movement to only the horizontal axis.

restrictToVerticalAxis

Restrict movement to only the vertical axis.

### Restrict motion to a container’s bounding rectangle

restrictToWindowEdges

Restrict movement to the edges of the window.

restrictToParentElement

Restrict movement to the parent element of the draggable item that is picked up.

restrictToFirstScrollableAncestor

Restrict movement to the first scrollable ancestor of the draggable item.

### Snap to grid

#### `createSnapModifier`

Function to create modifiers to snap to a given grid size.

```
import {createSnapModifier} from '@dnd-kit/modifiers';

const gridSize = 20; // pixels
const snapToGridModifier = createSnapModifier(gridSize);
```

## Building custom modifiers

To build your own custom modifiers, refer to the implementation of the built-in modifiers of `@dnd-kit/modifiers`: <https://github.com/clauderic/dnd-kit/tree/master/packages/modifiers/src>

For example, here is an implementation to create a modifier to snap to grid:

```
const gridSize = 20;

function snapToGrid(args) {
  const {transform} = args;

  return {
    ...transform,
    x: Math.ceil(transform.x / gridSize) * gridSize,
    y: Math.ceil(transform.y / gridSize) * gridSize,
  };
 }
```

<a href="https://x.com/dndkit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="x"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="x-twitter"></span></a><a href="https://github.com/clauderic/dnd-kit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="github"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="github"></span></a>

