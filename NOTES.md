# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## 2026-09-26 — LT-250 (ICU build half): deviations and handoff notes

- **The code is `LTC055`, not a `TSRX` code.** The task said "new TSRX code". Under the ADR 0028
  amendment (see the `diagnostics.ts` header and VOCABULARY_LEDGER §4), a rule the shared
  machinery emits on both surfaces is `LTC###`, and this one runs in the shared post-lowering
  pass. Architect: confirm, or rename before LT-189 fixes the copy.
- **LTC055 has two faces.** The task named only the call-site check. An *unparseable source
  pattern* needed a channel too. A translation that fails to parse falls back to the source,
  but the source has nothing to fall back to, so it is an author-fixable error. It shares the
  code: both faces are the "statically decidable ICU message error" family.
  (`unparseableMessage` / `messageArgumentMismatch` builders.)
- **The fold needed no `evaluability.ts` change.** `t.key({ count })` is a call on a
  server-known name, so the existing `isServerEvaluable` rule already admits it, and the
  locale work happens inside the generated `i18n` module's function, where the walk never
  looks. What changed is the generated module: an argument message is now
  `(args) => formatMessage(ast, args, { lang, timeZone, currency })`. Pinned end to end in
  `i18n.test.ts` ("the server fold of an ICU message"). Tier census is byte-identical to the
  iteration's opening measurement (30 folded / 5 simulated / 0 static). The warning baseline
  stays 0.
- **Supported MF1 surface = what `Intl` can run.** `{x}`, `number` (bare / integer / percent /
  currency / `currency:XYZ` / `::skeleton`), `date`/`time` (named styles / `::skeleton`),
  `plural`/`selectordinal` (offset, `=N`), `select`. Refused with a reason: custom formatters
  (`spellout`, `duration`, `ordinal`), ICU number *patterns* (`#,##0.00`), date *patterns*,
  `precision-increment`, and one argument used as both number and date. Core accepts some of
  these, so they sit in the negatives set as reasoned refusals, not as disagreements.
- **One deliberate divergence from core:** `date`/`time` apply the record's `timeZone`
  (ADR 0030 s2), while core formats named styles in the process zone. The differential test
  pins `TZ=UTC` for the comparison and restores it afterward.
- **Generated `i18n.ts`:** empty `''` placeholders and unparseable translations are now
  dropped at generation, so they fall back to the source. That is the same resolution as
  before for placeholders; for the unparseable case, the census record is LT-219's. The
  module's `t` stays typed `Record<string, string>` until LT-308, and an argument function is
  cast through `unknown`. A catalog with no argument messages imports nothing new, so every
  other generated module is byte-identical.
- **Argument kinds for LT-308** are on `ComponentIR.i18nArgs` (optional, contract-additive),
  from `readModuleDecls`. They are not on the registry entry. LT-308 reads the IR in
  `emit-server.ts`. If `check:corpus` needs them from the registry, add them there.
- **Call-site check limits:** it does not track shadowing, and it skips undeclared keys
  (`t.fliter` is the TypeScript channel, LT-308). A string-literal computed key (`t['k']`) is
  checked like `t.k`.
