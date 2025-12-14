[**le-truc**](../README.md)

***

[le-truc](../globals.md) / ElementFromKey

# Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Collection`](Collection.md)\<infer E\> ? `E` : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:97](https://github.com/zeixcom/le-truc/blob/adc7f347d870e640578165aa28996ebdcb7a5c42/src/ui.ts#L97)

## Type Parameters

### U

`U` *extends* [`UI`](UI.md)

### K

`K` *extends* keyof `U`
