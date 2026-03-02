### Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/2e5d6edefb130ef114c2fecbca197f9c23306fbb/src/events.ts#L25)

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`
