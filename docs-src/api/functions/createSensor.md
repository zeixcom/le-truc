[**le-truc**](../README.md)

***

[le-truc](../globals.md) / createSensor

# Function: createSensor()

> **createSensor**\<`T`, `P`, `U`, `K`\>(`init`, `key`, `events`): (`ui`) => [`Computed`](../type-aliases/Computed.md)\<`T`\>

Defined in: [src/signals/sensor.ts:49](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/sensor.ts#L49)

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

`ParserOrFallback`\<`T`, `U`\>

Initial value, reader or parser

### key

`K`

name of UI key

### events

`SensorEvents`\<`T`, `U`, `ElementFromKey`\<`U`, `K`\>\>

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
