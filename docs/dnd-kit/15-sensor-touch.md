Sensors

# Touch

The Touch sensor responds to [Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events). Touch events offer the ability to interpret finger or stylus activity on touch screens or trackpads.

### Activator

The touch activator is the `onTouchStart` event handler. The Touch sensor is initialized if the there is no more than a single touch on the [`event.touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.

### Activation constraints

Like the [Pointer](/legacy/api-documentation/sensors/pointer) sensor, the Touch sensor has two activation constraints:

- Distance constraint
- Delay constraint

These activation constraints are mutually exclusive and may not be used simultaneously.

#### Distance

The distance constraint subscribes to the following interface:

```
interface DistanceConstraint {
  distance: number;
}
```

The `distance` property represents the distance, in *pixels*, by which the touch input needs to be moved before a drag start event is emitted.

#### Delay

The delay constraint subscribe to the following interface:

```
interface DelayConstraint {
  delay: number;
  tolerance: number;
}
```

The `delay` property represents the duration, in *milliseconds*, that a draggable item needs to be held by the touch input before a drag start event is emitted.

The `tolerance` property represents the distance, in *pixels*, of motion that is tolerated before the drag operation is aborted. If the finger or stylus is moved during the delay duration and the tolerance is set to zero, the drag operation will be immediately aborted. If a higher tolerance is set, for example, a tolerance of `5` pixels, the operation will only be aborted if the finger is moved by more than 5 pixels during the delay.

This property is particularly useful for touch input, where some tolerance should be accounted for when using a delay constraint, as touch input is less precise than mouse input.

### Recommendations

#### `touch-action`

We highly recommend you specify the `touch-action` CSS property for all of your draggable elements.

> The **`touch-action`** CSS property sets how an element’s region can be manipulated by a touchscreen user (for example, by zooming features built into the browser).\
> \
> Source: [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)

In general, we recommend you set the `touch-action` property to `manipulation` for draggable elements when using the Touch sensor.

Touch events do not suffer the same limitations as Pointer events, and it is possible to prevent the page from scrolling in `touchmove` events.

<a href="https://x.com/dndkit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="x"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="x-twitter"></span></a><a href="https://github.com/clauderic/dnd-kit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="github"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="github"></span></a>

