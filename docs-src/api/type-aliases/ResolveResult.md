[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ResolveResult

# Type Alias: ResolveResult\<S\>

> **ResolveResult**\<`S`\> = \{ `errors?`: `never`; `ok`: `true`; `pending?`: `never`; `values`: `SignalValues`\<`S`\>; \} \| \{ `errors`: readonly `Error`[]; `ok`: `false`; `pending?`: `never`; `values?`: `never`; \} \| \{ `errors?`: `never`; `ok`: `false`; `pending`: `true`; `values?`: `never`; \}

Defined in: node\_modules/@zeix/cause-effect/types/src/resolve.d.ts:2

## Type Parameters

### S

`S` *extends* `UnknownSignalRecord`

## Name

Le Truc

## Version

0.15.0

## Author

Esther Brunner
