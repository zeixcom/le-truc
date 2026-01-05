[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createSensor

# Function: createSensor()

> **createSensor**\<`T`, `P`, `U`, `K`\>(`init`, `key`, `events`): (`ui`) => [`Computed`](../type-aliases/Computed.md)\<`T`\>

Defined in: [src/signals/sensor.ts:164](https://github.com/zeixcom/le-truc/blob/f3b75cd20fa8d2a4f346b020bc9e35faa4881fd2/src/signals/sensor.ts#L164)

Create a computed signal from transformed event data

## Type Parameters

### T

`T` *extends* `object`

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

### K

`K` *extends* `string`

## Parameters

### init

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Initial value, reader or parser

### key

`K`

Name of UI key

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
