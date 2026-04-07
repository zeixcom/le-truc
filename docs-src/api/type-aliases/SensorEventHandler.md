### Type Alias: SensorEventHandler\<T, Evt, E\>

> **SensorEventHandler**\<`T`, `Evt`, `E`\> = (`context`) => `T` \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:33](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/events.ts#L33)

Handler for a single event type inside `createEventsSensor`.

Receives a context object with:
- `event` — the original DOM event (typed to the specific event type)
- `target` — the matched element (properly typed, unlike `event.target`)
- `prev` — the current sensor value before this event

Return the new sensor value to update it, or `void` / `Promise<void>` to
leave the value unchanged.

#### Type Parameters

##### T

`T` *extends* `object`

##### Evt

`Evt` *extends* `Event`

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

#### Returns

`T` \| `void` \| `Promise`\<`void`\>
