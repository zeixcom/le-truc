### Type Alias: EventHandler()\<P, Evt\>

> **EventHandler**\<`P`, `Evt`\> = (`event`) => `{ [K in keyof P]?: P[K] }` \| `void` \| `Promise`\<`void`\>

Defined in: [src/effects/event.ts:10](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/effects/event.ts#L10)

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
