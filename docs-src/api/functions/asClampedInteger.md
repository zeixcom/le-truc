### Function: asClampedInteger()

> **asClampedInteger**\<`U`\>(`minFallback?`, `maxFallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:67](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/parsers/number.ts#L67)

Parse a string as a clamped integer (>= min, <= max) with fallbacks

#### Type Parameters

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### minFallback?

[`Fallback`](../type-aliases/Fallback.md)\<`number`, `U`\> = `0`

Minimum value or reader function

##### maxFallback?

[`Fallback`](../type-aliases/Fallback.md)\<`number`, `U`\> = `Number.MAX_SAFE_INTEGER`

Maximum value or reader function

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Parser function

#### Since

1.1
