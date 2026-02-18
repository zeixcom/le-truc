### Function: isState()

> **isState**\<`T`\>(`value`): `value is State<T>`

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/state.d.ts:77

Checks if a value is a State signal.

#### Type Parameters

##### T

`T` *extends* `object` = \{ \}

#### Parameters

##### value

`unknown`

The value to check

#### Returns

`value is State<T>`

True if the value is a State

#### Since

0.9.0

#### Example

```ts
const state = createState(0);
if (isState(state)) {
  state.set(1); // TypeScript knows state has set()
}
```
