[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SensorOptions

# Type Alias: SensorOptions\<T\>

> **SensorOptions**\<`T`\> = [`SignalOptions`](SignalOptions.md)\<`T`\> & `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/sensor.d.ts:24

A callback function for sensors when the sensor starts being watched.

## Type Declaration

### value?

> `optional` **value**: `T`

Optional initial value. Avoids `UnsetSignalValueError` on first read
before the watched callback fires.

## Type Parameters

### T

`T` *extends* `object`

The type of value observed

## Param

A function to set the observed value

## Returns

A cleanup function when the sensor stops being watched
