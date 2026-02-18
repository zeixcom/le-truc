[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Store

# Type Alias: Store\<T\>

> **Store**\<`T`\> = `BaseStore`\<`T`\> & \{ \[K in keyof T\]: T\[K\] extends readonly (infer U extends \{\})\[\] ? List\<U\> : T\[K\] extends UnknownRecord ? Store\<T\[K\]\> : T\[K\] extends unknown & \{\} ? State\<T\[K\] & \{\}\> : State\<T\[K\] & \{\}\> \| undefined \}

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/store.d.ts:22

Le Truc

Version 0.16.1

## Type Parameters

### T

`T` *extends* `UnknownRecord`

## Author

Esther Brunner, Zeix AG
