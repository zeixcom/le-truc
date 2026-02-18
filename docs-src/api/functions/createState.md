### Function: createState()

> **createState**\<`T`\>(`value`, `options?`): [`State`](../type-aliases/State.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:61

Creates a mutable reactive state container.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value stored in the state

#### Parameters

##### value

`T`

The initial value

##### options?

[`SignalOptions`](../type-aliases/SignalOptions.md)\<`T`\>

Optional configuration for the state

#### Returns

[`State`](../type-aliases/State.md)\<`T`\>

A State object with get() and set() methods

#### Since

0.9.0

#### Examples

```ts
const count = createState(0);
count.set(1);
console.log(count.get()); // 1
```

```ts
// With type guard
const count = createState(0, {
  guard: (v): v is number => typeof v === 'number'
});
```
