### Type Alias: EventHandlersV2\<T, E\>

> **EventHandlersV2**\<`T`, `E`\> = `{ [K in keyof HTMLElementEventMap]?: SensorEventHandlerV2<T, EventType<K>, E> }`

Defined in: [src/events.ts:66](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/events.ts#L66)

Map of event type names to `SensorEventHandlerV2` functions for the v1.1 form.

#### Type Parameters

##### T

`T` *extends* `object`

##### E

`E` *extends* `Element`
