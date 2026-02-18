### Function: createEffect()

> **createEffect**(`fn`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/effect.d.ts:39

Creates a reactive effect that automatically runs when its dependencies change.
Effects run immediately upon creation and re-run when any tracked signal changes.
Effects are executed during the flush phase, after all updates have been batched.

#### Parameters

##### fn

[`EffectCallback`](../type-aliases/EffectCallback.md)

The effect function that can track dependencies and register cleanup callbacks

#### Returns

[`Cleanup`](../type-aliases/Cleanup.md)

A cleanup function that can be called to dispose of the effect

#### Since

0.1.0

#### Examples

```ts
const count = createState(0);
const dispose = createEffect(() => {
  console.log('Count is:', count.get());
});

count.set(1); // Logs: "Count is: 1"
dispose(); // Stop the effect
```

```ts
// With cleanup
createEffect(() => {
  const timer = setInterval(() => console.log(count.get()), 1000);
  return () => clearInterval(timer);
});
```
