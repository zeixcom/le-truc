### Type Alias: EventHandlers\<T, E\>

> **EventHandlers**\<`T`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, E> }`

Defined in: [src/events.ts:43](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/events.ts#L43)

Map of event type names to `SensorEventHandler` functions.
Each handler derives the new sensor value from the event, or returns `void` to leave it unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### E

`E` *extends* `Element`
