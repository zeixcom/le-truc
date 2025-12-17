[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / SensorEvents

# Type Alias: SensorEvents\<T, U, E\>

> **SensorEvents**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorHandler<T, EventType<K>, U, E> }`

Defined in: [src/signals/sensor.ts:33](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/signals/sensor.ts#L33)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
