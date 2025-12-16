[**le-truc**](../README.md)

***

[le-truc](../globals.md) / ElementFromKey

# Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Collection`](Collection.md)\<infer E\> ? `E` : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:97](https://github.com/zeixcom/le-truc/blob/5bd629bc02429c8193f06a75f94397faf30ed891/src/ui.ts#L97)

## Type Parameters

### U

`U` *extends* [`UI`](UI.md)

### K

`K` *extends* keyof `U`
