### Function: createContext()

> **createContext**\<`V`\>(`key`): [`Context`](../type-aliases/Context.md)\<`string`, `V`\>

Defined in: [src/helpers/context.ts:133](https://github.com/zeixcom/le-truc/blob/8b1a8f8a0600ebb21b0e3c25fa43e088d951188e/src/helpers/context.ts#L133)

Create a typed context key.

The Context type brands the key type with the `__context__` property that
carries the type of the value the context references. This helper function
creates a properly typed context key from a plain value.

#### Type Parameters

##### V

`V`

#### Parameters

##### key

`string`

The context key (typically a string)

#### Returns

[`Context`](../type-aliases/Context.md)\<`string`, `V`\>

A typed context key

#### Since

2.0.2

#### Example

```ts
const themeContext = createContext<() => string>('theme')
const countContext = createContext<() => number>('count')
```
