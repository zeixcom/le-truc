# Claude AI Context — Le Truc

**Le Truc** is a modern TypeScript library for building reactive custom elements (web components) with a signal-based reactive system. It provides a declarative approach to component development with automatic dependency management, type safety, and minimal runtime overhead.

## Library Overview and Philosophy

### Core Philosophy

Le Truc embraces the web platform's native custom elements API while providing modern developer ergonomics through:

- **Reactive by Default**: Built on the `@zeix/cause-effect` signal system for fine-grained reactivity
- **Type-First Design**: Full TypeScript support with compile-time safety for component properties and DOM queries
- **Zero Dependencies**: Self-contained runtime with minimal overhead
- **Web Standards Compliant**: Uses native custom elements, no virtual DOM or proprietary abstractions
- **Progressive Enhancement**: Components work with or without JavaScript, gracefully degrading

### Mental Model

Think of Le Truc components as **reactive shells around DOM elements**:

1. **Define** the component with properties, UI selectors, and effects
2. **Properties** are signals that automatically sync with attributes
3. **UI selectors** find and track DOM elements within the component
4. **Effects** run when signals change, updating the DOM reactively

```typescript
// Mental model: Property → Signal → Effect → DOM Update
defineComponent(
  'my-widget',                        // Must contain hyphen, lowercase
  { count: 0 },                       // Properties become signals
  q => ({ btn: q.first('button') }),  // UI elements are queried once
  ui => ({ btn: [on('click', ...)] }) // Effects run reactively
)
```

### Key Differentiators

**vs React/Vue**: No virtual DOM, uses native web platform APIs
**vs Lit**: Signal-based reactivity instead of property-driven re-renders
**vs Angular Elements**: Lighter weight, functional composition over class inheritance
**vs Stencil**: Runtime reactivity instead of compile-time optimizations

## Architectural Deep Dive

### Signal-Based Reactivity

The foundation is `@zeix/cause-effect`, providing:

- **Signals**: `createState(value)` - mutable reactive values
- **Computed**: `createComputed(() => ...)` - derived reactive values
- **Effects**: `createEffect(() => ...)` - side effects that run when dependencies change
- **Batching**: `batch(() => ...)` - group multiple signal updates

```typescript
// Core reactivity pattern
const count = createState(0)
const doubled = createComputed(() => count.get() * 2)
const cleanup = createEffect(() => {
  console.log(`Count: ${count.get()}, Doubled: ${doubled.get()}`)
})
```

### Component Lifecycle

1. **Registration**: `customElements.define()` registers the component class
2. **Connection**: `connectedCallback()` initializes UI queries and properties
3. **Dependency Resolution**: Waits for child custom elements to be defined
4. **Effect Setup**: Runs the setup function to attach reactive effects
5. **Reactive Updates**: Effects run automatically when signals change
6. **Disconnection**: `disconnectedCallback()` cleans up effects and listeners

### Property System

Properties are the bridge between HTML attributes and JavaScript signals:

```typescript
defineComponent('my-widget', {
  // Static value
  message: 'Hello',

  // Signal
  count: createState(0),

  // Parser (attribute → property)
  config: asJSON({ theme: 'light' }), // with default value

  // Initializer function
  timestamp: ui => ui.host.hasAttribute('created')
    ? Number(ui.host.getAttribute('created'))
    : Date.now(),

  // Reader (DOM → property)
  value: read(ui => ui.input.value, asInteger())
})
```

**Parser Functions** transform attribute strings into typed values:
- `asString()`, `asNumber()`, `asInteger()`, `asBoolean()`, `asJSON()`
- Custom parsers: `(ui, value, oldValue) => parsedValue`
- Auto-added to `observedAttributes` for efficient attribute watching

### UI Query System

The `getHelpers()` function provides type-safe DOM queries with dependency tracking:

```typescript
const select = ({ first, all }) => ({
  // Single element with type inference
  button?: first('button'),             // HTMLButtonElement | undefined
  input?: first('input[type="text"]'),  // HTMLInputElement | undefined

  // Element collections
  items: all('.item'),                  // Collection<HTMLElement>

  // Required elements (throws if missing)
  form: first('form', 'Form is required'),

  // Generic typing
  customEl?: first<MyCustomElement>('my-custom')
})
```

**Dependency Detection**: Custom elements found in queries are automatically added to dependencies, ensuring they're defined before effects run.

**Collection Signals**: `Collection<E>` provides reactive arrays of elements:
- Implements iterator protocol and array-like indexing
- Emits `add`/`remove` notifications for fine-grained change handling
- Automatically tracks DOM mutations

### Effect System

Effects are functions that run reactively and return cleanup functions:

```typescript
const effects = {
  button: [
    // Event handling
    on('click', ({ host }) => ({ count: host.count + 1 })),

    // Property updates from reactive values
    setProperty('disabled', 'loading'),

    // Attribute management using functions or reactive values
    setAttribute('aria-pressed', () => String(host.active)),
    toggleAttribute('loading'), // 'loading' for value may be omitted if the same

    // Class management
    toggleClass('active'),

    // Text content
    setText('count'),

    // Custom effects
    (host, target) => createEffect(() => {
      target.style.color = host.color
      return () => target.style.color = 'transparent'
    })
  ]
}
```

**Built-in Effects**:
- `on(event, handler)` - Event listeners with reactive property updates
- `setText(property)` - Reactive text content
- `setProperty(prop, reactive)` - Element property updates
- `setAttribute(attr, reactive)` - Attribute management
- `toggleClass(class, property)` - Conditional CSS classes
- `setStyle(prop, reactive)` - Inline style updates
- `emit(event, reactive)` - Custom event emission

### Parser Architecture

Parsers handle the attribute ↔ property transformation:

```typescript
// Parser signature
type Parser<T, U extends UI> = (
  ui: U,                           // Access to component UI
  value: string | null | undefined, // Attribute value
  old?: string | null              // Previous value
) => T

// Example: JSON parser
const asJSON = <T>(fallback?: T) =>
  (ui: UI, value: string | null): T => {
    if (!value) return fallback
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
```

**Parser Integration**:
- Used as property initializers: `{ config: asJSON({ theme: 'light' }) }`
- Automatically added to `observedAttributes`
- Called on `attributeChangedCallback`
- Can access component UI for contextual parsing

### Error Handling & Debugging

**Development Mode**: Set `process.env.DEV_MODE=true` for enhanced debugging:
- Detailed error messages with component context
- Effect execution logging
- Dependency resolution warnings

**Error Types**:
- `InvalidComponentNameError` - Component name validation
- `InvalidPropertyNameError` - Property name conflicts
- `MissingElementError` - Required UI elements not found
- `DependencyTimeoutError` - Custom element dependencies timeout
- `InvalidEffectsError` - Effect setup failures

**Debug Mode**: Set `host.debug = true` on component instances for verbose logging.

## Advanced Patterns and Best Practices

### Component Composition

**Child Component Communication**:
```typescript
// Parent passes data via attributes
defineComponent('parent-widget', {},
  q => ({ child: q.first('child-widget') }),
  ui => ({
    child: [
      setProperty('data', () => ui.host.processedData),
      on('change', ({ event }) => ({
        result: event.detail
      }))
    ]
  })
)

// Child emits events upward
defineComponent('child-widget', { data: asJSON() },
  q => ({ button: q.first('button') }),
  ui => ({
    button: [
      on('click', () => ({ })),
      emit('change', () => ui.host.data)
    ]
  })
)
```

**Slots and Content Projection**:
```typescript
// Use standard slot elements
defineComponent('modal-dialog', {},
  q => ({
    header: q.first('slot[name="header"]'),
    content: q.first('slot:not([name])'),
    footer: q.first('slot[name="footer"]')
  }),
  ui => ({
    header: [toggleClass('hidden', () => !ui.header.assignedNodes().length)]
  })
)
```

### State Management Patterns

**Local State**:
```typescript
defineComponent('todo-list', {
  items: asJSON([])
}, q => ({ ... }), ui => {
  // Derived computed values
  const completed = createComputed(() =>
    ui.host.items.filter(item => item.done).length
  )

  return {
    counter: [setText(() => `${completed.get()} completed`)]
  }
})
```

**Global State Integration**:
```typescript
// External store
const globalStore = createStore({ user: null, theme: 'light' })

defineComponent('user-avatar', {},
  q => ({ img: q.first('img') }),
  ui => ({
    img: [
      setAttribute('src', () => globalStore.user?.avatar),
      setAttribute('alt', () => globalStore.user?.name)
    ]
  })
)
```

### Form Handling

**Two-Way Data Binding**:
```typescript
defineComponent('form-input', {
  value: asString(),
  required: asBoolean()
}, q => ({ input: q.first('input') }), ui => ({
  input: [
    // Property → DOM
    setProperty('value'),
    setProperty('required'),

    // DOM → Property
    on('input', ({ target }) => ({
      value: target.value
    })),

    // Validation
    on('blur', ({ target, host }) => {
      const valid = !host.required || target.value.length > 0
      return { valid }
    })
  ]
}))
```

**Form Validation**:
```typescript
const validator = createComputed(() => {
  const errors = []
  if (!ui.host.email.includes('@')) errors.push('Invalid email')
  if (ui.host.password.length < 8) errors.push('Password too short')
  return errors
})

return {
  form: [
    setAttribute('novalidate', true),
    on('submit', ({ event, host }) => {
      event.preventDefault()
      const errors = validator.get()
      if (errors.length) {
        return { errors }
      }
      // Submit form
    })
  ]
}
```

### Performance Optimization

**Lazy Loading Components**:
```typescript
// Conditional registration
if (window.IntersectionObserver) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        import('./heavy-component').then(module => {
          module.default // Auto-registers component
        })
        observer.unobserve(entry.target)
      }
    })
  })

  document.querySelectorAll('.lazy-component').forEach(el => {
    observer.observe(el)
  })
}
```

**Memory Management**:
```typescript
// Proper cleanup in effects
ui => ({
  element: [
    (host, target) => createEffect(() => {
      const controller = new AbortController()

      fetch('/api/data', { signal: controller.signal })
        .then(data => { /* handle data */ })

      return () => controller.abort() // Cleanup
    })
  ]
})
```

**Batch Updates**:
```typescript
// Group related updates
on('complexOperation', ({ host }) => ({
  loading: true,
  error: null,
  data: processComplexData(host.rawData)
}))
```

### Testing Strategies

**Unit Testing**:
```typescript
import { defineComponent } from '@zeix/le-truc'
import { test, expect } from '@playwright/test'

test('counter increments', async ({ page }) => {
  await page.setContent(`
    <basic-counter>
      <button>+</button>
      <span>0</span>
    </basic-counter>
  `)

  await page.click('button')
  const count = await page.textContent('span')
  expect(count).toBe('1')
})
```

**Property Testing**:
```typescript
test('properties sync with attributes', async ({ page }) => {
  await page.setContent('<my-component count="5"></my-component>')

  const count = await page.evaluate(() => {
    const el = document.querySelector('my-component')
    return el.count
  })

  expect(count).toBe(5)
})
```

## Integration Patterns

### Framework Integration

**React Integration**:
```tsx
import { useRef, useEffect } from 'react'

function MyReactComponent({ data }) {
  const ref = useRef()

  useEffect(() => {
    if (ref.current) {
      ref.current.data = data
    }
  }, [data])

  return <my-custom-element ref={ref} />
}
```

**Vue Integration**:
```vue
<template>
  <my-custom-element
    ref="customEl"
    :data="reactiveData"
    @change="handleChange"
  />
</template>

<script setup>
import { ref, watch } from 'vue'

const customEl = ref()
const reactiveData = ref({})

watch(reactiveData, (newData) => {
  if (customEl.value) {
    customEl.value.data = newData
  }
}, { deep: true })
</script>
```

### Build System Integration

**Vite Configuration**:
```typescript
// vite.config.ts
export default {
  define: {
    'process.env.DEV_MODE': JSON.stringify(process.env.NODE_ENV === 'development')
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs']
    }
  }
}
```

**Webpack Configuration**:
```javascript
module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.DEV_MODE': JSON.stringify(process.env.NODE_ENV === 'development')
    })
  ]
}
```

### SSR and Hydration

**Server-Side Rendering**:
```typescript
// Server component
export function renderMyComponent(props) {
  return `
    <my-component ${Object.entries(props).map(([k, v]) =>
      `${k}="${typeof v === 'string' ? v : JSON.stringify(v)}"`
    ).join(' ')}>
      <!-- Static content -->
    </my-component>
  `
}

// Client hydration
import './my-component' // Registers component

// Component automatically hydrates when script loads
```

**Progressive Enhancement**:
```html
<!-- Works without JavaScript -->
<form-validator>
  <form>
    <input type="email" required>
    <button>Submit</button>
  </form>
  <div class="errors" hidden></div>
</form-validator>

<!-- Enhanced with JavaScript -->
<script>
  // Component adds real-time validation
  // but form still works natively
</script>
```

### Styling Strategies

**CSS Custom Properties**:
```css
my-component {
  --primary-color: #007bff;
  --spacing: 1rem;

  button {
    background: var(--primary-color);
    padding: var(--spacing);
  }
}
```

**CSS-in-JS Integration**:
```typescript
import { css } from 'your-css-lib'

defineComponent('styled-button', {
  variant: asEnum(['primary', 'secondary'])
}, q => ({ button: q.first('button') }), ui => ({
  button: [
    setStyle('cssText', () => css`
      background: ${ui.host.variant === 'primary' ? 'blue' : 'gray'};
      padding: 0.5rem 1rem;
    `)
  ]
}))
```

### Accessibility Integration

**ARIA Patterns**:
```typescript
defineComponent('accordion-item', {
  expanded: asBoolean()
}, q => ({
  button: q.first('[role="button"]'),
  panel: q.first('[role="region"]')
}), ui => ({
  button: [
    setAttribute('aria-expanded', () => String(ui.host.expanded)),
    setAttribute('aria-controls', () => ui.panel.id),
    on('click', () => ({ expanded: !ui.host.expanded }))
  ],
  panel: [
    setAttribute('aria-labelledby', () => ui.button.id),
    setAttribute('hidden', () => ui.host.expanded ? null : '')
  ]
}))
```

This comprehensive context should provide you with everything needed to understand and work effectively with the Le Truc library. The signal-based reactive system combined with type-safe DOM queries and effect management creates a powerful foundation for building modern, performant web components.
