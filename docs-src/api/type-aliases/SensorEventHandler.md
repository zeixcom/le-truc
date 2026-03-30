### Type Alias: SensorEventHandler\<T, Evt, U, E\>

> **SensorEventHandler**\<`T`, `Evt`, `U`, `E`\> = (`context`) => `T` \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:25](https://github.com/zeixcom/le-truc/blob/6220ce654aeac0749cbca7a138414561096a0c1d/src/events.ts#L25)

Handler for a single event type inside `createEventsSensor`.

Receives a context object with:
- `event` — the original DOM event (typed to the specific event type)
- `ui` — the full component UI object
- `target` — the matched element (properly typed, unlike `event.target`)
- `prev` — the current sensor value before this event

Return the new sensor value to update it, or `void` / `Promise<void>` to
leave the value unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### Evt

`Evt` *extends* `Event`

##### U

`U` *extends* [`UI`](UI.md)

##### E

`E` *extends* `Element`

#### Parameters

##### context

###### event

`Evt`

###### prev

`T`

###### target

`E`

###### ui

`U`

#### Returns

`T` \| `void` \| `Promise`\<`void`\>
