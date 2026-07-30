# Le Truc

**Type-safe reactive Web Components — HTML-first, backend-agnostic**

Le Truc adds a thin reactive layer to HTML that your server renders. Your backend can be Java, PHP, Python, C#, a static site generator, or any tool that outputs HTML. Le Truc connects reactive component properties to specific DOM nodes in the browser and updates only these nodes. It does not re-render whole sections of the page. It does not need JavaScript on the server.

The result is reactivity in the style of SolidJS, packaged as standard Custom Elements: reusable across projects, type-safe, no framework lock-in.

## Why use Le Truc

You often face this choice:

- Imperative JavaScript, which becomes hard to maintain as the code grows
- An SPA framework, which takes control of rendering and needs a JavaScript backend for SSR

Neither choice is good when the backend is a CMS and the initial HTML is already correct.

Le Truc solves one problem: how to add stateful interactivity to a page that the server has already rendered. See [Key features](#key-features) below.

## Installation

```bash
npm install @zeix/le-truc
# or
bun add @zeix/le-truc
```

## Quick start

1. Start with server-rendered HTML:

```html
<basic-hello>
  <label for="name">Your name</label>
  <input id="name" name="name" type="text" autocomplete="given-name" />
  <p>Hello, <output for="name">World</output>!</p>
</basic-hello>
```

2. Define the component:

```js
import { bindText, defineComponent } from '@zeix/le-truc'

defineComponent(
  'basic-hello',                      // component name (must contain a hyphen)
  ({ expose, first, on, watch }) => { // query DOM, declare props, wire up effects
    const input = first('input', 'Needed to enter the name.')
    const output = first('output', 'Needed to display the name.')
    const fallback = output.textContent || ''

    expose({ name: output.textContent ?? '' }) // declare reactive prop

    on(input, 'input', () => ({ name: input.value || fallback }))
    watch('name', bindText(output))
  },
)
```

3. Import the module. The component now works.

`defineComponent` registers the element with `customElements.define()`. `expose()` declares the reactive properties. `watch()` connects a DOM update to a signal; the update runs only when the signal changes. `on()` binds an event listener.

## Key features

- 🧱 **HTML-first** — enhances HTML that the server has already rendered and never re-renders it; no Virtual DOM, no hydration
- 🔌 **Plain Custom Elements** — components work in any host environment
- 🚦 **Reactive properties** — signals track their dependencies automatically
- ⚡️ **Pinpoint effects** — changes only the exact DOM nodes that changed
- 🛡️ **Type-safe** — TypeScript infers types from selector strings through to property types and finds integration errors when you compile the code
- 🧩 **Composable** — build component behavior from small, reusable parser and effect functions
- 🌐 **Context support** — components share state without you passing props through each level
- 🪶 **Small size** — 10 kB or less when compressed with gzip; tree-shakeable

Le Truc uses [Cause & Effect](https://github.com/zeixcom/cause-effect) for its reactive primitives.

## Documentation

Find the full documentation with live examples at **[zeixcom.github.io/le-truc](https://zeixcom.github.io/le-truc)**:

- [Introduction](https://zeixcom.github.io/le-truc/index.html)
- [Getting Started](https://zeixcom.github.io/le-truc/getting-started.html)
- [Components](https://zeixcom.github.io/le-truc/components.html)
- [Styling](https://zeixcom.github.io/le-truc/styling.html)
- [Data Flow](https://zeixcom.github.io/le-truc/data-flow.html)
- [Examples](https://zeixcom.github.io/le-truc/examples.html)
- [API](https://zeixcom.github.io/le-truc/api.html)
- [About](https://zeixcom.github.io/le-truc/about.html)

## Contributing and license

You can contribute code, report bugs, and send suggestions. See [CONTRIBUTING.md](CONTRIBUTING.md) for instructions.

License: [MIT](LICENSE) — © 2026 [Zeix AG](https://zeix.com)
