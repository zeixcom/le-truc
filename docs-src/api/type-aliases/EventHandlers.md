### Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/a92b4399bad64857b5ce4a84d167b4b3258577af/src/events.ts#L25)

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`
