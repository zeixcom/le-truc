### Function: createEventsSensor()

> **createEventsSensor**\<`T`, `P`, `U`, `K`\>(`init`, `key`, `events`): (`ui`) => [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: [src/events.ts:41](https://github.com/zeixcom/le-truc/blob/b2bd37a6fe13095f4a2fd459382f54953f446e56/src/events.ts#L41)

Produce an event-driven sensor from transformed event data

#### Type Parameters

##### T

`T` *extends* `object`

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### init

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Initial value, reader or parser

##### key

`K`

name of UI key

##### events

[`EventHandlers`](../type-aliases/EventHandlers.md)\<`T`, `U`, [`ElementFromKey`](../type-aliases/ElementFromKey.md)\<`U`, `K`\>\>

Transformation functions for events

#### Returns

Extractor function for value from event

> (`ui`): [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

##### Parameters

###### ui

`U` & `object`

##### Returns

[`Sensor`](../type-aliases/Sensor.md)\<`T`\>

#### Since

0.16.0
