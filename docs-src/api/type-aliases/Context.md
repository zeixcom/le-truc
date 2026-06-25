### Type Alias: Context\<K, V\>

> **Context**\<`K`, `V`\> = `K` & `object`

Defined in: [src/helpers/context.ts:21](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/helpers/context.ts#L21)

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
