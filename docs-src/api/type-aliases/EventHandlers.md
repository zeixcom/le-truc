### Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:42](https://github.com/zeixcom/le-truc/blob/aeeac355aad9805eb8ee281d5c2dacf08589e2c9/src/events.ts#L42)

Map of event type names to `SensorEventHandler` functions, passed as the
third argument to `createEventsSensor`. Each handler derives the new sensor
value from the event, or returns `void` to leave it unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`
