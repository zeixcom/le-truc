### Type Alias: SensorEventHandler\<T, Evt, E\>

> **SensorEventHandler**\<`T`, `Evt`, `E`\> = (`context`) => `T` \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:21](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/events.ts#L21)

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
