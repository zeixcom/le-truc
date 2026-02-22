### Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/events.ts#L25)

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`
