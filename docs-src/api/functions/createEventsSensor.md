### Function: createEventsSensor()

> **createEventsSensor**\<`T`, `E`\>(`target`, `init`, `events`): [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: [src/events.ts:176](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/events.ts#L176)

Create a `Sensor<T>` driven by DOM events on a target element.

Use this inside `expose()` as a property initializer when a single reactive
value should be derived from events on a specific element. The listener is
attached directly to `target`; the handler receives `{ event, target, prev }`.

#### Type Parameters

##### T

`T` *extends* `object`

##### E

`E` *extends* `Element`

#### Parameters

##### target

`E`

The element to listen on

##### init

`T`

Initial value of the sensor

##### events

[`EventHandlers`](../type-aliases/EventHandlers.md)\<`T`, `E`\>

Map of event type to handler function

#### Returns

[`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Sensor that updates when matching events fire on target

#### Since

1.1
