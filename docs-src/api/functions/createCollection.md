### Function: createCollection()

> **createCollection**\<`T`, `S`\>(`watched`, `options?`): [`Collection`](../type-aliases/Collection.md)\<`T`, `S`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:92

Creates an externally-driven Collection with a watched lifecycle.
Items are managed via the `applyChanges(changes)` helper passed to the watched callback.
The collection activates when first accessed by an effect and deactivates when no longer watched.

#### Type Parameters

##### T

`T` *extends* `object`

##### S

`S` *extends* [`Signal`](../type-aliases/Signal.md)\<`T`\> = [`Signal`](../type-aliases/Signal.md)\<`T`\>

#### Parameters

##### watched

`CollectionCallback`\<`T`\>

Callback invoked when the collection starts being watched, receives applyChanges helper

##### options?

[`CollectionOptions`](../type-aliases/CollectionOptions.md)\<`T`, `S`\>

Optional configuration including initial value, key generation, and item signal creation

#### Returns

[`Collection`](../type-aliases/Collection.md)\<`T`, `S`\>

A read-only Collection signal

#### Since

0.18.0
