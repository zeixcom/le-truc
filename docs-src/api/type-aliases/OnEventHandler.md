### Type Alias: OnEventHandler\<P, Evt, E\>

> **OnEventHandler**\<`P`, `Evt`, `E`\> = (`event`, `element`) => `{ [K in keyof P]?: P[K] }` \| [`Falsy`](Falsy.md) \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:27](https://github.com/zeixcom/le-truc/blob/95e5c3ab97d0cd1430adbe5ee92d9bdf2b5d274c/src/events.ts#L27)

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
