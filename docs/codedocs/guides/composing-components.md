---
title: "Composing Components"
description: "Wire parent state into children and share ambient state across nested components."
---

This guide combines Le Truc’s two composition tools: direct prop wiring with `pass()` and ambient state sharing with typed context. The result is a realistic pattern for content-heavy sites: a responsive shell provides media preferences, while a parent widget pushes an explicit value into one or more child components.

## Problem

You have a dashboard card that shows a number in several places. The card should:

- share one `count` source with multiple `basic-number` descendants,
- expose the current color theme to deeply nested consumers,
- and keep all rendering in the DOM the server already produced.

## Solution

Use one provider component for context and one parent component for direct prop passing.

<Steps>
<Step>
### Provide ambient theme context

```ts
import { type Context, createSensor, defineComponent } from '@zeix/le-truc'

export const THEME_CONTEXT = 'theme' as Context<'theme', () => 'light' | 'dark'>

type ThemeProviderProps = {
  theme: 'light' | 'dark'
}

defineComponent<ThemeProviderProps>('theme-provider', ({ expose, provideContexts }) => {
  expose({
    theme: createSensor<'light' | 'dark'>(set => {
      const media = matchMedia('(prefers-color-scheme: dark)')
      const sync = () => set(media.matches ? 'dark' : 'light')
      media.addEventListener('change', sync)
      sync()
      return () => media.removeEventListener('change', sync)
    }),
  })

  return [provideContexts(['theme'])]
})
```

</Step>
<Step>
### Pass an explicit value into child components

```ts
import { bindText, defineComponent } from '@zeix/le-truc'

type StatsCardProps = {
  count: number
}

defineComponent<StatsCardProps>('stats-card', ({ expose, first, all, on, pass, watch }) => {
  const increment = first('button', 'Needed to increment the count.')
  const total = first('.total', 'Needed to mirror the current count.')
  const numbers = all('basic-number')

  expose({ count: 0 })

  return [
    on(increment, 'click', (_, button) => ({ count: Number(button.dataset.next ?? 1) })),
    watch('count', bindText(total)),
    pass(numbers, { value: 'count' }),
  ]
})
```

</Step>
<Step>
### Consume theme context in a nested child

```ts
import { bindText, defineComponent } from '@zeix/le-truc'
import { THEME_CONTEXT } from './theme-provider'

type ThemeBadgeProps = {
  theme: 'light' | 'dark'
}

defineComponent<ThemeBadgeProps>('theme-badge', ({ expose, first, requestContext, watch }) => {
  const output = first('.theme-name', 'Needed to render the theme.')

  expose({
    theme: requestContext(THEME_CONTEXT, 'light'),
  })

  return [watch('theme', bindText(output))]
})
```

</Step>
<Step>
### Put it together in HTML

```html
<theme-provider>
  <stats-card>
    <button type="button" data-next="12">Set total to 12</button>
    <p>Total: <span class="total">0</span></p>
    <basic-number value="0"></basic-number>
    <basic-number value="0"></basic-number>
    <theme-badge>
      <span class="theme-name">light</span>
    </theme-badge>
  </stats-card>
</theme-provider>
```

</Step>
</Steps>

## Why This Split Matters

The provider and the parent card solve different composition needs. `pass()` is ideal when the parent explicitly owns a descendant input, exactly like the `value` property in [`examples/test/pass/test-pass.ts`](../../../../le-truc/examples/test/pass/test-pass.ts). Context is better when a nested consumer should not care how many wrappers sit between it and the provider, which is the same idea used by [`examples/context/media/context-media.ts`](../../../../le-truc/examples/context/media/context-media.ts).

Internally, `pass()` works by replacing a child slot’s backing signal and restoring the previous one during cleanup, while `requestContext()` dispatches a `ContextRequestEvent` and turns the provider’s getter into a memo. Those are complementary rather than competing features.

## Result

You get a component tree that behaves like a modern reactive UI but still starts from static HTML, works with ordinary custom elements, and keeps your server rendering strategy unchanged.
