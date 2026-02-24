# Le Truc

Version 0.16.2

**Le Truc - the thing for type-safe reactive Web Components**

Le Truc helps you create reusable, interactive Web Components that work with any backend or static site generator. Build once, use everywhere.

Le Truc is a set of functions to build reusable, loosely coupled Web Components with reactive properties. It provides structure through components and simplifies state management and DOM synchronization using signals and effects, leading to more organized and maintainable code without a steep learning curve.

Unlike SPA frameworks (React, Vue, Svelte, etc.) Le Truc takes a HTML-first approach, progressively enhancing server-rendered HTML rather than recreating (rendering) it using JavaScript. Le Truc achieves the same result as SPA frameworks with SSR, with a simpler, more efficient approach.

## Quick Start

Add interactivity to your HTML in three steps:

1. Start with HTML:

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
  'basic-hello',               // 1. Component name
  { name: asString('World') }, // 2. Reactive property
  q => ({                      // 3. Find DOM elements
    input: q.first('input'),
    output: q.first('output'),
  }),
  ({ host, input }) => ({      // 4. Define behavior
    input: on('input', () => { host.name = input.value }),
    output: setText('name'),
  }),
)
```

3. Import and watch it work!

## Key Features

- 🧱 **HTML Web Components**: Build on standard HTML and enhance it with reusable Web Components. No Virtual DOM – Le Truc works directly with the real DOM.
- 🚦 **Reactive Properties**: Get and set values like with normal element properties, but they automatically track reads and notify on changes (signals).
- ⚡️ **Fine-grained Effects**: Pinpoint updates to the parts of the DOM that need updating, avoiding unnecessary re-renders.
- 🧩 **Function Composition**: Declare component behavior by composing small, reusable functions (parsers and effects).
- 🛠️ **Customizable**: Le Truc is designed to be easily customizable and extensible. Create your own custom parsers and effects to suit your specific needs.
- 🌐 **Context Support**: Share global states across components without prop drilling or tightly coupling logic.
- 🪶 **Tiny footprint**: Minimal core (~10kB gzipped) with tree-shaking support, minimizing JavaScript bundle size.
- 🛡️ **Type Safety**: Early warnings when types don't match improve code quality and reduce bugs.

Le Truc uses [Cause & Effect](https://github.com/zeixcom/cause-effect) internally for state management with signals and glitch-free DOM updates. If wanted, you could fork Le Truc and replace Cause & Effect with a different state management library without changes to the user-facing `defineComponent()` API.

## Installation

```bash
# with npm
npm install @zeix/le-truc

# or with bun
bun add @zeix/le-truc
```

## Documentation

The full documentation is still work in progress. The following chapters are already reasonably complete:

- [Introduction](https://zeixcom.github.io/le-truc/index.html)
- [Getting Started](https://zeixcom.github.io/le-truc/getting-started.html)
- [Components](https://zeixcom.github.io/le-truc/components.html)
- [Styling](https://zeixcom.github.io/le-truc/styling.html)
- [Data Flow](https://zeixcom.github.io/le-truc/data-flow.html)
- [About](https://zeixcom.github.io/le-truc/about.html)

## Basic Usage

1. Start with HTML:

```html
<basic-counter>
  <button type="button">💐 <span>5</span></button>
</basic-counter>
```

2. Define the component:

```js
import { asInteger, defineComponent, on, read, setText } from '@zeix/le-truc'

export default defineComponent(
  // 1. Component name
  'basic-counter',

  // 2. Reactive properties (signals)
  {
    // Count property is read from the DOM (ui.count) and converted to an integer
    count: read(ui => ui.count.textContent, asInteger()),
  },

  // 3. Find DOM elements
  ({ first }) => ({
    // first() returns the first element matching the selector
    increment: first(
      'button',
      'Add a native button element to increment the count.',
    ),
    count: first('span', 'Add a span to display the count.'),
  }),

  // 4. Define behavior (effects)
  ({ host }) => ({ // host is the component element with reactive properties
    // Add a click event listener to the increment button
    increment: on('click', () => {
      host.count++
    }),
    // Set the text of the count element to the count property whenever it changes
    count: setText('count'),
  }),
)
```

Example styles:

```css
basic-counter {
  & button {
    border: 1px solid var(--color-border);
    border-radius: var(--space-xs);
    background-color: var(--color-secondary);
    padding: var(--space-xs) var(--space-s);
    cursor: pointer;
    color: var(--color-text);
    font-size: var(--font-size-m);
    line-height: var(--line-height-xs);
    transition: background-color var(--transition-short) var(--easing-inout);

    &:hover {
      background-color: var(--color-secondary-hover);
    }

    &:active {
      background-color: var(--color-secondary-active);
    }
  }
}
```

3. Import and watch it work!

## Advanced Examples

### Tab Group

An example demonstrating how to create a fully accessible tab navigation.

Server-rendered markup:

```html
<module-tabgroup>
  <div role="tablist">
    <button
      type="button"
      role="tab"
      id="trigger1"
      aria-controls="panel1"
      aria-selected="true"
      tabindex="0"
    >
      Tab 1
    </button>
    <button
      type="button"
      role="tab"
      id="trigger2"
      aria-controls="panel2"
      aria-selected="false"
      tabindex="-1"
    >
      Tab 2
    </button>
    <button
      type="button"
      role="tab"
      id="trigger3"
      aria-controls="panel3"
      aria-selected="false"
      tabindex="-1"
    >
      Tab 3
    </button>
  </div>
  <div role="tabpanel" id="panel1" aria-labelledby="trigger1">
    Tab 1 content
  </div>
  <div role="tabpanel" id="panel2" aria-labelledby="trigger2" hidden>
    Tab 2 content
  </div>
  <div role="tabpanel" id="panel3" aria-labelledby="trigger3" hidden>
    Tab 3 content
  </div>
</module-tabgroup>
```

Le Truc component:

```js
import { createEventsSensor, defineComponent, read, setProperty, show } from '@zeix/le-truc'

const getAriaControls = element => element.getAttribute('aria-controls') ?? ''

const getSelected = (tabs, isCurrent, offset = 0) => {
  const currentIndex = tabs.findIndex(isCurrent)
  const newIndex = (currentIndex + offset + tabs.length) % tabs.length
  return getAriaControls(tabs[newIndex])
}

export default defineComponent(
  // 1. Component name
  'module-tabgroup',

  // 2. Reactive properties (signals)
  {
    // Sensors are read-only signals that update on user interaction only (events)
    selected: createEventsSensor(
      // Initial value from aria-selected attribute
      read(ui => getSelected(ui.tabs.get(), tab => tab.ariaSelected === 'true'), ''),
      // Target element(s) key
      'tabs',
      // Event handlers return a value to update the signal
      {
        click: ({ target }) => getAriaControls(target),
        keyup: ({ event, ui, target }) => {
          const key = event.key
          if (
            [
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
            ].includes(key)
          ) {
            event.preventDefault()
            event.stopPropagation()
            const tabs = ui.tabs.get()
            const next =
              key === 'Home'
                ? getAriaControls(tabs[0])
                : key === 'End'
                  ? getAriaControls(tabs[tabs.length - 1])
                  : getSelected(
                      tabs,
                      tab => tab === target,
                      key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1,
                    )
            tabs.filter(tab => getAriaControls(tab) === next)[0].focus()
            return next
          }
        },
      },
    ),
  },

  // 3. Find DOM elements
  ({ all }) => ({
    // all() returns a Memo<E[]> that holds all elements matching the selector,
    // dynamically updating when the DOM changes via MutationObserver
    tabs: all(
      'button[role="tab"]',
      'At least 2 tabs as children of a <[role="tablist"]> element are needed. Each tab must reference a unique id of a <[role="tabpanel"]> element.',
    ),
    panels: all(
      '[role="tabpanel"]',
      'At least 2 tabpanels are needed. Each tabpanel must have a unique id.',
    ),
  }),

  // 4. Define behavior (effects)
  ({ host }) => {
    // Extracted function to check if a tab is the current selected tab
    const isCurrentTab = tab => host.selected === getAriaControls(tab)

    return {
      // Set properties on tabs based on their selection status
      tabs: [
        setProperty('ariaSelected', target => String(isCurrentTab(target))),
        setProperty('tabIndex', target => (isCurrentTab(target) ? 0 : -1)),
      ],
      // Toggle visibility of panels based on the selected tab
      panels: show(target => host.selected === target.id),
    }
  },
)
```

Example styles:

```css
module-tabgroup {
  display: block;
  margin-bottom: var(--space-l);

  > [role="tablist"] {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    padding: 0;
    margin-bottom: 0;

    > [role="tab"] {
      border: 0;
      border-top: 2px solid transparent;
      border-bottom-width: 0;
      border-radius: var(--space-xs) var(--space-xs) 0 0;
      font-family: var(--font-family-sans);
      font-size: var(--font-size-s);
      font-weight: var(--font-weight-bold);
      padding: var(--space-s) var(--space-m);
      color: var(--color-text-soft);
      background-color: var(--color-secondary);
      cursor: pointer;
      transition: all var(--transition-short) var(--easing-inout);

      &:hover,
      &:focus {
        color: var(--color-text);
        background-color: var(--color-secondary-hover);
      }

      &:focus {
        z-index: 1;
      }

      &:active {
        color: var(--color-text);
        background-color: var(--color-secondary-active);
      }

      &[aria-selected="true"] {
        color: var(--color-primary-active);
        border-top: 3px solid var(--color-primary);
        background-color: var(--color-background);
        margin-bottom: -1px;
      }
    }
  }

  > [role="tabpanel"] {
    font-family: sans-serif;
    font-size: var(--font-size-m);
    background: var(--color-background);
    margin-block: var(--space-l);
  }
}
```

### Lazy Load

An example demonstrating how to use a custom attribute parser (sanitize an URL) and a signal producer (async fetch) to implement lazy loading.

```html
<module-lazyload src="/module-lazyload/snippet.html">
  <card-callout>
    <p class="loading" role="status">Loading...</p>
    <p class="error" role="alert" aria-live="assertive" hidden></p>
  </card-callout>
  <div class="content" hidden></div>
</module-lazyload>
```

Le Truc component:

```js
import {
  asString,
  type Component,
  createTask,
  dangerouslySetInnerHTML,
  defineComponent,
  setText,
  show,
  toggleClass,
} from '@zeix/le-truc'

export default defineComponent(
  // 1. Component name
  'module-lazyload',

  // 2. Reactive properties (signals)
  {
    src: asString(),
  },

  // 3. Find DOM elements
  ({ first }) => ({
    callout: first(
      'card-callout',
      'Needed to display loading state and error messages.',
    ),
    loading: first('.loading', 'Needed to display loading state.'),
    error: first('.error', 'Needed to display error messages.'),
    content: first('.content', 'Needed to display content.'),
  }),

  // 4. Define behavior (effects)
  ui => {
    const { host } = ui

    // Private async task signal to fetch content from the provided URL
    const result = createTask(
      async (_prev, abort) => {
        const url = host.src
        const error = !url
          ? 'No URL provided'
          : !isValidURL(url)
            ? 'Invalid URL'
            : isRecursiveURL(url, host)
              ? 'Recursive URL detected'
              : ''
        if (error) return { ok: false, value: '', error, pending: false }

        try {
          const response = await fetch(url, abort)
          if (!response.ok) throw new Error(`HTTP error: ${response.statusText}`)
          const content = await response.text()
          return { ok: true, value: content, error: '', pending: false }
        } catch (error) {
          return {
            ok: false,
            value: '',
            error: `Failed to fetch content for "${url}": ${String(error)}`,
            pending: false,
          }
        }
      },
      // Initial value of the signal before the Promise is resolved
      { value: { ok: false, value: '', error: '', pending: true } },
    )

    // Extracted function to check if an error occurred
    const hasError = () => !!result.get().error

    return {
      callout: [show(() => !result.get().ok), toggleClass('danger', hasError)],
      loading: show(() => !!result.get().pending),
      error: [show(hasError), setText(() => result.get().error ?? '')],
      content: [
        show(() => result.get().ok),
        // Set inner HTML to the fetched content (use only for trusted sources)
        dangerouslySetInnerHTML(() => result.get().value ?? '', {
          allowScripts: host.hasAttribute('allow-scripts'),
        }),
      ],
    }
  },
)
```

## Testing

Le Truc components come with comprehensive Playwright tests to ensure reliability and compatibility across browsers.

### Running All Tests

```bash
# Run all component tests
bun run test

# Run all tests with specific options
bunx playwright test examples --headed --reporter=html
```

### Running Individual Component Tests

For faster development and debugging, you can run tests for specific components:

```bash
# Run tests for a single component
bun run test:component module-carousel
bun run test:component basic-hello
bun run test:component form-combobox

# Run with Playwright options
bun run test:component module-carousel --headed --debug
bun run test:component basic-hello -- --reporter=html

# See all available components
bun run test:component --help
```

### Test Structure

Each component has its own test file following the pattern:
- `examples/[component-name]/[component-name].spec.ts`
- Tests cover functionality, accessibility, and edge cases
- Tests run against actual component implementations in browsers

### Development Server for Testing

The test runner uses a specialized server that:
- Builds examples automatically before testing
- Disables HMR for test stability (via `PLAYWRIGHT=1`)
- Serves component test pages at `/test/[component-name]`

## Contributing & License

Feel free to contribute, report issues, or suggest improvements.

License: [MIT](LICENSE)

(c) 2026 [Zeix AG](https://zeix.com)
