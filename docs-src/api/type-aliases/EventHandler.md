### Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:22](https://github.com/zeixcom/le-truc/blob/23167c4de345bf28cd627a58ae4ea4e29243c54c/src/effects/event.ts#L22)

Event handler for use with `on()`.

Two return modes are valid:
- **Side-effect only** — return `void` (or nothing). The component state is
  not automatically updated. This is always safe and is the right choice for
  handlers that call external APIs, dispatch custom events, etc.
- **Property update shortcut** — return a partial `{ [key: keyof P]: value }`
  object. All returned key/value pairs are applied to the host inside a single
  `batch()`, equivalent to writing `batch(() => { host.prop = value })` by hand.
  Use this when the handler's only job is to update one or more host properties.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Evt

`Evt` *extends* `Event`

#### Parameters

##### event

`Evt`

#### Returns

`{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>
