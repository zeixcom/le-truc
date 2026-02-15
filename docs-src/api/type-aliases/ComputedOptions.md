[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ComputedOptions

# Type Alias: ComputedOptions\<T\>

> **ComputedOptions**\<`T`\> = [`SignalOptions`](SignalOptions.md)\<`T`\> & `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:73

## Type Declaration

### value?

> `optional` **value**: `T`

Optional initial value.
Useful for reducer patterns so that calculations start with a value of correct type.

### watched()?

> `optional` **watched**: (`invalidate`) => [`Cleanup`](Cleanup.md)

Optional callback invoked when the signal is first watched by an effect.
Receives an `invalidate` function that marks the signal dirty and triggers re-evaluation.
Must return a cleanup function that is called when the signal is no longer watched.

This enables lazy resource activation for computed signals that need to
react to external events (e.g. DOM mutations, timers) in addition to
tracked signal dependencies.

#### Parameters

##### invalidate

() => `void`

#### Returns

[`Cleanup`](Cleanup.md)

## Type Parameters

### T

`T` *extends* `object`

## Name

Le Truc

## Version

0.16.0

## Author

Esther Brunner
