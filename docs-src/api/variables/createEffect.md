[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createEffect

# Variable: createEffect()

> `const` **createEffect**: (`callback`) => [`Cleanup`](../type-aliases/Cleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/effect.d.ts:15

Define what happens when a reactive state changes

The callback can be synchronous or asynchronous. Async callbacks receive
an AbortSignal parameter, which is automatically aborted when the effect
re-runs or is cleaned up, preventing stale async operations.

## Parameters

### callback

[`EffectCallback`](../type-aliases/EffectCallback.md)

Synchronous or asynchronous effect callback

## Returns

[`Cleanup`](../type-aliases/Cleanup.md)

- Cleanup function for the effect

## Since

0.1.0
