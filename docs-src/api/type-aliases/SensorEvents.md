[**le-truc**](../README.md)

***

[le-truc](../globals.md) / SensorEvents

# Type Alias: SensorEvents\<T, U, E\>

> **SensorEvents**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorHandler<T, EventType<K>, U, E> }`

Defined in: [src/signals/sensor.ts:33](https://github.com/zeixcom/le-truc/blob/3e8d7e7aaa7f4bbc3cb1d68aecab6664ca6352cb/src/signals/sensor.ts#L33)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
