### Type Alias: SensorEventHandlerV2\<T, Evt, E\>

> **SensorEventHandlerV2**\<`T`, `Evt`, `E`\> = (`context`) => `T` \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:57](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/events.ts#L57)

Handler for a single event type inside `createEventsSensor` (v1.1 form).

Receives a context object with:
- `event` — the original DOM event (typed to the specific event type)
- `target` — the matched element (properly typed, unlike `event.target`)
- `prev` — the current sensor value before this event

The `ui` field is dropped in the v1.1 form — elements are available in
the factory closure directly. Return the new value or `void` to leave unchanged.

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
