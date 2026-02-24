### Function: on()

> **on**\<`K`, `P`, `E`\>(`type`, `handler`, `options?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/event.ts:55](https://github.com/zeixcom/le-truc/blob/c76fdd788c0b9a613a5dd883bb02ba2aa0c3b1ba/src/effects/event.ts#L55)

Effect for attaching an event listener to a UI element.

The handler receives the DOM event. Two return modes are valid:
- Return `void` for side-effect-only handlers (always correct).
- Return `{ prop: value }` as a shortcut for `batch(() => { host.prop = value })`.
  All returned entries are applied to the host in a single `batch()`.

For passive events (scroll, resize, touch, wheel), execution is deferred
via `schedule()` to avoid blocking the main thread.

Returns a cleanup function that removes the listener when the component disconnects.

#### Type Parameters

##### K

`K` *extends* `string`

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element` = `HTMLElement`

#### Parameters

##### type

`K`

Event type (e.g. `'click'`, `'input'`)

##### handler

[`EventHandler`](../type-aliases/EventHandler.md)\<`P`, [`EventType`](../type-aliases/EventType.md)\<`K`\>\>

Handler receiving the event

##### options?

`AddEventListenerOptions` = `{}`

Listener options; `passive` is set automatically for high-frequency events

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect that attaches the listener and returns a cleanup function

#### Since

0.14.0

#### Examples

```ts
on('click', () => { analytics.track('button-clicked') })
```

```ts
// Equivalent to: on('click', () => { host.count += 1 })
on('click', () => ({ count: host.count + 1 }))
```
