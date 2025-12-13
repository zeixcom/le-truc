[**le-truc**](../README.md)

***

[le-truc](../globals.md) / MatchHandlers

# Type Alias: MatchHandlers\<S\>

> **MatchHandlers**\<`S`\> = `object`

Defined in: node\_modules/@zeix/cause-effect/types/src/match.d.ts:3

## Name

Le Truc

## Version

0.15.0

## Author

Esther Brunner

## Type Parameters

### S

`S` *extends* `UnknownSignalRecord`

## Properties

### err()?

> `optional` **err**: (`errors`) => `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/match.d.ts:5

#### Parameters

##### errors

readonly `Error`[]

#### Returns

`void`

***

### nil()?

> `optional` **nil**: () => `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/match.d.ts:6

#### Returns

`void`

***

### ok()

> **ok**: (`values`) => `void`

Defined in: node\_modules/@zeix/cause-effect/types/src/match.d.ts:4

#### Parameters

##### values

`SignalValues`\<`S`\>

#### Returns

`void`
