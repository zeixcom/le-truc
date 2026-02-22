### Type Alias: Context\<K, V\>

> **Context**\<`K`, `V`\> = `K` & `object`

Defined in: [src/context.ts:23](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/context.ts#L23)

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
