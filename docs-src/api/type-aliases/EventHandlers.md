[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / EventHandlers

# Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/d14510e550dfc154f9f0472e7b8adcdb3ab3002e/src/events.ts#L25)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
