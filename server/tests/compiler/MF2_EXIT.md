# The MF2 exit — fixtures and rebaseline procedure (LT-253)

ADR 0030 keeps ICU MessageFormat 1 as a deliberate bet, with an open exit:
`@messageformat/icu-messageformat-1` lifts MF1 into the MF2 data model, and
`messageformat@4` serializes and renders it. Both come from the same
maintainers. `mf2-exit.test.ts` tests that exit instead of asserting it.
`mf2-exit.ts` is the conversion the migration would run.

## What the gate checks

`bun test server/tests` runs `mf2-exit.test.ts`. For every corpus pattern
(each component's inline `en` source and every catalog translation), it:

1. converts MF1 → MF2 source text, and requires that text to be a fixed
   point of MF2's own parser (`stringify(parse(text)) === text`);
2. renders both sides over an argument matrix: counts that reach every CLDR
   category in the six locales, every spelled select key plus an unspelled
   one and `constructor`, and strings with `{ } | \` in them. MF1 renders
   through our evaluator (what ships), MF2 through `messageformat@4`;
3. requires byte-identical output. An MF2 formatter warning counts as a
   failure, even when the fallback text happens to match.

An `en` source pattern is rendered in `en` and in all six catalog locales,
because it is the fallback wherever a key is untranslated.

So a pattern the exit cannot carry fails when it is authored, not years
later when the migration runs.

## The normalizations the exit needs

The converter's raw output is not always valid, serializable MF2. The exit
applies two normalizations, both in `mf2-exit.ts`:

- **`dedupeInputs`**: in MF1, one argument can drive selectors of different
  types in different arms. basic-pluralize's `tasks` does this: `count` is a
  `selectordinal` under `type=ordinal` and a `plural` otherwise. The
  converter emits `.input {$count}` twice, which MF2 rejects as a
  `duplicate-declaration`. Each duplicate becomes
  `.local $count__N = {$count …}`. A repeated argument with a plural
  `offset` is refused, because the rewrite cannot preserve `#`.
- **`stringifyLiterals`**: number skeletons produce numeric option values
  (`::.00` → `minimumFractionDigits=2`). `stringifyMessage` throws on those.

A test pins that the raw converter still fails on `tasks`. If upstream
fixes it, that test fails: drop the normalization and update this file.

## The known-lossy spots

These are pinned with fixtures in `mf2-exit.test.ts`:

- **Nested-to-flat arm expansion.** MF1 nests plural inside select; MF2 has
  one flat `.match` over several selectors, so arms multiply out. The cy
  `tasks` pattern becomes 2 × 6 × 6 = 72 variants, including combinations
  no input can reach (an ordinal key beside a cardinal one). Semantically
  identical, textually larger. Translators review the result as a table,
  not as a nested pattern.
- **Escaping.** MF1 quotes with apostrophes (`'{'`, `''`). MF2 has no
  apostrophe syntax. It backslash-escapes `{ } \` in text, leaves `|` bare
  in text, and quotes literals as `|…|` (`@mf1:argStyle=|::.00|`). A
  codemod that copies text verbatim gets this wrong both ways: `It''s`
  becomes `It's`, and a quoted `'{'$price'}'` must become `\{$price\}`,
  not a variable.
- **A number in a plain placeholder.** MF1 `{n}` stringifies; MF2 `{$n}`
  formats by locale (`1234.5` vs `1.234,5`). No corpus placeholder carries
  a number. If one ever does, author it as `{n, number}`.

## What the exit does not carry

`NOT_CARRIED` lists the MF1 constructs our evaluator supports but the exit
renders differently or only with a warning. No corpus pattern uses them
today, and the corpus gate would fail if one did:

| Construct | Gap |
|---|---|
| `{n, number, percent}`, `::percent` on a fraction | MF1 rounds to an integer; `:unit` keeps fraction digits |
| `{n, number, currency}` | the render record's default currency has no MF2 channel |
| `{n, number, currency:EUR}` | legacy style, not a skeleton; the converter drops the code |
| `{n, number, ::compact-short}` | the converter does not support `notation` |
| `{d, time, long}` | loses the time-zone name |
| `{d, date, ::yMMMd}` | renders correctly, but only through a warned fallback |

When upstream closes a gap, its row fails. Move it to `CARRIED`.

## Rendering

MF2 wraps every placeholder in FSI/PDI bidi isolates by default; MF1 never
did. The exit compiles with `bidiIsolation: 'none'`. The migrated runtime
must do the same, or accept that every rendered string with a placeholder
changes, and rebaseline the snapshots for that as a separate decision.

## The rebaseline procedure

Precedent: **4e755e28** (LT-252), the sanctioned rebaseline under
ADR 0030 s5, where basic-pluralize and six catalogs moved to one ICU
pattern. The migration follows the same shape:

1. **One commit.** Component sources, all `i18n/<locale>.json` catalogs and
   `i18n/manifest.json` change together. No intermediate commit leaves a
   catalog in one syntax and its source in the other.
2. **Convert with `toMF2`.** Use the tested conversion, normalizations
   included, for inline source strings and every catalog value. Do not
   hand-edit the output. A pattern `toMF2` refuses, or that fails the gate,
   gets rewritten in MF1 first, in its own commit.
3. **Refresh the manifest.** Run `bun run i18n:sync`. Every source string
   changes syntax, so every hash changes. Record the translations against
   the new hashes; no translation changed meaning, so none is marked stale.
   Prune orphaned manifest entries by hand (sync prunes orphaned catalog
   keys, not their manifest entries).
4. **Re-approve snapshots.** Rendered output is byte-identical by
   construction (that is what this suite proves), so the page, parity and
   equivalence snapshots should not change. Only the serialized `i18n`
   attribute (the client-side AST) does. Any other diff is a bug in the
   migration.
5. **Commit message.** Mark it `SANCTIONED REBASELINE (ADR 0030 s5)`, cite
   4e755e28 and LT-253, and state the manifest refresh and any hand-pruning,
   as LT-252 did.
6. **After the migration**, this suite inverts: MF2 becomes the source, and
   the round trip is dropped, or kept as MF2 → evaluator agreement.
