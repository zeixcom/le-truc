### Type Alias: SensorEventHandler()\<T, Evt, U, E\>

> **SensorEventHandler**\<`T`, `Evt`, `U`, `E`\> = (`context`) => `T` \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:13](https://github.com/zeixcom/le-truc/blob/c76fdd788c0b9a613a5dd883bb02ba2aa0c3b1ba/src/events.ts#L13)

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
