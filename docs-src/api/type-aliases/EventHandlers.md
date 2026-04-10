### Type Alias: EventHandlers\<T, E\>

> **EventHandlers**\<`T`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, E> }`

Defined in: [src/events.ts:43](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/events.ts#L43)

Map of event type names to `SensorEventHandler` functions.
Each handler derives the new sensor value from the event, or returns `void` to leave it unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### E

`E` *extends* `Element`
