[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Context

# Type Alias: Context\<K, V\>

> **Context**\<`K`, `V`\> = `K` & `object`

Defined in: [src/context.ts:23](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/context.ts#L23)

A context key.

A context key can be any type of object, including strings and symbols. The
 Context type brands the key type with the `__context__` property that
carries the type of the value the context references.

## Type Declaration

### \_\_context\_\_

> **\_\_context\_\_**: `V`

## Type Parameters

### K

`K`

### V

`V`
