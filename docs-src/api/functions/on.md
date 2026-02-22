### Function: on()

> **on**\<`K`, `P`, `E`\>(`type`, `handler`, `options?`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/event.ts:33](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/effects/event.ts#L33)

Effect for attaching an event listener to a UI element.

The handler receives the DOM event and may return a partial property update object
`{ [key: keyof P]: value }`. If it does, all updates are applied to the host in a
`batch()`. For passive events (scroll, resize, touch, wheel), execution is deferred
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

Handler receiving the event; may return `{ prop: value }` to update host properties

##### options?

`AddEventListenerOptions` = `{}`

Listener options; `passive` is set automatically for high-frequency events

#### Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect that attaches the listener and returns a cleanup function

#### Since

0.14.0
