[**le-truc**](../README.md)

***

[le-truc](../globals.md) / resolve

# Function: resolve()

> **resolve**\<`S`\>(`signals`): [`ResolveResult`](../type-aliases/ResolveResult.md)\<`S`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/resolve.d.ts:28

Resolve signal values with perfect type inference

Always returns a discriminated union result, regardless of whether
handlers are provided or not. This ensures a predictable API.

## Type Parameters

### S

`S` *extends* `UnknownSignalRecord`

## Parameters

### signals

`S`

Signals to resolve

## Returns

[`ResolveResult`](../type-aliases/ResolveResult.md)\<`S`\>

- Discriminated union result

## Since

0.15.0
