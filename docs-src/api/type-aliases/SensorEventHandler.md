### Type Alias: SensorEventHandler()\<T, Evt, U, E\>

> **SensorEventHandler**\<`T`, `Evt`, `U`, `E`\> = (`context`) => `T` \| `void` \| `Promise`\<`void`\>

Defined in: [src/events.ts:13](https://github.com/zeixcom/le-truc/blob/a15d81f5442bf8607f9db7d5c4ecfccdb568a946/src/events.ts#L13)

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
