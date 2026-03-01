### Function: untrack()

> **untrack**\<`T`\>(`fn`): `T`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:196

Runs a callback without tracking dependencies.
Any signal reads inside the callback will not create edges to the current active sink.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T`

The function to execute without tracking

#### Returns

`T`

The return value of the function

#### Example

```ts
const count = createState(0);
const label = createState('Count');

createEffect(() => {
  // Only re-runs when count changes, not when label changes
  const name = untrack(() => label.get());
  console.log(`${name}: ${count.get()}`);
});
```
