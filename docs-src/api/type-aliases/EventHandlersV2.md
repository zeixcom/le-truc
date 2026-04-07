### Type Alias: EventHandlersV2\<T, E\>

> **EventHandlersV2**\<`T`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandlerV2<T, EventType<K>, E> }`

Defined in: [src/events.ts:66](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/events.ts#L66)

Map of event type names to `SensorEventHandlerV2` functions for the v1.1 form.

#### Type Parameters

##### T

`T` *extends* `object`

##### E

`E` *extends* `Element`
