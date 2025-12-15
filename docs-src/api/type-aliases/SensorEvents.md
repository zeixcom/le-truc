[**le-truc**](../README.md)

***

[le-truc](../globals.md) / SensorEvents

# Type Alias: SensorEvents\<T, U, E\>

> **SensorEvents**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorHandler<T, EventType<K>, U, E> }`

Defined in: [src/signals/sensor.ts:33](https://github.com/zeixcom/le-truc/blob/e43af8d7276b550a9ea298d116a409ca894b7fd9/src/signals/sensor.ts#L33)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
