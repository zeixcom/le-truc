[**le-truc**](../README.md)

***

[le-truc](../globals.md) / match

# Function: match()

> **match**\<`S`\>(`result`, `handlers`): `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/match.d.ts:20

Match on resolve result and call appropriate handler for side effects

This is a utility function for those who prefer the handler pattern.
All handlers are for side effects only and return void. If you need
cleanup logic, use a hoisted let variable in your effect.

## Type Parameters

### S

`S` *extends* `UnknownSignalRecord`

## Parameters

### result

[`ResolveResult`](../type-aliases/ResolveResult.md)\<`S`\>

Result from resolve()

### handlers

[`MatchHandlers`](../type-aliases/MatchHandlers.md)\<`S`\>

Handlers for different states (side effects only)

## Returns

`void`

- Always returns void

## Since

0.15.0
