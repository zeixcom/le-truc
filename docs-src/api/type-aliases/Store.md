### Type Alias: Store\<T\>

> **Store**\<`T`\> = `BaseStore`\<`T`\> & \{ \[K in keyof T\]: T\[K\] extends readonly (infer U extends \{\})\[\] ? List\<U\> : T\[K\] extends UnknownRecord ? Store\<T\[K\]\> : T\[K\] extends unknown & \{\} ? State\<T\[K\] & \{\}\> : State\<T\[K\] & \{\}\> \| undefined \}

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/store.d.ts:33

A reactive object with per-property reactivity.
Each property is wrapped as a `State`, nested `Store`, or `List` signal, accessible directly via proxy.
Updating one property only re-runs effects that read that property.

#### Type Parameters

##### T

`T` *extends* `UnknownRecord`

The plain-object type whose properties become reactive signals
