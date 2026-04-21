### Type Alias: OnEventHandler\<P, Evt, E\>

> **OnEventHandler**\<`P`, `Evt`, `E`\> = (`event`, `element`) => `{ [K in keyof P]?: P[K] }` \| [`Falsy`](Falsy.md) \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:27](https://github.com/zeixcom/le-truc/blob/61224a1a87e995ff3784a4e2a215a09a403e4e85/src/events.ts#L27)

Handler for `on()`. Receives `(event, element)`.

Return `{ prop: value }` to batch-apply updates to host properties (sync only).
Return `Promise<void>` for fire-and-forget side effects — the Promise is not awaited
and its value cannot update host properties.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### Evt

`Evt` *extends* `Event`

##### E

`E` *extends* `Element`

#### Parameters

##### event

`Evt`

##### element

`E`

#### Returns

`{ [K in keyof P]?: P[K] }` \| [`Falsy`](Falsy.md) \| `void` \| `Promise`\<`void`\>
