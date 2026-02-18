[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / requestContext

# Function: requestContext()

> **requestContext**\<`T`, `P`, `U`\>(`context`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<[`Memo`](../type-aliases/Memo.md)\<`T`\>, `U` & `object`\>

Defined in: [src/context.ts:133](https://github.com/zeixcom/le-truc/blob/5c30877fa2fce96dab1ef679e495da98511e97d7/src/context.ts#L133)

Consume a context value for a component

## Type Parameters

### T

`T` *extends* `object`

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### context

[`Context`](../type-aliases/Context.md)\<`string`, () => `T`\>

Context key to consume

### fallback

[`Fallback`](../type-aliases/Fallback.md)\<`T`, `U` & `object`\>

Fallback value or reader function for fallback

## Returns

[`Reader`](../type-aliases/Reader.md)\<[`Memo`](../type-aliases/Memo.md)\<`T`\>, `U` & `object`\>

Computed signal that returns the consumed context the fallback value

## Since

0.15.0
