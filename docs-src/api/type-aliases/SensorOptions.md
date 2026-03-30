### Type Alias: SensorOptions\<T\>

> **SensorOptions**\<`T`\> = [`SignalOptions`](SignalOptions.md)\<`T`\> & `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/sensor.d.ts:22

Configuration options for `createSensor`.

#### Type Declaration

##### value?

> `optional` **value?**: `T`

Optional initial value. Avoids `UnsetSignalValueError` on first read
before the watched callback fires.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value produced by the sensor
