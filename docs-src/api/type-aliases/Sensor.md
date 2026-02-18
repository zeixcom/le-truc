### Type Alias: Sensor\<T\>

> **Sensor**\<`T`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/sensor.d.ts:7

A read-only signal that tracks external input and updates a state value as long as it is active.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value produced by the sensor

#### Properties

##### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `"Sensor"`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/sensor.d.ts:8

#### Methods

##### get()

> **get**(): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/sensor.d.ts:15

Gets the current value of the sensor.
When called inside another reactive context, creates a dependency.

###### Returns

`T`

The sensor value

###### Throws

UnsetSignalValueError If the sensor value is still unset when read.
