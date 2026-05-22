Get started

# Installation

Installing @dnd-kit/core

There’s a new version of **@dnd-kit** available. We recommend you use the [latest version](/) instead.

To get started with the legacy version of **@dnd-kit**, install the core library via `npm` or `yarn`:

```
npm install @dnd-kit/core
```

You’ll also need to be make sure you have peer dependencies installed. Chances are you already have `react` and `react-dom` installed in your project, but if not, make sure to install them:

```
npm install react react-dom
```

## Packages

**@dnd-kit** is a [monorepo](https://en.wikipedia.org/wiki/Monorepo). Depending on your needs, you may also want to install other sub-packages that are available under the `@dnd-kit` namespace.

### Core library

In order to keep the core of the library small, `@dnd-kit/core` only ships with the main building blocks that the majority of users will need most of the time for building drag and drop experiences:

- [Context provider](/legacy/api-documentation/context-provider/dnd-context)
- Hooks for:
  - [Draggable](/legacy/api-documentation/draggable)
  - [Droppable](/legacy/api-documentation/droppable)
- [Drag Overlay](/legacy/api-documentation/draggable/drag-overlay)
- Sensors for:
  - [Pointer](/legacy/api-documentation/sensors/pointer)
  - [Mouse](/legacy/api-documentation/sensors/mouse)
  - [Touch](/legacy/api-documentation/sensors/touch)
  - [Keyboard](/legacy/api-documentation/sensors/keyboard)
- [Accessibility features](/legacy/guides/accessibility)

### Modifiers

Modifiers let you dynamically modify the movement coordinates that are detected by sensors. They can be used for a wide range of use cases, for example:

- Restricting motion to a single axis
- Restricting motion to the draggable node container’s bounding rectangle
- Restricting motion to the draggable node’s scroll container bounding rectangle
- Applying resistance or clamping the motion

The modifiers repository contains a number of useful modifiers that can be applied on [`DndContext`](/legacy/api-documentation/context-provider/dnd-context) as well as [`DraggableClone`](/legacy/api-documentation/draggable/drag-overlay).

To start using modifiers, install the modifiers package via yarn or npm:

```
npm install @dnd-kit/modifiers
```

### Presets

#### [Sortable](/legacy/presets/sortable/overview)

The `@dnd-kit/core` package provides all the building blocks you would need to build a sortable interface from scratch should you choose to, but thankfully you don’t need to.

If you plan on building a sortable interface, we highly recommend you try out `@dnd-kit/sortable`, which is a small layer built on top of `@dnd-kit/core` and optimized for building silky smooth, flexible, and accessible sortable interfaces.

```
npm install @dnd-kit/sortable
```

## Development releases

Each commit merged into the @dnd-kit main branch will trigger a development build to be released to npm under the `next` tag.

To try a development release before the official release, install each @dnd-kit package you intend to use with the `@next`tag

```
npm install @dnd-kit/core@next @dnd-kit/sortable@next
```

Development releases can be unstable, we recommend you lock to a specific development release if you intend to use them in production.

<a href="https://x.com/dndkit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="x"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/x-twitter.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="x-twitter"></span></a><a href="https://github.com/clauderic/dnd-kit" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" target="_blank" rel="noopener noreferrer" aria-label="github"><span style="display:inline-block;width:20px;height:20px;background-color:currentColor;mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);-webkit-mask-image:url(https://d3gk2c5xim1je2.cloudfront.net/v7.1.0/regular/github.svg);mask-size:contain;-webkit-mask-size:contain;mask-repeat:no-repeat;-webkit-mask-repeat:no-repeat;mask-position:center;-webkit-mask-position:center" role="img" aria-label="github"></span></a>

