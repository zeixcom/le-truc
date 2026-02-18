[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ExtractTagFromSimpleSelector

# Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:32](https://github.com/zeixcom/le-truc/blob/3cb760ea5cf00b2f369106cc51ee33852f9ce090/src/ui.ts#L32)

## Type Parameters

### S

`S` *extends* `string`
