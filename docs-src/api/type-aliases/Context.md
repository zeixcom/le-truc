### Type Alias: Context\<K, V\>

> **Context**\<`K`, `V`\> = `K` & `object`

Defined in: [src/context.ts:24](https://github.com/zeixcom/le-truc/blob/0b894ae96d4e011ef23dbb48c30fa71b1f97f087/src/context.ts#L24)

A context key.

A context key can be any type of object, including strings and symbols. The
 Context type brands the key type with the `__context__` property that
carries the type of the value the context references.

#### Type Declaration

##### \_\_context\_\_

> **\_\_context\_\_**: `V`

#### Type Parameters

##### K

`K`

##### V

`V`
