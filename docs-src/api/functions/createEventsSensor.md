### Function: createEventsSensor()

> **createEventsSensor**\<`T`, `E`\>(`target`, `init`, `events`): [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: [src/events.ts:185](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/events.ts#L185)

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

2.0
