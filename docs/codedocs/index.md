---
title: "Getting Started"
description: "Build type-safe reactive custom elements on top of server-rendered HTML without switching to an SPA."
---

Le Truc adds fine-grained, type-safe reactivity to plain HTML and standard Custom Elements.

## The Problem

- Server-rendered sites often need just a little interactivity, but imperative DOM code turns into tangled event handlers and duplicated selectors.
- SPA frameworks solve state management, yet they also take over rendering, hydration, routing, and deployment choices that many CMS- or template-driven stacks do not want.
- Reusing interactive widgets across projects is difficult when the component contract lives only in ad hoc JavaScript instead of typed properties.
- Updating entire subtrees for one changed value is wasteful when the initial HTML is already correct.

## The Solution

Le Truc keeps the server in charge of markup and adds a tiny reactive layer in the browser. In [`src/component.ts`](../../../../le-truc/src/component.ts), `defineComponent()` turns a custom element into a typed host with reactive properties; in [`src/effects.ts`](../../../../le-truc/src/effects.ts), helpers like `watch()` and `on()` convert those properties into focused DOM updates and event-driven state changes.

```ts
import { bindText, defineComponent } from '@zeix/le-truc'

type HelloProps = {
  name: string
}

defineComponent<HelloProps>('basic-hello', ({ expose, first, on, watch }) => {
  const input = first('input', 'Needed to edit the name.')
  const output = first('output', 'Needed to render the name.')
  const fallback = output.textContent || 'World'

  expose({ name: fallback })

  return [
    on(input, 'input', () => ({ name: input.value || fallback })),
    watch('name', bindText(output)),
  ]
})
```

## Installation

<Tabs items={['npm', 'pnpm', 'yarn', 'bun']}>
<Tab value="npm">
`npm install @zeix/le-truc`
</Tab>
<Tab value="pnpm">
`pnpm add @zeix/le-truc`
</Tab>
<Tab value="yarn">
`yarn add @zeix/le-truc`
</Tab>
<Tab value="bun">
`bun add @zeix/le-truc`
</Tab>
</Tabs>

Le Truc is published as an ESM package, ships TypeScript declarations in `types/`, and is built/tested in a Bun-based workflow. At runtime it targets browsers with Custom Elements, `MutationObserver`, and `requestAnimationFrame`, because the implementation in [`src/ui.ts`](../../../../le-truc/src/ui.ts) and [`src/scheduler.ts`](../../../../le-truc/src/scheduler.ts) depends on those DOM APIs.

## Quick Start

Start with HTML your backend already renders:

```html
<basic-hello>
  <label for="name">Your name</label>
  <input id="name" name="name" type="text" />
  <p>Hello, <output for="name">World</output>!</p>
</basic-hello>
```

Attach behavior:

```ts
import { bindText, defineComponent } from '@zeix/le-truc'

type HelloProps = {
  name: string
}

declare global {
  interface HTMLElementTagNameMap {
    'basic-hello': HTMLElement & HelloProps
  }
}

defineComponent<HelloProps>('basic-hello', ({ expose, first, on, watch }) => {
  const input = first('input', 'Needed to enter the name.')
  const output = first('output', 'Needed to display the name.')

  expose({ name: output.textContent ?? 'World' })

  return [
    on(input, 'input', () => ({ name: input.value || 'World' })),
    watch('name', bindText(output)),
  ]
})
```

Expected behavior:

```txt
Initial render: "Hello, World!"
After typing "Esther": "Hello, Esther!"
```

The important detail is that Le Truc never re-renders the `<basic-hello>` subtree. `watch('name', bindText(output))` updates only the existing `<output>` node. That model is visible in the shipped example at [`examples/basic/hello/basic-hello.ts`](../../../../le-truc/examples/basic/hello/basic-hello.ts).

## Key Features

- HTML-first enhancement for server-rendered pages, CMS templates, and static exports.
- Typed component props declared with `expose()` and surfaced on the host element.
- Explicit reactive effects through `watch()`, `on()`, `pass()`, `each()`, and context helpers.
- Selector-aware query helpers from `first()` and `all()` with lazy dependency tracking.
- Secure DOM mutation helpers such as `bindAttribute()` and `safeSetAttribute()`.
- Direct re-exports from `@zeix/cause-effect` for signals, tasks, stores, memos, and batching.

<Cards>
  <Card title="Architecture" href="/docs/architecture">See how the runtime wires components, queries, and reactive scopes together.</Card>
  <Card title="Core Concepts" href="/docs/components">Learn the component model, effect lifecycle, and composition patterns.</Card>
  <Card title="API Reference" href="/docs/api-reference/component-api">Browse the exported functions, classes, types, and re-exports module by module.</Card>
</Cards>
