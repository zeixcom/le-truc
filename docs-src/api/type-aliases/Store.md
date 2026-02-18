### Type Alias: Store\<T\>

> **Store**\<`T`\> = `BaseStore`\<`T`\> & \{ \[K in keyof T\]: T\[K\] extends readonly (infer U extends \{\})\[\] ? List\<U\> : T\[K\] extends UnknownRecord ? Store\<T\[K\]\> : T\[K\] extends unknown & \{\} ? State\<T\[K\] & \{\}\> : State\<T\[K\] & \{\}\> \| undefined \}

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/store.d.ts:22

#### Type Parameters

##### T

`T` *extends* `UnknownRecord`
