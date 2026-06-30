### Function: createContext()

> **createContext**\<`V`\>(`key`): [`Context`](../type-aliases/Context.md)\<`string`, `V`\>

Defined in: [src/helpers/context.ts:134](https://github.com/zeixcom/le-truc/blob/2877d2afe24fa5dcc6cc8851f03777f67a181664/src/helpers/context.ts#L134)

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
