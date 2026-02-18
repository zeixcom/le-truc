### Function: createStore()

> **createStore**\<`T`\>(`value`, `options?`): [`Store`](../type-aliases/Store.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/store.d.ts:42

Creates a reactive store with deeply nested reactive properties.
Each property becomes its own signal (State for primitives, nested Store for objects, List for arrays).
Properties are accessible directly via proxy.

#### Type Parameters

##### T

`T` *extends* `UnknownRecord`

#### Parameters

##### value

`T`

Initial object value of the store

##### options?

[`StoreOptions`](../type-aliases/StoreOptions.md)

Optional configuration for watch lifecycle

#### Returns

[`Store`](../type-aliases/Store.md)\<`T`\>

A Store with reactive properties

#### Since

0.15.0

#### Example

```ts
const user = createStore({ name: 'Alice', age: 30 });
user.name.set('Bob'); // Only name subscribers react
console.log(user.get()); // { name: 'Bob', age: 30 }
```
