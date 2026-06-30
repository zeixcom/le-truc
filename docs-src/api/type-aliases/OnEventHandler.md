### Type Alias: OnEventHandler\<P, Evt, E\>

> **OnEventHandler**\<`P`, `Evt`, `E`\> = (`event`, `element`) => `{ [K in keyof P]?: P[K] }` \| [`Falsy`](Falsy.md) \| `void` \| `Promise`\<`void`\>

Defined in: [src/helpers/events.ts:26](https://github.com/zeixcom/le-truc/blob/2877d2afe24fa5dcc6cc8851f03777f67a181664/src/helpers/events.ts#L26)

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
