[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / EventHandlers

# Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/a6eb6ebcd7352b6a07349eccb67cc61a478cd06f/src/events.ts#L25)

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](UI.md)

### E

`E` *extends* `Element`
