### Type Alias: Context\<K, V\>

> **Context**\<`K`, `V`\> = `K` & `object`

Defined in: [src/context.ts:21](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/context.ts#L21)

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
