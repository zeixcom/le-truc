### ~~Function: on()~~

> **on**\<`T`, `P`, `E`\>(`type`, `handler`, `options?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/event.ts:50](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/effects/event.ts#L50)

Effect for attaching an event listener to a UI element.

The handler receives the DOM event. Two return modes are valid:
- Return `void` for side-effect-only handlers (always correct).
- Return `{ prop: value }` as a shortcut for `batch(() => { host.prop = value })`.
  All returned entries are applied to the host in a single `batch()`.

For passive events (scroll, resize, touch, wheel), execution is deferred
via `schedule()` to avoid blocking the main thread.

Returns a cleanup function that removes the listener when the component disconnects.

#### Type Parameters

##### T

`T` *extends* `string`

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### E

`E` *extends* `Element` = `HTMLElement`

#### Parameters

##### type

`T`

Event type (e.g. `'click'`, `'input'`)

##### handler

[`EventHandler`](../type-aliases/EventHandler.md)\<`P`, [`EventType`](../type-aliases/EventType.md)\<`T`\>\>

Handler receiving the event

##### options?

`AddEventListenerOptions` = `{}`

Listener options; `passive` is set automatically for high-frequency events

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect that attaches the listener and returns a cleanup function

#### Deprecated

Use the `on(target, type, handler)` helper from `FactoryContext` in the v1.1 factory form instead.
The factory helper returns an `EffectDescriptor` and receives `(event, element)` in its handler.

#### Since

0.14.0
