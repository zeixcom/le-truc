### Function: createEventsSensor()

> **createEventsSensor**\<`T`, `P`, `U`, `K`\>(`init`, `key`, `events`): (`ui`) => [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

Defined in: [src/events.ts:50](https://github.com/zeixcom/le-truc/blob/62f34241868753829f1b0628a59b7cbc4dc09d76/src/events.ts#L50)

Create a `Reader` that produces a `Sensor<T>` driven by DOM events on the host.

Use this as a reactive property initializer when a single state value should be
derived from multiple event types (e.g. combining `click` and `keyup` into a
`selected` value), instead of updating host properties imperatively via `on()`.

Event listeners are attached to the host element using event delegation.
Each handler receives `{ event, ui, target, prev }` and returns the new value,
or `void`/`Promise<void>` to leave the value unchanged. Passive events are
deferred via `schedule()`.

#### Type Parameters

##### T

`T` *extends* `object`

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

##### K

`K` *extends* `string` \| `number` \| `symbol`

#### Parameters

##### init

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Initial value, static fallback, or reader function

##### key

`K`

Key of the UI object whose element(s) to listen on

##### events

[`EventHandlers`](../type-aliases/EventHandlers.md)\<`T`, `U`, [`ElementFromKey`](../type-aliases/ElementFromKey.md)\<`U`, `K`\>\>

Map of event type to handler function

#### Returns

Reader that creates and returns the sensor

> (`ui`): [`Sensor`](../type-aliases/Sensor.md)\<`T`\>

##### Parameters

###### ui

`U` & `object`

##### Returns

[`Sensor`](../type-aliases/Sensor.md)\<`T`\>

#### Since

0.16.0
