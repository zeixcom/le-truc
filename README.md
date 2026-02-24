# Le Truc

**Type-safe reactive Web Components — HTML-first, backend-agnostic**

Le Truc adds a thin reactive layer to server-rendered HTML. You keep your existing backend (Java, PHP, Python, C#, static site generator — anything that outputs HTML). Le Truc wires fine-grained DOM updates to reactive component properties in the browser, without re-rendering whole subtrees and without requiring JavaScript on the server.

The result is SolidJS-style reactivity packaged as standard Custom Elements: components are reusable across projects, type-safe, and carry no framework lock-in.

## Why

Digital agencies building content-rich sites face a recurring choice: imperative JavaScript that becomes unmaintainable as complexity grows, or a SPA framework that takes over rendering and requires a JavaScript backend. Neither is a good fit when the backend is a CMS and the initial HTML is already correct.

Le Truc solves the specific problem of *stateful interactivity on server-rendered pages*:

- The server renders HTML — Le Truc never re-renders it
- Reactive properties update only the DOM nodes that actually changed
- Components are plain Custom Elements — they work in any host environment
- TypeScript catches integration errors at compile time

## Installation

```bash
npm install @zeix/le-truc
# or
bun add @zeix/le-truc
```

## Quick Start

1. Start with your server-rendered HTML:

```html
<basic-hello>
  <label for="name">Your name</label>
  <input id="name" name="name" type="text" autocomplete="given-name" />
  <p>Hello, <output for="name">World</output>!</p>
</basic-hello>
```

2. Define the component:

```js
import { asString, defineComponent, on, setText } from '@zeix/le-truc'

defineComponent(
  'basic-hello',               // Component name (must contain a hyphen)
  { name: asString('World') }, // Reactive property — parsed from attribute
  q => ({                      // Select DOM elements
    input: q.first('input'),
    output: q.first('output'),
  }),
  ({ host, input }) => ({      // Wire behaviour
    input: on('input', () => { host.name = input.value }),
    output: setText('name'),
  }),
)
```

3. Import the module and watch it work.

`defineComponent` returns a Custom Element class registered via `customElements.define()`. Properties declared in step 2 become reactive: reading them inside an effect tracks the dependency, writing them triggers only the affected DOM updates.

## Documentation

Full documentation with live examples is at **[zeixcom.github.io/le-truc](https://zeixcom.github.io/le-truc)**:

- [Introduction](https://zeixcom.github.io/le-truc/index.html)
- [Getting Started](https://zeixcom.github.io/le-truc/getting-started.html)
- [Components](https://zeixcom.github.io/le-truc/components.html)
- [Styling](https://zeixcom.github.io/le-truc/styling.html)
- [Data Flow](https://zeixcom.github.io/le-truc/data-flow.html)
- [Examples](https://zeixcom.github.io/le-truc/examples.html)
- [API](https://zeixcom.github.io/le-truc/api.html)
- [About](https://zeixcom.github.io/le-truc/about.html)

## Key Features

- 🧱 **HTML-first** — enhances server-rendered markup; no Virtual DOM, no hydration
- 🚦 **Reactive properties** — signals with automatic dependency tracking and fine-grained updates
- ⚡️ **Pinpoint effects** — only the exact DOM nodes that changed are touched
- 🧩 **Composable** — build behaviour from small, reusable parsers and effect functions
- 🌐 **Context support** — share state across components without prop drilling
- 🪶 **Tiny** — ≤10 kB gzipped, tree-shakeable
- 🛡️ **Type-safe** — full TypeScript inference from selector strings to property types

Le Truc uses [Cause & Effect](https://github.com/zeixcom/cause-effect) for its reactive primitives.

## Contributing & License

Contributions, bug reports, and suggestions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

License: [MIT](LICENSE) — © 2026 [Zeix AG](https://zeix.com)
