### Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/3b85b2090c0536c825d82eb975bbb1c205d93bce/src/events.ts#L25)

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`
