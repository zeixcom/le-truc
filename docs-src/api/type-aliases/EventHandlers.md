### Type Alias: EventHandlers\<T, E\>

> **EventHandlers**\<`T`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, E> }`

Defined in: [src/events.ts:43](https://github.com/zeixcom/le-truc/blob/64495a8246bdcc3ad970b9cd968208c864711df0/src/events.ts#L43)

Map of event type names to `SensorEventHandler` functions.
Each handler derives the new sensor value from the event, or returns `void` to leave it unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### E

`E` *extends* `Element`
