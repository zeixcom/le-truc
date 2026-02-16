[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createScope

# Function: createScope()

> **createScope**(`fn`): [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:219

Creates a new ownership scope for managing cleanup of nested effects and resources.
All effects created within the scope will be automatically disposed when the scope is disposed.
Scopes can be nested - disposing a parent scope disposes all child scopes.

## Parameters

### fn

() => [`MaybeCleanup`](../type-aliases/MaybeCleanup.md)

The function to execute within the scope, may return a cleanup function

## Returns

[`Cleanup`](../type-aliases/Cleanup.md)

A dispose function that cleans up the scope

## Example

```ts
const dispose = createScope(() => {
  const count = createState(0);

  createEffect(() => {
    console.log(count.get());
  });

  return () => console.log('Scope disposed');
});

dispose(); // Cleans up the effect and runs cleanup callbacks
```
