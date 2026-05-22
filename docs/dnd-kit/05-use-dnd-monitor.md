Context Provider

# useDndMonitor

The `useDndMonitor` hook can be used within components wrapped in a `DndContext` provider to monitor the different drag and drop events that happen for that `DndContext`.

```
import {DndContext, useDndMonitor} from '@dnd-kit/core';

function App() {
  return (
    <DndContext>
      <MyComponent />
    </DndContext>
  );
}

function MyComponent() {
  // Monitor drag and drop events that happen on the parent `DndContext` provider
  useDndMonitor({
    onDragStart(event) {
      console.log('Drag started', event);
    },
    onDragMove(event) {
      console.log('Drag moved', event);
    },
    onDragOver(event) {
      console.log('Drag over', event);
    },
    onDragEnd(event) {
      console.log('Drag ended', event);
    },
    onDragCancel(event) {
      console.log('Drag cancelled', event);
    },
  });
}
```

Make sure you use the `useDndMonitor` hook within a [`<DndContext>`](/legacy/api-documentation/context-provider/dnd-context) provider.

<a href="https://x.com/dndkit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="x"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="x-twitter"></span></a><a href="https://github.com/clauderic/dnd-kit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="github"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="github"></span></a>

