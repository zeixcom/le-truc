### Variable: SKIP\_EQUALITY()

> `const` **SKIP\_EQUALITY**: (`_a?`, `_b?`) => `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:145

Equality function that always returns false, causing propagation on every update.
Use with `createSensor` for observing mutable objects where the reference stays the same
but internal state changes (e.g., DOM elements observed via MutationObserver).

#### Parameters

##### \_a?

`unknown`

##### \_b?

`unknown`

#### Returns

`boolean`

#### Example

```ts
const el = createSensor<HTMLElement>((set) => {
  const node = document.getElementById('box')!;
  set(node);
  const obs = new MutationObserver(() => set(node));
  obs.observe(node, { attributes: true });
  return () => obs.disconnect();
}, { value: node, equals: SKIP_EQUALITY });
```
