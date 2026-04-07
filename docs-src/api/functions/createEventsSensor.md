### Function: createEventsSensor()

#### Call Signature

> **createEventsSensor**\<`T`, `E`\>(`target`, `init`, `events`): [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: [src/events.ts:85](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/events.ts#L85)

Create a `Sensor<T>` driven by DOM events on a target element (v1.1 form).

Use this inside `expose()` as a property initializer when a single reactive
value should be derived from events on a specific element. The listener is
attached directly to `target`; the handler receives `{ event, target, prev }`.

##### Type Parameters

###### T

`T` *extends* `object`

###### E

`E` *extends* `Element`

##### Parameters

###### target

`E`

The element to listen on

###### init

`T`

Initial value of the sensor

###### events

[`EventHandlersV2`](../type-aliases/EventHandlersV2.md)\<`T`, `E`\>

Map of event type to handler function

##### Returns

[`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Sensor that updates when matching events fire on target

##### Since

1.1

#### Call Signature

> **createEventsSensor**\<`T`, `P`, `U`, `K`\>(`init`, `key`, `events`): (`ui`) => [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: [src/events.ts:109](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/events.ts#L109)

Create a `Reader` that produces a `Sensor<T>` driven by DOM events (v1.0 form).

Use this as a reactive property initializer when a single state value should be
derived from multiple event types (e.g. combining `click` and `keyup` into a
`selected` value), instead of updating host properties imperatively via `on()`.

Event listeners are attached to the host element using event delegation.
Each handler receives `{ event, ui, target, prev }` and returns the new value,
or `void`/`Promise<void>` to leave the value unchanged. Passive events are
deferred via `schedule()`.

##### Type Parameters

###### T

`T` *extends* `object`

###### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

###### U

`U` *extends* [`UI`](../type-aliases/UI.md)

###### K

`K` *extends* `string` \| `number` \| `symbol`

##### Parameters

###### init

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Initial value, static fallback, or reader function

###### key

`K`

Key of the UI object whose element(s) to listen on

###### events

[`EventHandlers`](../type-aliases/EventHandlers.md)\<`T`, `U`, `any`\>

Map of event type to handler function

##### Returns

Reader that creates and returns the sensor

(`ui`) => [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

##### Since

0.16.0
