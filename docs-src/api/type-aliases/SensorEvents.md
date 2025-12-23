[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SensorEvents

# Type Alias: SensorEvents\<T, U, E\>

> **SensorEvents**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorHandler<T, EventType<K>, U, E> }`

Defined in: [src/signals/sensor.ts:33](https://github.com/zeixcom/le-truc/blob/97c33707458c1ba34fa25436c665f488718b79cf/src/signals/sensor.ts#L33)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
