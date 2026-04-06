### Type Alias: EventHandlers\<T, U, E\>

> **EventHandlers**\<`T`, `U`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E> }`

Defined in: [src/events.ts:42](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/events.ts#L42)

Map of event type names to `SensorEventHandler` functions, passed as the
third argument to `createEventsSensor` (v1.0 form). Each handler derives the
new sensor value from the event, or returns `void` to leave it unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`
