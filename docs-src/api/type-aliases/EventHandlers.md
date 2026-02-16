[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / EventHandlers

# Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/9067b0df4b01434796accabfb262c9896f05f14f/src/events.ts#L25)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
