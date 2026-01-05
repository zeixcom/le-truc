[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Store

# Type Alias: Store\<T\>

> **Store**\<`T`\> = `BaseStore`\<`T`\> & `{ [K in keyof T]: T[K] extends readonly (infer U extends {})[] ? List<U> : T[K] extends UnknownRecord ? Store<T[K]> : State<T[K] & {}> }`

Defined in: node\_modules/@zeix/cause-effect/types/src/classes/store.d.ts:6

## Type Parameters

### T

`T` *extends* `UnknownRecord`

## Name

Le Truc

## Version

0.15.1

## Author

Esther Brunner
