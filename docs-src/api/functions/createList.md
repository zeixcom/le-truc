### Function: createList()

> **createList**\<`T`\>(`value`, `options?`): [`List`](../type-aliases/List.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/list.d.ts:75

Creates a reactive list with stable keys and per-item reactivity.

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### value

`T`[]

Initial array of items

##### options?

[`ListOptions`](../type-aliases/ListOptions.md)\<`T`\>

#### Returns

[`List`](../type-aliases/List.md)\<`T`\>

A `List` signal with reactive per-item `State` signals

#### Since

0.18.0
