### Variable: DEEP\_EQUALITY

> `const` **DEEP\_EQUALITY**: \<`T`\>(`a`, `b`) => `boolean`

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:176

Deep structural equality check for plain objects and arrays.
Use when a signal holds an object or array and you want to avoid unnecessary
downstream propagation when the value re-evaluates to a structurally identical result.

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### a

`T`

##### b

`T`

#### Returns

`boolean`

#### Example

```ts
const point = createState({ x: 0, y: 0 }, { equals: DEEP_EQUALITY });
point.set({ x: 0, y: 0 }); // no propagation — structurally equal
```
