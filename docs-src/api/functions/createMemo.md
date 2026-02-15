[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createMemo

# Function: createMemo()

## Name

Le Truc

## Version

0.16.0

## Author

Esther Brunner

## Call Signature

> **createMemo**\<`T`\>(`fn`, `options`): [`Memo`](../type-aliases/Memo.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/memo.d.ts:51

Creates a derived reactive computation that caches its result.
The computation automatically tracks dependencies and recomputes when they change.
Uses lazy evaluation - only computes when the value is accessed.

### Type Parameters

#### T

`T` *extends* `object`

The type of value computed by the memo

### Parameters

#### fn

(`prev`) => `T`

The computation function that receives the previous value

#### options

[`SignalOptions`](../type-aliases/SignalOptions.md)\<`T`\> & `object` & `object`

Optional configuration for the memo

### Returns

[`Memo`](../type-aliases/Memo.md)\<`T`\>

A Memo object with a get() method

### Since

0.18.0

### Examples

```ts
const count = createState(0);
const doubled = createMemo(() => count.get() * 2);
console.log(doubled.get()); // 0
count.set(5);
console.log(doubled.get()); // 10
```

```ts
// Using previous value
const sum = createMemo((prev) => prev + count.get(), { value: 0, equals: Object.is });
```

## Call Signature

> **createMemo**\<`T`\>(`fn`, `options?`): [`Memo`](../type-aliases/Memo.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/memo.d.ts:54

Creates a derived reactive computation that caches its result.
The computation automatically tracks dependencies and recomputes when they change.
Uses lazy evaluation - only computes when the value is accessed.

### Type Parameters

#### T

`T` *extends* `object`

The type of value computed by the memo

### Parameters

#### fn

[`MemoCallback`](../type-aliases/MemoCallback.md)\<`T`\>

The computation function that receives the previous value

#### options?

[`ComputedOptions`](../type-aliases/ComputedOptions.md)\<`T`\>

Optional configuration for the memo

### Returns

[`Memo`](../type-aliases/Memo.md)\<`T`\>

A Memo object with a get() method

### Since

0.18.0

### Examples

```ts
const count = createState(0);
const doubled = createMemo(() => count.get() * 2);
console.log(doubled.get()); // 0
count.set(5);
console.log(doubled.get()); // 10
```

```ts
// Using previous value
const sum = createMemo((prev) => prev + count.get(), { value: 0, equals: Object.is });
```
