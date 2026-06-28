### Type Alias: OnEventHandler\<P, Evt, E\>

> **OnEventHandler**\<`P`, `Evt`, `E`\> = (`event`, `element`) => `{ [K in keyof P]?: P[K] }` \| [`Falsy`](Falsy.md) \| `void` \| `Promise`\<`void`\>

Defined in: [src/helpers/events.ts:26](https://github.com/zeixcom/le-truc/blob/b0a312070e75b8c347df329a83469bb95e181c8d/src/helpers/events.ts#L26)

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
