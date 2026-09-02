---
title: 'Context'
emoji: '🌐'
description: 'Shared state across the tree'
---

{% hero %}
# Context

**Share state across the component tree without prop drilling.** A provider publishes typed values. Any descendant consumes them reactively. Provider and consumer never reference each other.
{% /hero %}

{% section %}
## Provide Context

Theme, locale, authentication, motion preference — some values are needed by many components at once, at unknown depth. Threading them through props at every level works, but the intermediate components pay for a value they never use themselves. Context makes the tree itself carry the value: a provider publishes, any descendant subscribes, and the components in between stay out of it.

Use context for application-wide settings like user preferences, theme data, or authentication state. Keep state local when only one component needs it.

### Creating Context Keys

First, define typed context keys for the values you want to share:

```ts#context-media.ts
// Define context keys with types, via createContext()
export const MEDIA_MOTION = createContext<() => 'no-preference' | 'reduce'>(
  'motion',
)
export const MEDIA_THEME = createContext<() => 'light' | 'dark'>('theme')
```

### Provider Component

The **provider component** creates the shared state inside `expose()`. It calls `provideContexts()` in the returned effect array. The example below is a simplified excerpt. It shows two of the four media contexts. See the full source for the complete implementation:

```ts#context-media.ts
import { createContext, createSensor, defineComponent } from '@zeix/le-truc'

export type ContextMediaProps = {
  readonly motion: 'no-preference' | 'reduce'
  readonly theme: 'light' | 'dark'
}

declare global {
  interface HTMLElementTagNameMap {
    'context-media': HTMLElement & ContextMediaProps
  }
}

export default defineComponent<ContextMediaProps>(
  'context-media',
  ({ expose, provideContexts }) => {
    expose({
      motion: createSensor(
        set => {
          const mql = matchMedia('(prefers-reduced-motion: reduce)')
          const listener = (e) => set(e.matches ? 'reduce' : 'no-preference')
          mql.addEventListener('change', listener)
          return () => mql.removeEventListener('change', listener)
        },
        { value: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference' },
      ),
      theme: createSensor(
        set => {
          const mql = matchMedia('(prefers-color-scheme: dark)')
          const listener = (e) => set(e.matches ? 'dark' : 'light')
          mql.addEventListener('change', listener)
          return () => mql.removeEventListener('change', listener)
        },
        { value: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
      ),
    })

    provideContexts(['motion', 'theme'])
  },
)
```

A provider is a stable single source of truth: it updates the *values* it provides. Adding and removing providers at runtime is an anti-pattern — update the value instead.

### Usage in HTML

The provider component wraps your entire application or a section that needs shared state:

```html#index.html
<context-media>
  <!-- Arbitrarily nested HTML with one or many context consumers -->
  <main>
    <card-mediaqueries>
      <dl>
        <dt>Motion Preference:</dt>
         <dd class="motion"></dd>
        <dt>Theme Preference:</dt>
         <dd class="theme"></dd>
      </dl>
    </card-mediaqueries>
  </main>
</context-media>
```

{% /section %}

{% section %}
## Consume Context

**Consumer components** use `requestContext()` to access shared state from ancestor providers. The returned `Signal<T>` is reactive. When the provider's signal updates, all consumers update automatically.

It serves the `fallback` until a provider answers. Even a provider that connects late (bundle ordering, code-splitting) is picked up. The consumer switches from `fallback` to the provided value automatically, without any extra code.

Give the fallback real thought: it is what the consumer shows when no provider exists at all.

### Consumer Component

Here is a simple card that displays the current motion and theme preferences:

```js#card-mediaqueries.js
import { bindText, defineComponent } from '@zeix/le-truc'
import { MEDIA_MOTION, MEDIA_THEME } from '../../context/media/context-media'

export default defineComponent(
  'card-mediaqueries',
  ({ first, requestContext, watch }) => {
    const motionEl = first('.motion')
    const themeEl = first('.theme')

    const motion = requestContext(MEDIA_MOTION, 'unknown')
    const theme = requestContext(MEDIA_THEME, 'unknown')

    if (motionEl) watch(motion, bindText(motionEl))
    if (themeEl) watch(theme, bindText(themeEl))
  },
)
```

### Full Context Example

{% demo %}
```html
<context-media>
  <card-mediaqueries>
    <dl>
      <dt>Motion Preference:</dt>
      <dd class="motion"></dd>
      <dt>Theme Preference:</dt>
      <dd class="theme"></dd>
      <dt>Device Viewport:</dt>
      <dd class="viewport"></dd>
      <dt>Device Orientation:</dt>
      <dd class="orientation"></dd>
    </dl>
  </card-mediaqueries>
</context-media>
```

{% sources title="ContextMedia source code" src="./sources/context-media.html" /%}
{% sources title="CardMediaqueries source code" src="./sources/card-mediaqueries.html" /%}
{% /demo %}

{% /section %}
