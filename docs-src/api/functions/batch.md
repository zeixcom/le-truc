### Function: batch()

> **batch**(`fn`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:176

Batches multiple signal updates together.
Effects will not run until the batch completes.
Batches can be nested; effects run when the outermost batch completes.

#### Parameters

##### fn

() => `void`

The function to execute within the batch

#### Returns

`void`

#### Example

```ts
const count = createState(0);
const double = createMemo(() => count.get() * 2);

batch(() => {
  count.set(1);
  count.set(2);
  count.set(3);
  // Effects run only once at the end with count = 3
});
```
