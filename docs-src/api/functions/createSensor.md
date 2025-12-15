[**le-truc**](../README.md)

***

[le-truc](../globals.md) / createSensor

# Function: createSensor()

> **createSensor**\<`T`, `P`, `U`, `K`\>(`init`, `key`, `events`): (`ui`) => [`Computed`](../type-aliases/Computed.md)\<`T`\>

Defined in: [src/signals/sensor.ts:49](https://github.com/zeixcom/le-truc/blob/e43af8d7276b550a9ea298d116a409ca894b7fd9/src/signals/sensor.ts#L49)

Produce a computed signal from transformed event data

## Type Parameters

### T

`T` *extends* `object`

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

### K

`K` *extends* `string` \| `number` \| `symbol`

## Parameters

### init

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Initial value, reader or parser

### key

`K`

name of UI key

### events

[`SensorEvents`](../type-aliases/SensorEvents.md)\<`T`, `U`, [`ElementFromKey`](../type-aliases/ElementFromKey.md)\<`U`, `K`\>\>

Transformation functions for events

## Returns

Extractor function for value from event

> (`ui`): [`Computed`](../type-aliases/Computed.md)\<`T`\>

### Parameters

#### ui

`U` & `object`

### Returns

[`Computed`](../type-aliases/Computed.md)\<`T`\>

## Since

0.14.0
