### Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:10](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/effects/event.ts#L10)

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
