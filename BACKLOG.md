# BACKLOG

Planned tasks out of scope for the current iteration. Part of the 3-file mini-kanban
(owner, 2026-09-18):

- **BACKLOG.md** (this file) — everything planned; new tasks are created here, with full context.
- **TODO.md** — the current iteration only. The Architect moves tasks here at iteration
  planning; do not start a task that is still only in this file.
- **DONE.md** — done-and-reviewed tasks since the last release, compacted to what is still
  load-bearing (rulings recorded nowhere else, live handoffs by ID, changed-artifact facts for
  Changelog Keeper).

Only the Architect moves tasks between files (Tech Writer may execute the mechanical move when
delegated); developers annotate the status suffix on the entry in place. Task IDs are global and
sequential across all three files; the "Next free task ID" line lives in TODO.md's header.
Bands below are priority-ordered: they are the planned pick order for future iterations, not a
schedule. Band preambles may narrate landed work as history — the compacted records live in
DONE.md.

**Where landed work went.** Compacted done entries live in `DONE.md`; the rationale for what
shipped lives in `adr/` (0024, 0026–0033), `ARCHITECTURE.md`, `server/compiler/LE_TRUC_COMPILER.md`
and `server/compiler/HOST_PROFILE.md`; the user-facing summary lives in `CHANGELOG.md`
`[Unreleased]`; the full task-by-task record stays in `git log -p`. Do not re-derive a decision
from a task entry — read the ADR.

**Strategic framing (2026-09-18).** The owner has stated the governing premise: this repo is the
playground — the goal is a general-purpose framework employed in thousands of projects by users of
the open-source library. [COMPILER_REFLECTION.md](COMPILER_REFLECTION.md) (the six-question
compiler reflection, written the same day) evaluates the compiler against the repo alone; its
recommendations were re-derived under the framework premise when this queue was re-prioritized.
Consequences structured as tasks: the three S0 rulings (moved into TODO.md as the current
iteration) gate the bands beneath them; the wave-3 items are re-pointed from
author-the-shared-thing to adopt-the-maintained-library where one exists; the parity equivalence
contract extends to diagnostics (LT-242). REQUIREMENTS already declares the compiler ships as a
separate package (§5 Required) and the Simulated realm as a Must-Have (M20) — both face the
framework question explicitly, as owner-gated rulings, not by default.

**LT-241 is resolved** (owner, 2026-09-19; [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md),
REQUIREMENTS §1 / M27 / M28). The framework goal is declared, the criteria are external and
falsifiable, and the packaging track is the new **P1** band above. Three consequences reach the
rest of this file: (1) the published package is **`@zeix/le-truc-compiler`, TSX-only at 3.0** —
`@tsrx/le-truc` is dead and `.tsrx` publishes in a later 3.x, so any task naming the package or
treating `.tsrx` support as shippable at 3.0 is stale; (2) **template emission** (M27) is a v3.0
requirement on pioneer 2's critical path, and the **partial-readiness invariant** (ADR 0034 s4)
constrains every design in every band from here forward, not only P1's; (3) **LT-239 is resolved** ([ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md),
2026-09-19): the Simulated tier is **kept** and scoped **SSG-only for all of 3.x**, because a
simulated component's output cannot be expressed as a template and so never reaches pioneers 2
and 3. jsdom stays an optional peer dependency, but that policy has a prerequisite this file
must sequence — **LT-263, the seam** — without which the compiler cannot classify, report or
typecheck with the substrate absent. Substrate pluggability is **not built** until a candidate
passes the sanitizer criterion (ADR 0027 s2, amended). Consequences elsewhere: **LT-188 runs**
(the tier survives), and the CI equivalence audit is now documented as the *second* consumer of
`sim/` — tier-adjacent tasks must not treat the realm as two components' machinery.

**Standing framing** (ADR 0029, accepted 2026-09-04). Server evaluation is three tiers:
**Folded** (phase 1 resolves it; string folding, no jsdom), **Simulated** (phase 1 cannot
complete AND the realm can answer; pre-played in jsdom), **Static** (neither; static skeleton,
the client corrects at connect). Tier is per **component**; unresolvability is per
**expression** — an impure ambient read (`Date.now()`, `Math.random()`) is omitted in every
tier and is not a routing signal. The compile-warning baseline's target is **zero**: routing
signals ride the tier census on `sim/report.ts`, not the diagnostic channel. Judge a migration
on zero warnings *plus* its recorded tier and reason.

---

## P1 — The v3.0 release track: packaging, template emission, pioneer adoption (ADR 0034)

**Provenance:** the LT-241 owner grilling session (2026-09-19) and [ADR 0034](adr/0034-distribution-tsx-only-compiler-package-and-template-emission.md).
This band is **release-gating**: v3.0 does not ship until pioneer 1 is live on the published
package and template emission is verified against pioneer 2 (ADR 0034 s6, REQUIREMENTS §1
success criteria). It is placed above P2 for that reason, not because the work is larger.

**The fact that produced this band.** The compiler emits `*.client.ts`, `*.css` and
`*.server.ts` — a TypeScript module only a JS build can execute — so the Folded and Simulated
tiers have exactly one consumer runtime today: this repo's SSG docs site. Pioneers 2 and 3 are
CMS projects (Craft/PHP, AEM/Java) that cannot run it, and folding is build-time while CMS
markup is request-time. **LT-257 is the answer and it is on pioneer 2's critical path**; every
other task here is either what makes the package installable or what proves it worked.

**The standing invariant every task in every band must respect** (ADR 0034 s4, [M27](REQUIREMENTS.md#m27-backend-neutral-template-emission)):
a component's folded output may depend only on its own props and a **closed, enumerable set of
page-ambient values** — today the reserved `i18n` parameter's `lang`, `t`, `timeZone`,
`currency`, `dir`. A design that lets the fold read arbitrary page context forecloses template
emission and the CMS persona with it. LT-258 makes this checkable rather than remembered.

**[Amended 2026-09-19, owner — the publish date moves, and the band splits in two.]** The
earlier plan led with LT-254 on a squatting-risk argument. That argument does not apply:
`@zeix/le-truc-compiler` is in a namespace this project owns, so the name cannot be taken and
nothing about first publish is urgent. **The first publish happens no earlier than after the
P6 cleanup round** — publishing a package outside consumers cannot yet use is not a milestone,
and the pioneers being Zeix-owned does not change that. Consequently **LT-254, LT-259, LT-260,
LT-261 all sit behind P6**, and the P1 work that can proceed now is the part that has nothing to
do with distribution: the seams, the interfaces, and the de-TSRX-ification of a compiler still
shaped like this repo's internal tool. That part is **LT-271** (carved out of LT-254(c)),
**LT-263**, **LT-255 + LT-267**, **LT-256** and **LT-265** — the iteration opened in `TODO.md`.
**LT-262 and LT-264 are non-goals for 3.0 and have moved to P7.**

- [ ] LT-254: Stand up the publishable package `@zeix/le-truc-compiler` (TSX-only) and discharge the LT-206 packaging deferrals. **Gated on LT-287, LT-288, LT-274 and LT-276** (ADR 0040, accepted 2026-09-24: every reshape of a published IR type lands before the first publish, or it becomes a 4.0 change).
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s1–s2. The compiler ships separate from the browser-only
  `@zeix/le-truc`, named for its function rather than its input format. **v3.0 publishes the
  `.tsx` front end only** — `.tsrx` stays a first-class repo-internal surface under ADR 0032's
  parity contract and publishes in a later 3.x gated on `@tsrx/core` 1.0, so the published tree
  must not carry the pinned pre-1.0 parser as a runtime dependency.
  **Deliverable:** (a) register `@zeix/le-truc-compiler` on npm **before the first pre-release**
  — verified available 2026-09-19, and a package name is the one decision that cannot be revised
  after first publish; (b) the package manifest, entry points, and a build that excludes the
  `.tsrx` front end from the published artifact without deleting it from the repo; (c) the
  LT-206 deferrals, now scheduled rather than parked: the `check:tsrx`/`build:tsrx` script names,
  `server/effects/tsrx.ts`, the `server/generated/tsrx/` output directory, the `@tsrx/core`
  package names in internal APIs, and the `TSRX###` diagnostic codes — each either renamed to
  surface-neutral vocabulary or consciously kept, with the reason recorded. **Diagnostic codes
  become public API on first publish**: a code that keeps the `TSRX` prefix while the published
  surface is `.tsx` needs a stated rationale, and Tech Writer reviews the copy of anything
  renamed (channel: compiler; the error-message-lifecycle sweep applies).
  **Check:** `npm pack` on a clean checkout produces a tarball that installs into an empty
  project and compiles a single `.tsx` component, with no `@tsrx/core` in the dependency tree.
  **Added 2026-09-24 (ADR 0034 s8):** declare `@zeix/le-truc` as a peer dependency with a
  floor, and add a build check that every runtime export the emitted client modules import
  exists at that floor (resolve the imports against the floor version's published export
  list). State in `contract.ts`'s stability policy that adding a member to an IR union is a
  minor, and that exhaustive switching over IR unions is not covered.
  **Re-scoped 2026-09-19 (owner):** deliverable **(c) — the LT-206 deferral sweep — is carved out
  as LT-271** and runs now, because stripping TSRX-only vocabulary from a compiler whose published
  surface is `.tsx` is a shape problem, not a distribution problem, and it should not wait on a
  publish date. What remains here is (a) and (b): the npm registration and the package manifest,
  entry points and `.tsrx`-excluding build. **Gated behind the P6 cleanup round** — the namespace
  is owned, so the name cannot be taken, and there is no value in publishing a package an outside
  consumer could not yet use. LT-259, LT-260 and LT-261 inherit that gate.
  **Carried in from the LT-255 review (2026-09-19):** LT-255 shipped the corpus configuration
  surface without waiting for this task ([ADR 0036](adr/0036-corpus-configuration-surface.md)),
  so "where the config lives" is settled and no longer gates it. One line comes back here:
  **`runtimeImport`'s default must flip** from this repo's relative
  `'../../compiler/runtime'` to the published package specifier
  (`DEFAULT_RUNTIME_IMPORT` in `server/compiler/emit-paths.ts`), at which point consumers stop
  having to set the field at all. Until then every installing project must set it by hand —
  which is the single most visible "this is not published yet" seam in the config surface, and
  a reason the first pre-release should not be demoed without it.

- [ ] LT-257: Template emission — **the target-emitter interface, with Twig as its first implementation** ([M27](REQUIREMENTS.md#m27-backend-neutral-template-emission)). **Release-gating; pioneer 2's critical path.**
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s3. For a CMS, a folded HTML partial and a template are the same
  artifact: a Craft page's props are *content* — arbitrary title text, an entry list — so
  pre-folding per prop signature is combinatorially dead. What folding can do is resolve
  everything prop-independent and leave the props as **holes**, which is what a template is.
  **Scope change (owner, 2026-09-19, LT-239 follow-up; ADR 0034 s3 amendment, [ADR 0032](adr/0032-adopt-tsx-as-the-authored-component-surface.md) amendment):
  the deliverable is **a target-emitter interface with Twig as its first implementation**, not a
  Twig emitter. Only the interface is a 3.0 commitment; the set of targets is not. This is a
  scope sentence now and a rewrite later — HTL is already known to be coming, and a second target
  hard-coded against a shape never designed to have two is the expensive outcome. **Decide the
  interface before writing the first emitter**, not by extracting it from Twig afterwards.
  **Deliverable:** a third emission target beside the client module and the CSS — the
  component's markup with every prop-independent expression folded and every server arg emitted
  as a variable in the target's language. The interface carries at minimum: hole emission, the
  per-target escaping contract, and the unescapable-position refusal. Locale dimensionality is locale × component (ADR 0030 commits 3.0 to
  per-locale pages), so the emitter emits one partial per component per locale **or** one
  partial with a locale hole — the choice is the emitter's and must be recorded in the ADR
  either way.
  **The escaping contract is a security boundary, not a formatting detail.** The compiler
  becomes responsible for output encoding in a language it does not execute; a mis-encoded hole
  is an XSS in a consumer's page. The emitter places Twig's escaping at every hole, and a hole
  in a position Twig cannot escape safely is a **compile-time diagnostic** (channel: compiler;
  tier 1 Prevented per [ADR 0028](adr/0028-tiered-error-surfacing.md) s1) — never a silently
  unsafe emit. A per-target escaping test corpus is part of this task, not a follow-up. New
  diagnostic code: Tech Writer owns the final copy.
  **Depends on** LT-254 (where it ships), LT-258 (the invariant it relies on), LT-313 (the
  invariant's one unchecked fold position).
  **Check:** every corpus component emits a Twig partial; the escaping corpus passes, including
  the negative cases; **the interface is exercised by a second, deliberately trivial target**
  (even a debug/JSON dump) so "a second target needs no reshaping of the first" is tested rather
  than asserted; a Twig render of the partial with the same args produces output equivalent
  to the SSG fold (the same equivalence discipline [ADR 0029](adr/0029-tiered-server-evaluation.md) s7 applies to the two evaluation mechanisms).
  **ADR 0037 rider (2026-09-21):** the target-emitter interface must represent a reactive
  condition's prop-dependent initial state — a backend conditional or hidden-by-expression
  ([ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md), Related). Decide the
  representation with the interface, not retrofitted onto it.

- [ ] LT-259: The 2.x → 3.0 codemod, and the drift-cost measurement it instruments.
  **Skill:** le-truc-dev
  **Context:** ADR 0034 s6. Pioneer 1 is a Zeix SSG project migrated from Le Truc 2.x, and
  nothing in the queue covered `.ts` + `.html` + `.css` → `.tsx` until now. The owner's read,
  recorded because it scopes the task: the conversion is always possible — JSX reflects the
  static HTML, the factory body copies over verbatim and already runs, and deterministic
  transforms (inline event handlers, 1:1 effects) do ~80%.
  **It is codemod-assisted, not push-button, and must be documented as such.** The residue is
  chiefly resolving `first()` selectors to structural JSX — the hard cases land exactly where the
  old code was sloppiest, which is the drift the compiler exists to eliminate. Deliverable shape:
  a compiling `.tsx` plus a **report of what it could not resolve**, for judgement. At pioneer
  scale (~50 components) that residue is affordable; sold as push-button it disappoints on
  pioneer 1.
  **Second job — it is the measurement instrument.** The drift-cost data point is a before/after
  on the same components, so the 2.x baseline must be captured **before the codemod runs**.
  Define what is measured (the metric is the task's first decision, not an afterthought) and
  record it where REQUIREMENTS §1's criterion can cite it.
  **Check:** the codemod run over this repo's remaining hand-written twins, and over pioneer 1,
  produces compiling sources plus an honest residue report; the baseline exists before either run.

- [ ] LT-260: Pioneer 1 — take the Zeix SSG project live on the published package, through pre-releases. **Release gate.**
  **Skill:** architect
  **Context:** ADR 0034 s6; REQUIREMENTS §1 success criteria. This is the criterion that can
  actually fail: until a project outside `examples/` compiles through the published tool, every
  compiler line amortizes over 22 demo components. Verified through a **series of pre-releases**,
  so the feedback arrives while the API can still change.
  **Deliverable:** the migration executed with LT-259; the pre-release cadence and what each one
  is meant to learn; the drift-cost number captured and written into REQUIREMENTS §1; a recorded
  list of everything the engagement forced back into the compiler, since that list is the honest
  measure of how repo-shaped the tool still was. **Blocks the v3.0 release.**
  **Check:** the project is in production as the release showcase and builds from a published
  version, not a workspace link.

- [ ] LT-261: Pioneer 2 — verify template emission against the Zeix Craft (PHP) project. **Release gate.**
  **Skill:** architect
  **Context:** ADR 0034 s3/s6. LT-257 is the mechanism; this is the proof, and the owner has
  ruled it must pass **before v3.0 releases**. What is being verified is not that Twig files are
  produced but that a CMS page carries **real content in its initial HTML with no JavaScript**.
  **Deliverable:** the Craft integration — where partials land, how the build fits their
  pipeline, how the `i18n` ambient set is passed through the include; the escaping contract
  exercised against real content, adversarial cases included; a recorded list of what the
  emitter had to grow. **Depends on LT-257. Blocks the v3.0 release.**
  **Check:** JavaScript disabled, a Craft-rendered page shows content-bearing folded markup from
  a compiler-emitted partial; enabling JavaScript corrects nothing that was already right.

- [ ] LT-277: Seam hardening from the LT-267 review — glob dot-rule edges, `fileExists` contract, doc enumeration.
  **Skill:** docs-server-dev
  **Context:** the LT-267 review (2026-09-21) probed `server/runtimes/glob.ts` beyond the
  real-tree parity tests and found two edges where the seam's categorical claims do not
  hold, both verified live at 4097198c. Neither is reachable with any glob the repo or a
  realistic consumer writes today (they need an explicit-dot pattern segment, or a
  dot-prefixed path under a trailing `**`), but both contradict claims pinned in `glob.ts`'s
  JSDoc and `server/SERVER.md` — and the whole point of the shared translator is that these
  semantics are decided ONCE:
  1. **Trailing `**` matcher leak.** The trailing-`**` branch compiles to an unguarded
     `.*`: `matchGlob('mocks/**', 'mocks/.tmp')` and `matchGlob('**', '.hidden')` are TRUE
     while no scanner ever yields those paths — violating "a watcher filter cannot admit a
     file the scanner would never yield". Give the remainder the shape the interior `**`
     already uses (zero-or-more dot-guarded directory segments plus an optional dot-guarded
     file) and pin it with a test.
  2. **Explicit-dot scan patterns diverge per runtime.** `scanGlobSync` skips dotfiles
     unconditionally during the walk, but `Bun.Glob` yields files matched by an
     explicit-dot pattern segment (`new Bun.Glob('.env')` scans it; the walk returns `[]`).
     A consumer configuring a dot-prefixed source glob would get a different corpus under
     Bun than under Node — the exact divergence the seam exists to prevent. Decide at
     pickup: make the walk's skip rule pattern-aware (a pattern segment starting with `.`
     un-skips that level, matching Bun), or declare dot-prefixed patterns outside the
     grammar and reject them at config resolution. **Channel and tier (ADR 0028 s1) if
     rejected:** compiler/config resolution, tier 1 Prevented; if adopted, runtime seam
     semantics with parity tests, tier 2 Contained.
  3. **`node.ts` `fileExists` returns true for directories** (`access(F_OK)`) while the
     interface says "regular file exists" — the Bun impl matches the contract. Unreachable
     today (every caller passes a file path), but it is latent per-runtime divergence
     inside the seam itself; check the file type, not just existence.
  4. **Doc accuracy riders:** SERVER.md's "No Bun.* outside the seam" exception list omits
     `corpus-portability-check.ts` and `codemod-react-jsx.ts` under a "the only exceptions
     are" phrasing; and the portability check's diff report prints "first differing byte
     at N" where N is a code-unit index computed by a variable named `line`. One-line
     fixes. **Rider:** `scripts/i18n-sync.ts` still globs `examples/**/*.tsrx` only (the
     LT-267 handoff's unfiled residue) — fold here or into wave 4's migration of the first
     i18n-declaring `.tsx` component; until then it silently prunes nothing.
  **Check:** `server/tests/runtimes.test.ts` pins the trailing-`**` dot rule and the chosen
  dot-segment scan semantics on BOTH implementations; `check:portability` stays 3/3
  byte-identical.

## P2 — Internationalization follow-ups (ADR 0030)

**Pruned 2026-09-17** — LT-173 (reserved `i18n` parameter + catalog pipeline), LT-175
(render-cache measurement; its containment landed in LT-174, its removal ruling became
LT-193), LT-174 (per-locale page rendering), LT-190 (per-category message keys), LT-191
(locale inheritance, `lang` config-only), LT-192 (review residue) all landed and reviewed;
ADR 0030's corpus-multiplication consequences bullet was retracted in place 2026-09-07.
History: `git log -p`, ADR 0030, `CHANGELOG.md` `[Unreleased]`, and the compacted entries in
`DONE.md`. Two review
handoffs became tasks: **LT-201** (the ADR amendment; done — DONE.md) and **LT-189** (the
Tech Writer copy round, scope widened).

- [ ] LT-308: Key-type the reserved `i18n` record, then revert the intrinsic-attribute `undefined` widening (LT-237 review follow-up).
  **Skill:** le-truc-dev
  **Context:** `I18n.t` is `Record<string, string>` in both the `.tsx` host profile
  (`server/compiler/frontend/tsx/host-profile.d.ts`) and the generated `i18n.ts`. So
  under `noUncheckedIndexedAccess` every `t.<key>` read is `string | undefined`, although
  the build always supplies the source string. It also accepts any key: a typo like
  `t.fliter` passes tsc on both surfaces, no LTC rule checks keys, and it renders
  `undefined`. LT-237 unblocked `placeholder={t.filter}` by widening every intrinsic
  attribute to admit `undefined` (`Attr<T> = Reactive<T> | undefined`). That also
  silently admits a possibly-undefined `aria-label={maybeLabel}`, which tsc used to
  force a fallback for; the attribute now just disappears, an accessibility regression
  tsc no longer reports. Fix the cause instead:
  1. `interface I18n<K extends string = string> { t: Record<K, string>; … }` in the host
     profile, the `.tsrx` `globals.d.ts`, and the generated `i18n.ts`. The default
     keeps every existing annotation valid.
  2. Authors annotate `i18n: I18n<keyof typeof i18n>`. The args type is copied into the
     generated server signature, and the server module does not carry the `i18n` const
     (it imports only the `I18n` type). So the compiler rewrites the annotation to the
     literal key union it already knows from the `export const i18n` extraction, which
     keeps generated modules self-contained. The alternative, emitting the const into
     the server module, duplicates the fallback bytes the staleness manifest hashes.
     Rejected.
  3. Annotate every i18n-declaring component on both surfaces. Then revert `Attr<T>` to
     `Reactive<T>` and drop the `| undefined` on the plain attributes. Re-add
     `?? ''`-style fallbacks only where a value is genuinely optional (form-listbox's
     `aria-label={ariaLabel ?? ''}` already is).
  **Channel:** TypeScript, tier 1 Prevented, for an undeclared key on `.tsx` and in
  `check:corpus`'s generated program. No new LTC rule. Whether `.tsrx` authoring also
  wants a compiler-side unknown-key rule (the authored `.tsrx` is in no tsc program) is a
  separate question; raise it in NOTES.md if the generated-program check proves too
  late.
  **Check:** `placeholder={t.filter}` typechecks with `Reactive<string>` attributes;
  `t.fliter` fails tsc in the examples program and in `check:corpus`; a temporary
  `aria-label={maybeUndefined}` fails again; the parity suite and goldens show only the
  annotation change; HOST_PROFILE.md's i18n paragraph shows the annotated spelling.

- [ ] LT-218: The client-message `i18n` attribute — compiler analysis, server emission, client evaluator preamble (ADR 0030 sub-design 9). **Depends on LT-250.**
  **Skill:** le-truc-dev
  **Sequencing (re-ruled 2026-09-19):** two gates, one now discharged. Land the P2b
  SurfaceAdapter consolidation (**LT-233**) first — it collapses the two copied front ends this
  task must edit in lockstep. The **LT-240** message-model gate is **resolved** (owner ruling
  2026-09-19, ADR 0030 amended): the grammar is ICU MessageFormat 1, and the serialization
  shape is **the build-parsed AST**, not the raw pattern and not a compiled function. Land
  **LT-250** (the parser, the shared evaluator, the server fold) before this task — it supplies
  the AST shape this task serializes and the evaluator this task inlines.
  **Context:** Implements the LT-197 ruling. Three pieces; both authored surfaces stay in
  lockstep (ADR 0032 anti-drift) — the classification lives in the shared analysis, the
  per-front-end diagnostics as today.
  1. **Analysis:** admit `t.<key>` reads in client positions — event handlers, reactive
     thunks, `truc:html` thunks, expose get/set, `defineMethod` bodies, pass get/set — the
     positions the server-only name diagnostic rejects today. Literal/static keys only; a
     computed `t[dynamicKey]` stays rejected (tier Prevented). `lang` stays server-only, its
     message pointing at `host.lang`. The `t` face of the server-only rejection retires for
     these reads — a false-negative removal from an existing check, no new error class
     (retirement sweep is LT-220's).
  2. **Emission:** when the component's client-referenced key set is non-empty,
     `emit-server.ts` appends `attr('i18n', JSON.stringify({ …picked… }))` to `rootParts` —
     the materialized-`lang` precedent — evaluated per render call, so each locale bakes its
     own **parsed patterns** and compose-graph inheritance applies unchanged. An
     argument-less message serializes as a plain string (unchanged); a message with
     arguments serializes as LT-250's compact AST. Only client-referenced keys (owner
     ruling): a server-folded key never rides the attribute. The root-attribute exclusion
     covers LTC039; authored `i18n` attributes are already rejected in classify-attributes.
  3. **Client preamble:** the generated client factory gains an inlined, guarded
     `JSON.parse(host.getAttribute('i18n'))` merged over the declared source-locale record,
     which the compiler emits already parsed for the same keys — NO new `@zeix/le-truc`
     export (ADR 0030 s8). Alongside it the compiler inlines **LT-250's evaluator, narrowed
     to the constructs this component's patterns actually use** — an interpolation-only
     component gets a concatenation; `Intl.PluralRules(host.lang)` does category selection;
     nobody pays for `select` or date formatting unless used. No ICU parser on the client,
     no `eval` (CSP-clean). Client-position `t.key` reads rewrite to the local; a call site
     is validated by LT-250's diagnostic. Parsed once at connect, fixed for the connection;
     malformed JSON warns in DEV_MODE and falls back to the source record in production.
  **Pins:** the attribute carries only client-referenced keys (a folded-only key stays off
  it); absent when the set is empty (a component without client-evaluated messages renders
  byte-identical — pin one); a de render bakes translated **parsed** patterns into the
  attribute; the inlined evaluator is narrowed (a component with no plural message emits no
  `Intl.PluralRules` call — pin by fixture);
  parity green with identical attribute bytes across both surfaces; a client-created
  instance (attribute stripped) falls back to the source record (jsdom pin); the DEV_MODE
  malformed-attribute warning pins.
  **Acceptance:** tier census 20/2/0 and compile-warning baseline 0 unchanged (client keys
  are not a routing signal); gates green (typecheck, `bun test server/tests`, check:tsrx,
  build:docs, check:links). Corpus snapshots should not move yet — no corpus component has
  client-position `t` reads until LT-219; pin via fixtures.

- [ ] LT-219: Corpus adoption — tokenbox + colorgraph event-time strings; retire the carrier-span idiom; census placeholder check. **Depends on LT-218.**
  **Skill:** le-truc-dev
  **Context:** The corpus's event-time strings (LT-195's survey; ADR 0030 s9):
  - **form-tokenbox**: declare `added`/`removed`/`duplicate` message patterns
    (`'Added token: {token}'`, `'Removed token: {token}'`, `'{token} is already in the
    list'` — the duplicate-validity message is user-visible via `setCustomValidity`; the
    platform's own `validationMessage` reads stay as-is, browser-localized); route the two
    status-region writes and the duplicate `setCustomValidity` through `t.<key>({ … })`.
    The header's "deliberately NOT here" comment shrinks to the validationMessage note.
  - **form-colorgraph**: `outOfGamut` key; the three `setCustomValidity('Color out of
    gamut')` sites route through `t.outOfGamut`.
  - **form-spinbutton**: retire the hidden `.increment-label` carrier span — the thunk reads
    `t.increment`/`t.decrement` directly (the LT-195 interim idiom, superseded by ADR 0030
    s9; owner ruling: retire in this landing). The keys become client-referenced; the span
    and its read-back die.
  - `i18n:sync` records the new keys; de gains real translations with placeholders
    preserved („Token hinzugefügt: {token}" shape); extend the i18n.test.ts de fixture pins
    to the attribute + patterns.
  - **Census pattern-integrity walks (ADR 0030 s5, re-ruled 2026-09-19):** two new
    `TranslationGap['status']` cases, both report channel — not warnings, translator-paced,
    same reasoning as missing/stale/orphaned; Tech Writer owns wording, batch with LT-189
    item 8. (a) **argument preservation** — a translation whose argument set differs from the
    source pattern's; (b) **plural-arm coverage** — a translation whose `plural` arms do not
    cover `Intl.PluralRules(lang).resolvedOptions().pluralCategories`. A third case,
    **unparseable pattern**, falls back to the source pattern and reports — it must NOT fail
    the build (a translator typo cannot make a locale unbuildable; same ruling as a missing
    key). `i18n:sync` flags all three and can auto-fix none. Follow the LT-196 pattern for the
    inverse-walk tests: falsification probes over the real catalogs, injectable for units.
    **Note this replaces, not extends, the deleted reachability carve-outs** (LT-251) — the
    census gets simpler in shape, not smaller in line count.
  **Verification:** payload pinned — the sim-driver tokenbox snapshot carries the
  attribute, asserted to stay in the low hundreds of bytes (the ADR's measure); translation
  census 0 gaps on the real corpus with the placeholder walk live; tier census 20/2/0;
  warning baseline 0; Playwright tokenbox spec green (status strings announce in en/de);
  gates green (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links).

- [ ] LT-220: Docs round for the ICU message model and the client-message channel — HOST_PROFILE, compiler doc, diagnostic sweep, CHANGELOG. **Sequence with or after LT-189 (batches into its one-voice copy round); scope widened 2026-09-19 by the LT-240 ruling.**
  **Skill:** tech-writer
  **Context:** The copy/docs obligations ADR 0030 s4/s5/s6/s9 leave behind; the error-message
  lifecycle applies (diagnostic faces retired, new TSRX codes gained).
  0. **The message model itself** (new, LT-240): messages are ICU MF1 patterns; `t.key` is a
     string or `t.key({ … })` a call; plurals/`select`/inline formatting live in the pattern.
     The per-category key convention and `truc:case`/`truc:case-type` are **retired** — remove
     their teaching outright rather than deprecating it, and state the replacement for exotic
     variance (a ternary, or `@if`/`@switch`). State the type caveat explicitly: `t` is
     `string | ((args) => string)` and **authors must not rely on the wider type**, because
     per-key precision arrives later and tightens it.
  1. HOST_PROFILE.md: the i18n section re-taught — client-position `t` reads, the root
     `i18n` attribute carrying parsed patterns, and the `t.key({ … })` call syntax; the
     carrier-span idiom's teaching REPLACED (superseded, not deprecated — remove the LT-195
     interim guidance, point at ADR 0030 s9).
  2. LE_TRUC_COMPILER.md: the classification (client positions, literal keys only), the
     emission point, the census paragraph's two pattern-integrity walks, and the removal of
     the pruning/`pluralCategories` description.
  3. The retired `t` face of the server-only diagnostic: sweep
     `.agents/skills/le-truc/references/errors.md` and any prose teaching "`t` is
     server-only" — the retirement counts per the lifecycle.
  4. Final copy: the pattern-placeholder TSRX code (drafted in LT-218), the census
     placeholder-mismatch wording (drafted in LT-219), the computed-`t[dynamicKey]`
     wording if split from the generic message. Batch with LT-189 items 2–8.
  5. CHANGELOG `[Unreleased]` Added bullets (client-string channel, patterns, census
     check); an AGENTS.md "Surprising Behaviors" i18n bullet if the changed `t`-in-thunk
     rule warrants one.
  **ADR 0037 rider (2026-09-21):** this round also carries the branch-DOM-lifetime copy —
  the HOST_PROFILE control-flow table row and the arrow-thunk section's reversal, the
  ARCHITECTURE/AGENTS "`@if` cannot read signals" sentences, and the new construct's
  teaching ([ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)).
  **Check:** `check:links` after doc moves; errors.md's entry inventory matches the
  diagnostics union (code added, none deleted — the `t` face was message scope, not a
  code).

- [ ] LT-189: Tech Writer round — `ContextRequestEvent` cross-realm docs plus the standing i18n copy handoffs.
  **Skill:** tech-writer
  **Context:** Three copy items queued from landed work; batch them so the messages read as
  one voice. All follow `workflows/error-message-lifecycle.md`.
  **S0 hold — RESOLVED 2026-09-19 (LT-240 ruled: ICU MF1).** Consequences for the held items:
  **item 2 is WITHDRAWN** — the dotted-key CLDR shape rule is deleted by LT-251, so LTC008's
  message is retired rather than reworded; the retirement still runs the error-message
  lifecycle sweep (that is LT-251's obligation, verified here). **Item 8 proceeds**, with one
  amendment: the orphan census/sync copy must no longer reference reachability or plural
  categories — every locale now carries the same key set, so an orphan is unconditional.
  LT-219's census wording is no longer "placeholder preservation" but the three cases in that
  task (argument preservation, arm coverage, unparseable). The non-i18n items (1, 3–7, 9, 10)
  were never held.
  **ADR 0037 rider (2026-09-21):** batch item — the LTC005 condition-face retirement message
  and [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)'s new codes join
  this round's one-voice copy handoffs (drafted in LT-275).
  1. **`ContextRequestEvent`'s cross-realm dispatch** (LT-180 review finding):
     `requestContext()` now builds the `context-request` event from the HOST's own realm
     whenever the exported class does not belong to it (`src/helpers/context.ts`, LT-180).
     The class stays exported and unchanged, and in the normal same-realm case it is still
     what gets dispatched — but in a cross-realm host (an iframe, the build's simulation
     realm) the dispatched object is a duck-typed `Event` carrying
     `context`/`callback`/`subscribe`, so a provider written as
     `if (e instanceof ContextRequestEvent)` would stop matching. This is
     protocol-conformant — the Web Components Community Protocol specifies the event's
     fields, not its class, and Le Truc's own `provideContexts()` reads the fields — so it
     is a documentation gap, not an ADR question (Architect ruling, 2026-09-06). Scope: the
     JSDoc on `ContextRequestEvent` and on `requestContext()`, plus the context section in
     `docs-src/pages/` and the `le-truc` skill's context reference. One rule to state: a
     provider checks `event.context`, never `instanceof`.
  2. ~~**LTC008's dotted-key message** (LT-190 handoff)~~ — **withdrawn 2026-09-19.** The
     rule the message documents (a dot-suffix must name one of the six CLDR categories) is
     deleted by the LT-240 ruling; the code is retired in LT-251, which owns the lifecycle
     sweep. Nothing to word here.
  3. **LTC047's literal-prose warning** (LT-173 handoff): final copy; the single-letter
     exemption (page data, not prose) must survive the rewording, and the missing-
     *translation*-rides-the-census distinction is the point of the message.
  4. **LTC048's duplicate-tag error** (LT-202 handoff): final copy over the draft in
     `server/compiler/diagnostics.ts` — one tag, two corpus sources, both files named; the
     "whatever surface it is written in" clause is the dual-front-end fact the message
     teaches.
  5. **The three-arm `boundary` diagnostic wordings** (LT-202 handoff, amended by
     LT-211/208): the arm-shape errors in `server/compiler/frontend/tsx/lower-tsx.ts`
     (missing/ill-typed arms, single-root rule per arm, err-arrow requirement) — final
     copy; the four-arm vocabulary is gone (owner withdrawal, 2026-09-18), so the copy
     covers the three arms plus LT-209's new LTC049/LTC050 drafts in
     `server/compiler/diagnostics.ts`. Batch with items 2–3 so the diagnostic families
     read as one voice.
  6. **The TSRX020 retirement copy** (LT-210 handoff, 2026-09-18): the retirement note
     in `server/compiler/diagnostics.ts`'s code union, TSRX018's reworded fix-it
     (`&{`/`&[` no longer introduce anything under the 0.2 pin — drafted, final copy
     owed), and the propagation sweep the retirement leaves behind (per
     `workflows/error-message-lifecycle.md`): HOST_PROFILE.md's lazy-destructuring
     section, LE_TRUC_COMPILER.md §106/§184, and `.agents/skills/le-truc/references/errors.md`
     were updated in the bump commit — verify voice consistency across them. Batch
     with items 2–5.
  7. **The LT-215 reactive-list body diagnostics** (2026-09-18): `validateListBody` in
     both front ends reworded — the admitted server-static class dropped the
     "milestone-3 subset" phrasing for a statement of what the slot-fill contract
     actually reserves (per-item values), and the rejections now name the offending
     reads (`reads item, which derive per item or client-side`). The stale `&{item}`
     sigil spellings in the touched messages modernized to `{item}`. Final copy over
     the drafts in `frontend/tsrx/lower-template.ts` and `frontend/tsx/lower-tsx.ts`;
     batch with items 2–6 so the compiler families read as one voice.
  8. **The LT-196 orphaned-key copy** (2026-09-18): the census reason line in
     `server/compiler/sim/report.ts` (first draft: `orphaned — nothing in the corpus
     declares this key; the entry can never render` — a report record like
     missing/stale, so the wording names the subject, the fact, and stops; census
     records never carry fix-its) and the sync summary line + header step 3 in
     `scripts/i18n-sync.ts` (first draft: `N orphaned key(s) PRUNED — nothing in the
     corpus declares them, so they could never render`). Propagation sweep per
     `workflows/error-message-lifecycle.md`: HOST_PROFILE.md's census sentence,
     LE_TRUC_COMPILER.md's census paragraph, and the CHANGELOG Added bullet must
     read as one voice with the final wording. **Sequence with LT-217**, which
     narrows the carve-out to declared keys and rewords the sync header step 3 and
     the ADR 0030 s5 orphan-direction sentence itself — run item 8 after it (or
     accept a second pass over those two spots).
  9. **The `class:`-prefix rejection copy** (LT-222 handoff, 2026-09-18): the new
     LTC006 reason in `server/compiler/classify-attributes.ts` (first draft:
     "`class:token={…}` is not a TSRX spelling — a per-class reactive binding is a
     class map: `class={() => ({ token: value })}`. A `class:token` attribute
     renders into the markup verbatim and the browser ignores it."). No new code —
     the existing malformed-attribute channel carries it — but the copy is new, and
     both prior spellings were SILENT, so the fix-it line is the load-bearing part.
     Batch with items 2–8.
  10. **The union restructure** (LT-223 handoff, 2026-09-18): retirement treatment
     standardized to the keep-member form the lifecycle doc prescribes — `TSRX020`
     is a kept member again (was deleted-with-comment, the file's one outlier),
     `LTC031` keeps its member with an expanded note, and `LTC004`/`013`/`043`
     left the `DiagnosticCode` union for tier.ts's named `RoutingSignalOrigin`
     (they are census origins, not emitted codes; position comments mark where the
     numbers are spent). Check `.agents/skills/le-truc/references/errors.md` and the
     lifecycle doc itself still describe the treatment accurately.
  11. **The `swapSlots` failure-reason rewording** (LT-178 handoff, moved here from the
     DONE.md entry 2026-09-21): final copy for the reworded `InvalidPassPropertyError`
     reason ("could not be resolved to a signal — pass() accepts a thunk () => … …"),
     the CHANGELOG `[Unreleased]` Removed entry's wording, and the `errors.md`
     `InvalidPassPropertyError` row — its "unresolvable to a signal" condition now also
     means "retired form" (property-key and bare-signal forms, including bare read-only
     `Memo`/`Task`), and the fix-it column may name the accepted forms.

- [ ] LT-250: ICU MessageFormat — the build half: parser dependency, AST, shared evaluator, server fold, argument diagnostic (ADR 0030 s4). **Gated by LT-233 (SurfaceAdapter); gates LT-218, LT-251, LT-252.**
  **Skill:** le-truc-dev
  **Context:** The LT-240 ruling (owner, 2026-09-19; ADR 0030 s4 amended) in code. A message
  value becomes an ICU MF1 pattern; `t.<key>` resolves to a string when the pattern takes no
  arguments and to a function of its arguments when it does.
  1. **Parse, don't compile.** Add `@messageformat/parser` as a **devDependency** (build-time
     only), plus `@messageformat/number-skeleton` / `@messageformat/date-skeleton` where
     skeletons appear — they resolve to plain `Intl` options at build time, so nothing
     skeleton-shaped survives into the AST. `@messageformat/core` goes in as a **test oracle
     only** and must not be imported from `server/compiler/` production paths (pin that with
     a dependency test).
  2. **One evaluator, ours, used by both sides.** A compact AST walk over the parsed pattern.
     `Intl.PluralRules` / `NumberFormat` / `DateTimeFormat` do the locale work. The SAME
     evaluator runs the server fold and is inlined into the client preamble by LT-218 — the
     point of owning it is that a server-rendered string and the client's recomputation
     cannot disagree. Keep it emitter-agnostic and free of compiler imports so LT-218 can
     inline a narrowed form of it.
  3. **Fold at render.** `t.key({ … })` with server-known arguments folds in the value
     harness like any other call (`evaluability.ts` — new node shape, existing rule). A
     message with client-reactive arguments is left to LT-218's channel.
  4. **Argument validation** — the compiler checks a call site's arguments against the parsed
     pattern's argument set: **new TSRX code, tier 1 Prevented, error** (statically decidable,
     author-fixable; Tech Writer owns copy, batch with LT-189). Lives in the shared
     post-lowering pass so it cannot drift between the two authored surfaces. A computed
     `t[dynamicKey]` stays rejected, unchanged.
  5. **Types stay loose deliberately.** `t` is `string | ((args: …) => string)`; per-key
     precision via compiler-generated `.d.ts` is explicitly deferred (owner ruling: build-time
     diagnostics suffice for v3). It is additive to every artifact here — but it TIGHTENS the
     type, so the "do not rely on the wider type" note is an LT-220 obligation, not optional.
  **Check:** the evaluator's server output is differentially tested against
  `@messageformat/core` over the corpus patterns plus a negatives set (this is what the oracle
  is for); folded markup for an argument-less message is byte-identical to today's; gates green
  (typecheck, `bun test server/tests`, check:tsrx, build:docs, check:links); warning baseline 0;
  tier census unchanged (a folded message is not a routing signal).

- [ ] LT-251: Delete the per-category machinery — `truc:case`, pruning, `pluralCategories`, the dotted-key rule, the census reachability carve-outs. **Depends on LT-250 and LT-252 (nothing may still author the retired vocabulary when this lands).**
  **Skill:** le-truc-dev
  **Context:** The deletion half of the LT-240 ruling (ADR 0030 s5/s6 amended). Survey at
  ruling time: **86 references across 25 non-generated files.** Not all are deletions — count
  it as the touch set, not the win.
  - **Vocabulary:** `truc:case` / `truc:case-type` out of `classify-attributes.ts`, `ir.ts`,
    `validate-lowered.ts`, `registry.ts`, `runtime.ts`, `assemble-ir.ts`, both front-end
    lowerings, and both surface profiles (`frontend/tsx/host-profile.d.ts`,
    `frontend/tsrx/globals.d.ts`).
  - **Pruning:** ADR 0030 s6's per-locale alternative pruning in `emit-server.ts` and its
    `pluralCategories` plumbing — including the cardinal∪ordinal union fallback, which has no
    successor because the pattern states which type is in play.
  - **Census:** the reachability carve-outs in BOTH walks (the LT-190 missing/stale direction
    and the LT-217 orphan direction), and the registry's case-type input to them. Every locale
    now carries the same key set; an orphan is unconditional.
  - **Shape rule:** the `<key>.<category>` convention and its CLDR-category validation;
    **LTC008 retires** (LT-189 item 2 withdrawn accordingly). Retirement runs
    `tech-writer`'s `workflows/error-message-lifecycle.md` in full — keep-member treatment in
    the `DiagnosticCode` union per LT-223, and sweep
    `.agents/skills/le-truc/references/errors.md`, HOST_PROFILE.md and LE_TRUC_COMPILER.md.
  **Docs:** the authoritative documents were swept on 2026-09-24 (HOST_PROFILE.md,
  LE_TRUC_COMPILER.md, SERVER.md, ADR 0032/0041). Still owed here: `CHANGELOG.md`
  [Unreleased] drops its `truc:case` and per-category-key Added entries (the feature
  never ships), via `changelog-keeper`.
  **Check:** `grep -r "truc:case\|pluralCategor\|caseType"` over non-generated sources returns
  nothing outside the retirement notes; no fixture still pins per-locale pruned markup; gates
  green; warning baseline 0.

- [ ] LT-252: Corpus and catalog migration to ICU patterns — `basic-pluralize` (both surfaces), six locale catalogs, manifest rebaseline. **Depends on LT-250; gates LT-251.**
  **Skill:** le-truc-dev
  **Context:** The ruling's own check: *every component authored against `truc:case` is a
  component rewritten.* At ruling time that is exactly one — `basic-pluralize`, in
  `examples/basic/pluralize/basic-pluralize.tsrx` and its `.tsx` twin — which is why the
  ruling landed on 2026-09-19 rather than after the next authoring.
  - **Component:** the six `truc:case` spans plus their six `hidden` thunks collapse to one
    element and one thunk: `{() => t.tasks({ count: host.count })}`. The `.none` / `.some`
    split and the `ordinal` prop survive (ordinal selection moves inside the pattern via
    `selectordinal`). Both surfaces stay byte-identical per the ADR 0032 parity contract.
  - **Catalogs:** rewrite `i18n/{ar,cy,de,lv,pl,zh}.json` — `basic-pluralize.task.{zero,one,
    two,few,many,other}` collapse into one `basic-pluralize.tasks` pattern per locale.
    **The six-category locales (ar, cy) are the real test**: their arms move inside the value,
    which is the whole point. de's four category keys become one.
  - **Manifest:** this is the ADR 0030 s5 **sanctioned rebaseline** — sources, translations and
    `i18n/manifest.json` change in ONE commit, so no translation is marked stale for a change
    that altered no meaning. Say so in the commit message; it is the precedent the MF2
    migration will cite.
  **Check:** translation census 0 gaps across all six locales with the new pattern walks live;
  rendered markup for an en page shrinks from six spans to one (pin the byte delta — it is the
  ADR's headline consequence); `basic-pluralize.spec.ts` green in en and de; tier census 20/2/0
  (the component must stay Folded); parity green across both surfaces.

- [ ] LT-253: MF2 migration insurance — round-trip fixtures and the documented rebaseline procedure. **Depends on LT-252.**
  **Skill:** le-truc-dev
  **Context:** ADR 0030's Alternatives records MF1 as a deliberate bet with a kept-open exit:
  `@messageformat/icu-messageformat-1` parses MF1 into the MF2 data model and `messageformat@4`
  serializes it, both from the same maintainers. The bet is only cheap if the exit is *tested*
  rather than asserted. Cost grows with pattern and locale count, so build the harness while
  the corpus is one component.
  - A test that walks every corpus pattern MF1 → MF2 → renders both → asserts identical output
    for a matrix of argument values across all six locales. This is the claim "the migration is
    mechanical," turned into a gate.
  - Pin the two known-lossy spots explicitly: **nested-to-flat arm expansion** (MF1 nests
    plural-inside-select; MF2 uses one flat multi-selector, so arms multiply out — semantically
    identical, textually larger) and **escaping** (MF1 `'{'` quoting vs MF2 `|literal|` /
    backslash — where codemods go subtly wrong). At least one fixture per spot.
  - Write the rebaseline procedure down beside the fixtures, citing LT-252's commit as the
    precedent: one commit, sources + translations + manifest together.
  **Check:** the round-trip suite is green and is wired into `bun test server/tests`, so an MF1
  pattern the exit cannot carry fails at authoring time rather than at migration time.

---

## P2b — Compiler product-readiness: equivalence contract, consolidation, library substitutions (external review + reflection, 2026-09-18)

**Provenance:** [COMPILER_REVIEW.md](COMPILER_REVIEW.md) — an external review of all of
`server/compiler/` (46 modules, ~21.9k lines) by Claude Opus, evaluated by the Architect
2026-09-18. **The review held up:** all four correctness findings (§1) were independently
verified against the source (two by direct read — the `offenders`-array truthiness bug at
`frontend/tsx/lower-tsx.ts:641`, the `resolveComposeRefs` IR mutation at
`analysis/compose-refs.ts:118`; the rest via a verification pass), and a 16-claim structural
spot-check came back 13 clean / 3 with minor count drift and zero refutations
(`emitServerModule` is ~1,076 lines, not 993; the estree walks number 12, not ~11; the
drivers' early-exit literal appears 6× per file, multi-line). Task text cites the review's
section numbers; its file:line citations were accurate at capture except where noted —
`front-end.ts` has since been split (LT-224, done — see DONE.md) and `emit-server.ts` has
been refactored (LT-225), so re-grep before trusting line numbers in those files.

**Re-scoped 2026-09-18 by [COMPILER_REFLECTION.md](COMPILER_REFLECTION.md) under the framework
premise (S0):** the equivalence contract is a product promise to users of both surfaces, so the
parity suite's diagnostic blind spot closes first (LT-242); and where a maintained library
already IS the shared thing the review proposed authoring, **adopt the library instead of
writing version twelve** (reflection §5) — LT-229/LT-231 re-pointed, LT-243/LT-245/LT-247 added.
**Sequencing (re-ruled):** LT-221–LT-226 (defects + dead surface + diagnostics hygiene + the
first two splits) are done (compacted in DONE.md). Planned pick order: **LT-242 first** (the
diagnostic-parity net — it then
verifies LT-233's message consolidation), **LT-233 before LT-218** as before; the
behaviour-preserving mechanical moves (LT-227/228) stay interleavable with feature work;
wave ordering holds (LT-228 before LT-229/LT-232, which name the files it creates); the library
substitutions (LT-243/LT-229/LT-231/LT-245) no longer sit behind S0's LT-239 — it is resolved
(ADR 0035: the tier is kept, SSG-scoped), so tier/evaluability-adjacent items proceed, coordinating
with **LT-263** where they touch `sim/report.ts`, `sim/patch-table.ts` or the realm's type surface; LT-247 after LT-234 (both
touch `spans.ts`); LT-246 after the wave-3 churn so the report format settles once; **LT-235 is
a grilling session, not cleanup** (its item (e) is carved out as LT-244). **No ADR is owed for
the mechanical band** — nothing there changes a documented decision (review §3; Architect
concurs); **LT-242 amends the ADR 0032 equivalence contract** and carries its adr-keeper pass.
**Declined with the review, recorded so future reviews don't re-propose:** memoising the §2.11
redundant traversals (not a measured problem; a second implicit-consistency contract is the
disease being treated) and restructuring `sim/` (§2.12 is doc/type-surface honesty, folded into
LT-222). The review's "LT-222+" numbering assumed LT-221 was taken; it wasn't.

- [ ] LT-242: Extend the parity suite to diagnostics — the equivalence contract covers failed compiles too (ADR 0032 amendment).
  **Skill:** le-truc-dev
  **Context:** Reflection §2 (rank #2 of its list; cheap). The parity suite — the same component
  authored in both surfaces must render byte-identically — tests successful renders. **All three
  live drifts COMPILER_REVIEW §2.3 documented live in the diagnostic path**, where the parity
  suite could not have caught any of them (the `offenders` truthiness bug — fixed LT-221; the
  `keyName` arm — ruled grammar asymmetry, LT-221; the per-item `ref` message — closes in
  LT-233). Under the framework premise the equivalence contract is a **product promise to users
  of either surface**: the same invalid component must produce the same code and the same
  message text, or one surface teaches its users lies the other never hears. This is cheaper
  than the `SurfaceAdapter` refactor and catches the class the refactor is meant to prevent —
  it also then verifies LT-233's message consolidation, which is why it runs first.
  **How:** extend `server/tests/compiler/tsx/parity.test.ts` (or a sibling) to compile a set of
  invalid fixtures through both front ends asserting equal `DiagnosticCode` + equal message
  text. Surfaces legitimately differ in vocabulary fragments (surface-register words and the
  like) — define that allowlist explicitly as a table in the test; LT-233's `SurfaceWording`
  fold then shrinks it toward zero where the review's item 14 says it should. Seed with
  negative pins for the three §2.3 shapes plus a sample of each diagnostic family.
  **ADR:** this amends the ADR 0032 equivalence contract (the s6 anti-drift statement) —
  adr-keeper pass in the same change; the contract sentence in `ARCHITECTURE.md`
  § Authoring Surfaces gains "and diagnose identically."
  **Verification:** the three §2.3 shapes are pinned (two already fixed — the pins prove they
  stay fixed); `bun test server/tests` green; `check:links` after the doc touches.
  **ADR 0037 rider (2026-09-21):** seed coverage includes the LTC005 condition-face
  retirement and [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md)'s new
  codes — both surfaces must diagnose reactive-condition shapes identically from day one.

- [ ] LT-233: `SurfaceAdapter` + shared `runFrontEnd` — collapse the copied front-end drivers. **GATES LT-218 (P2, with S0's LT-240): land before it.**
  **Skill:** le-truc-dev
  **Context:** Review §2.3/§3 item 14. `compileSource` (`frontend/tsrx/compiler.ts:199`)
  and `compileSourceTsx` (`frontend/tsx/compiler-tsx.ts:106`) are the same eight-step
  script — the setup slice, `decl.body.type`, three message strings, and a
  verbatim-duplicated ~200-character async-rejection message are the only differences;
  the early-exit literal repeated 6× per driver collapses into the shared driver. Same
  for the `lowerFor`/`lowerListFor`/`validateListBody` triples: header parsing genuinely
  differs, the program after `itemName`/`iterableName` is one — this copied seam is
  where the §1.1 and §1-(5) drifts happened. Shape: a `SurfaceAdapter`
  (`componentBodyType`, `splitSetupAndOutput`, `stylesheetOf`, `outputShapeLabel`,
  `lowerChildren`, `lowerElement`, `preScans`) + `runFrontEnd(ctx, ast, adapter)`; each
  `compileSource*` becomes parse + adapter + call. Fold `SurfaceWording`
  (`lower-shared.ts:56` — three strings while ~30 surface-specific fragments sit inline
  at call sites) into one complete surface vocabulary; the current version is worse than
  nothing (anti-drift theatre). The per-item `ref` message drift (.tsx generic vs .tsrx
  explicit rejection) closes here; final wording batches with the LT-189 compiler
  families. Runs after LT-242 so the diagnostic-parity net catches any message drift
  this consolidation could introduce.
  **Verification:** goldens + parity byte-identical (the parity suite is the standing
  cross-surface contract); the LT-242 diagnostic-parity pins stay green; warning
  baseline 0; census 20/2/0; full gates green.

- [ ] LT-227: Split `runLoops` and `runHarvest` at their existing pass banners.
  **Skill:** le-truc-dev
  **Context:** Review §2.1. `runLoops` (433 lines) is two unrelated algorithms separated
  by a `// --- Pass 1b` banner → `runEachLoops`/`runReconcileLoops`. `runHarvest` (628)
  Pass 2 (~240–378) already produces the `Site[]` + `thunkRendered` that Pass 3 consumes
  — make it a return type: `collectRenderSites`/`planHarvests`.
  **Verification:** goldens + parity byte-identical; full gates green.

- [ ] LT-228: Split `ast-utils.ts` into `vocabulary.ts` + `ast-utils.ts`.
  **Skill:** le-truc-dev
  **Context:** Review §2.2 tail. A ~420-line name-table module (~17–438) and an
  AST-helper module (~442–765) share one file, and DOM knowledge
  (`DIRTY_FLAG_CONTROL_TAGS`) that is emitter business sits in the shared layer — move it
  emitter-side. Primes LT-232 (derive the subsets) and gives LT-229/LT-231 homes named
  for what they hold.
  **Verification:** goldens + parity byte-identical; typecheck (import paths move); full
  gates green.

- [ ] LT-229: One shared estree walk on `eslint-visitor-keys` — retire the twelve hand-rolled skip-lists (reflection §5 supersedes the review's author-it-yourself item 10).
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 10, re-pointed by reflection §5: where a maintained library
  already IS the shared thing, adopt it instead of writing version twelve. Twelve
  `Object.entries` walks (`module-scans.ts`
  ×3 — ex-`front-end.ts`, LT-224,
  `analysis/reactivity.ts`, `evaluability.ts` ×3 — compiler root, not `analysis/`,
  `analysis/tier.ts`, `ast-utils.ts`, `frontend/tsrx/compiler.ts`, `analysis/harvest.ts`
  ×2) carry five different skip-lists; only `ast-utils.ts:676` skips type positions
  today. **Re-frame under the framework premise: external users author TSX constructs the
  corpus never saw — the skip policy is exactly where hand-rolled answers break, and
  `eslint-visitor-keys` is that answer, maintained against every estree node type.** The
  shared walk takes its key set from `eslint-visitor-keys` (walker body may still be
  `estree-walker`/`zimmerframe` or ~30 lines in-house — the KEYS are the borrowed part);
  EACH site migrates
  preserving its current behavior, and converging divergent answers (notably: do we
  descend into type positions?) is an explicit per-site decision with a test or a stated
  no-op rationale — silently converging could change analyses. Migrating
  `reportLeTrucImportMismatch`'s inner visit (`module-scans.ts`) onto the shared walk fixes
  a latent bug for free: the copy lacks the `ForStatement`/`ForOfStatement`/`CatchClause`
  cases `freeIdentifiers` later grew — pin the corrected behavior. Browser purity (M25):
  `eslint-visitor-keys` is pure data — confirm no node-only import path before adopting.
  **Verification:** goldens + parity byte-identical; the import-mismatch pin; full gates.

- [ ] LT-243: Adopt `@typescript-eslint/typescript-estree` for `to-estree.ts` (reflection §5 — the highest-leverage single swap).
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table, rank 1: `frontend/tsx/to-estree.ts` (848 lines) re-implements
  exactly what `@typescript-eslint/typescript-estree` maintains — converting the `typescript`
  AST to ESTree, against every `typescript` major. This retires ADR 0032's stated "Bad"
  consequence ("the converter must track `typescript`-major AST drift"). **The framework premise
  is what makes it urgent rather than tidy:** the corpus is 22 components the converter was
  written against; thousands of users authoring arbitrary TSX is precisely the input surface
  where a hand-written converter's coverage gaps become the support burden — and its bugs miscompile
  silently, the class COMPILER_REVIEW §1 exists to police. Both parser upgrades are reviewed
  changes per REQUIREMENTS §5; treat this as one (a devDependency swap, build-time only,
  browser-pure — typescript-estree is pure JS, confirm no node-only path).
  **How:** map the lowerings' consumed node shapes first (the converter's output feeds the
  shared lowerers; the swap must preserve those shapes or adapt them behind `to-estree.ts`'s
  existing interface so no caller changes). Keep the module boundary — callers consume
  `to-estree.ts`, not the library.
  **Verification:** goldens + parity byte-identical for the corpus; the estree fixtures in
  `server/tests/compiler/` green unchanged; the four `.tsx` tsc gates keep their exit codes;
  full gates green; `scripts/build-tsrx-browser.ts` smoke (browser purity) green.
  **Check:** the pinned `typescript` version ↔ typescript-estree compatibility matrix — record
  the supported range in the module doc so the next `typescript` bump knows what to verify.

- [ ] LT-231: Collapse the hand-maintained compiler vocabularies (review §2.5).
  **Skill:** le-truc-dev
  **Context:** Five divergent "names the client can resolve" lists (`analysis/plan.ts:546`;
  `analysis/loops.ts:98` — missing `plainLocalNames`/`clientLeTrucNames`/`isPending`;
  `loops.ts:384`; `analysis/harvest.ts:579`; the inverse at `plan.ts:614`) plus six
  copies of the user-facing message string; four subtly different "is this a signal read"
  answers (`harvest.ts:38`, `analysis/reactivity.ts:160`, `harvest.ts:163`,
  `ast-utils.ts:461`); `refOf` defined at `effects.ts:633` then hand-inlined at
  `:983`/`:1603`; three "element has its own client construct" versions, one
  (`loops.ts:194`) a hand-written kind list missing `style-map`/`pass`/reactive
  `html`/`server`+`bindsProp`. One function per question. Where convergence changes an
  answer (the `loops.ts` lists look like false-rejection bugs), the corpus must stay
  byte-identical and warning-0 — pin each converged answer on synthetic fixtures so the
  fix is visible. **Reflection §5 addition:** the `freeIdentifiers` fork (a scope-analysis
  fork that never received a known bug fix — it lacks the `ForStatement`/`ForOfStatement`/
  `CatchClause` cases the original grew; LT-229's walk migration fixes the *import-mismatch
  copy*, not this one) evaluates `@typescript-eslint/scope-manager`/`eslint-scope` (~−300
  lines, and a maintained scope manager cannot have that class of gap) against collapsing
  in-house — pick one in the handoff with the reasoning stated; a library adoption here is
  a reviewed dependency change per REQUIREMENTS §5, same as LT-243.
  **Verification:** goldens + parity byte-identical; warning baseline 0; census 20/2/0;
  synthetic pins for each converged answer.

- [ ] LT-245: Spike `css-select` + `parse5` for the structural-uniqueness proof; a real selector parser for `selector-syntax.ts` if the pattern holds.
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table, rank 4 — and the one wave-3 substitution that needs a spike
  before commitment. The structural-uniqueness proof (the moat: `first()` selector synthesis,
  exclusivity, cardinality) currently walks the IR/template by hand in five near-identical
  copies in `analysis/selectors.ts` (590 lines) that disagree on max-vs-sum and pending-arm
  handling (COMPILER_REVIEW §2.4; the soil LT-221's probe grew in). **Alternative shape: parse
  the markup the emitter itself produces** and query it with a real CSS engine (`css-select`;
  parse5 is already a dep) — the same question answered with far less machinery, dissolving the
  per-callsite re-litigation the hand walks cause. **Needs care, stated up front:** the proof is
  over the template INCLUDING unrendered branches, so branch arms must be materialized for the
  probe; and the proof reasons about constructs (compose sites, `@for` items) that have no
  DOM-bytes existence until render — the spike must show the materialized-probe model covers
  those before any GO. If the pattern holds, the same substitution covers
  `selector-syntax.ts` + `parseSimpleSelector`'s subset via `postcss-selector-parser`/`css-what`
  (~−250 lines) — the subset is currently the limiting factor on what `first()` can verify
  (descendant combinators, `:not()` are "cannot verify"); a real parser widens verification and
  shrinks code at once. Browser purity (M25): css-select/css-what/postcss-selector-parser are
  pure JS — confirm before adopting.
  **Deliverable:** spike findings + a GO/NO-GO ruling recorded here; if GO, implementation
  tasks with the per-site behavior-preservation discipline the other swaps carry.
  **Verification (spike):** the corpus's structural-uniqueness answers are reproduced
  identically for all 22 components (a differential harness: old walks vs materialized probe);
  goldens byte-identical; full gates.

- [ ] LT-230: Route the sixteen `TemplateNode` walks through `walk.ts`; settle the `pendingChildren` policy once.
  **Skill:** le-truc-dev
  **Context:** Review §2.4/§3 item 11. Sixteen hand-rolled template walks against a
  `walk.ts` whose authorized-exception list (`walk.ts:11`) is shorter than the actual
  list; five exclusivity-aware cascades in `analysis/selectors.ts` alone disagree on
  max-vs-sum and pending-arm handling — the soil the §1.4 adjacent gap grew in. Route
  them through `walk.ts` (keeping per-site aggregation semantics), narrow the
  authorized-exception list to what genuinely remains (walks whose recursion IS the
  semantics), and record ONE policy for `pendingChildren` arms, informed by LT-221's
  probe. **The five `analysis/selectors.ts` cascades ride LT-245's outcome**: a css-select
  GO replaces them wholesale (the library owns the traversal); a NO-GO keeps them here on
  the shared walk. Sequence after LT-245's ruling either way.
  **Verification:** goldens + parity byte-identical; the LT-221 probe still pins; full
  gates.

- [ ] LT-232: Derive the name-set subsets; extend the parity test.
  **Skill:** le-truc-dev
  **Context:** Review §2.5/§3 item 13. `REAL_EXPORT_NAMES` duplicates
  `SIGNAL_CONSTRUCTORS` and `PARSER_FACTORIES` entry-for-entry (its own comment admits
  "hand-maintained against the barrel"); `MUTABLE_SIGNAL_CONSTRUCTORS` is a hand-copied
  subset living in `setup-extraction.ts` (ex-`front-end.ts:427`, LT-224). Derive subsets from supersets; relocate the
  mutable set beside `SIGNAL_CONSTRUCTORS` (post-LT-228: into `vocabulary.ts`); extend
  `globals.test.ts`'s parity test (only `FACTORY_CONTEXT_MEMBER_NAMES` has one) to pin
  every set against the `@tsrx/core` barrel.
  **Verification:** typecheck; the extended parity test; goldens + parity
  byte-identical.

- [ ] LT-234: Shared code-generation kit — `CodeBuilder`, `jsString()`/`jsTemplate()`, `HtmlWriter`, `commonIndent()`.
  **Skill:** le-truc-dev
  **Context:** Review §2.8/§3 items 15–16. `emit-server.ts` interpolates `${tab(depth)}`
  ~60 times with every call site hand-managing depth; `emit-client.ts` runs 33
  consecutive `append` calls with trailing commas written as string suffixes; escaping is
  three functions plus bare `JSON.stringify` plus raw interpolation — the inconsistency
  behind §1.2/§1.3, which LT-221 point-fixed and this task closes structurally (migrate
  those point-fixes onto `jsString()`). Extract: a `CodeBuilder` owning
  lines/depth/open/close (making the three copied `cursor.offset` bookkeeping sites —
  `emit-client.ts:227/279/611` — an invariant); the `jsString`/`jsTemplate` pair as THE
  sanctioned way to put an author string into generated source; an `HtmlWriter`
  generalising the existing private `Part[]`/`pushArgument` model
  (`emit-server.ts:70/79`); and `commonIndent()` shared by `spans.ts`'s twin
  computations (differing only in whether line 0 participates — make it a parameter).
  Give the server emitter the client's reserved-name policy: it mints
  `__html`/`__arm${n}`/`__async${n}`/`__children${n}`/`__key` with no collision check
  against author names (an author `const __html` shadows the buffer and confuses
  `retainReferenced`'s token match). Channel/tier note (ADR 0028): compiler-internal
  naming policy — it renames, it does not error; no new runtime check, no new TSRX code.
  **Verification:** goldens byte-identical for the corpus (escaping output must not
  change for legal inputs); a pin that an author `__html` no longer collides; full gates
  green.

- [ ] LT-247: Adopt `magic-string` under `spans.ts` (reflection §5).
  **Skill:** le-truc-dev
  **Context:** Reflection §5 table: replaces `spans.ts`'s hand bookkeeping (~−150 lines) and
  buys **real source maps free** — which M25's span-table remapping and the playground
  (ADR 0025, Proposed) both want eventually. Runs after LT-234 (which settles `CodeBuilder`
  and `commonIndent()` so this swap touches one settled surface, not two in-flight ones).
  **Demand note, stated so this doesn't jump the queue:** the payoff is contingent — source
  maps matter when editor/playground tooling consumes them, and ADR 0025 is Proposed. Do it
  when that demand arrives OR as a small output-neutral swap if it retires code without
  changing bytes; goldens byte-identical is the gate either way.
  **Verification:** goldens + parity byte-identical; the span table's remapped positions
  unchanged on a diagnostic-sample fixture; full gates.

- [ ] LT-246: Make tier contamination legible at the compose edge — the census names the re-routing edge.
  **Skill:** le-truc-dev
  **Context:** Reflection §3's recommendation, promoted under the framework premise: the
  compose contamination fixpoint (LE_TRUC_COMPILER.md §5.2) means a parent that *reads* a
  child — `first()` addressing a compose site, or `truc:pass` into it — inherits the child's
  tier, so "I added a `first()` and my component left the Folded tier" is a different-tier
  outcome whose only footprint is the census. In-house that is an inconvenience; for
  thousands of external users it is a support ticket generator. The fixpoint already knows
  the edge it traverses — record it: the census reason for a contaminated component names the
  compose edge (parent file/tag → child tag) that caused the re-route.
  **Channel (ADR 0028/M23 posture):** build report / census record — not a warning, no new
  TSRX code; the warning baseline and the census's regression signal are untouched.
  **Verification:** a fixture whose parent re-routes via a compose edge shows the edge in the
  census reason; the corpus census stays 20/2/0 with reasons extended, not changed; goldens
  byte-identical (census text is not emitted code); full gates.

- [ ] LT-244: Relocate `ExtractContext` out of `ir.ts` (LT-235 item (e); review §2.6/§3 item 19 — carved out of the design session).
  **Skill:** le-truc-dev
  **Context:** Reflection §6's "cheap way to keep the option," worth doing on its own merits and
  ahead of LT-235's full session. `ir.ts` is documented as a pure-type leaf — "a serializable
  `ComponentIR`" — and `ExtractContext` (front-end mutable state WITH function members) is the
  one violation. Evicting it (to `setup-extraction.ts` or its own module, beside its only
  consumers) restores the leaf property: the IR becomes a serializable data structure again,
  which preserves the native-rewrite option for free (reflection §6) and is a precondition for
  wave-4's type-level contracts treating the IR as data.
  **Verification:** typecheck (import moves); goldens + parity byte-identical; `ir.ts` imports
  no function-bearing front-end state (grep pin); full gates green.

- [ ] LT-287: SignalIR → three members by constructor family (LT-235 item (c); ADR 0040 s2). **Gates LT-254** (ADR 0040, accepted 2026-09-24: a published IR type).
  **Skill:** le-truc-dev
  **Context:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  (owner rulings, LT-235 grilling 2026-09-21). `SignalIR` splits into `DeclaredSignalIR`
  (`createCell`/`createState`/`createList`/`createStore` — init is the initializer),
  `DerivedSignalIR` (`deriveCell`/`deriveList`/`deriveStore`/`createMemo` — init is the derive
  expression) and `ContextSignalIR` (`requestContext` — carries the fallback node and its
  verbatim text; the `null`-everywhere-else `fallbackText` field dies). `constructor` stays as
  a field narrowed within each member, so exact-constructor dispatch (reactive `@for`'s
  `createList` requirement) keeps working. The hand-rolled special-case sites become
  narrowings: the two `emit-client.ts` requestContext skips, the three `emit-server.ts`
  substitution sites, `harvest.ts`'s no-seed skip and derive grouping, and `effects.ts`'s
  deriveCell case.
  **Check:** goldens + parity byte-identical (type-level only); `bun test server/tests`,
  typecheck, warning baseline 0.
  **Doc handoff (LT-235 review):** flip the LE_TRUC_COMPILER.md §4 `SignalIR` passage from *target
  shape* to present tense in the same commit.

- [ ] LT-288: One `first()` record, two `expose()` shapes on `ComponentIR` (LT-235 item (d); ADR 0040 s4). **Gates LT-254** (ADR 0040, accepted 2026-09-24: a published IR type).
  **Skill:** le-truc-dev
  **Context:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  s4. The four parallel `first()` collections (`refReasons`, `unmatchedOptionalRefs`,
  `deferredComposeRefs`, `optionalRefs` — a Map, two differently-shaped arrays, a Set)
  consolidate into one `FirstRefDecl` (name, selector, required, reason, resolution stage,
  offset) in a name-keyed Map — the resolution stage is data, not a different shape. The seven
  `expose()` fields split into `expose: ExposeStmt | null` (text, range, argNode, ambients —
  four views of the one call) and one per-prop `ReadonlyMap<string, ExposePropDecl>` (kind,
  signalName?, parser?) — `exposeProps`/`exposeKinds`/`parserExposeProps` merge.
  `RegistryEntry.exposedProps` is a projection and unchanged. The
  `setup`/`plainSetup`/`clientSetup`/`signals` arrays stay as-is — ADR 0040's explicit
  exclusion (behavior-bearing emission contracts, not redundancy). Hottest consumer is
  `template-output.ts`; keep its lookups O(1) via the Map.
  **Check:** goldens + parity byte-identical; `bun test server/tests`, typecheck, warning
  baseline 0, census 20/2/0.

- [ ] LT-289: Typed pass contracts — functional passes over `PassShared` (LT-235 item (f); ADR 0040 s5).
  **Skill:** le-truc-dev
  **Context:** [ADR 0040](adr/0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md)
  s5 — the review's "one item that is design work rather than refactoring"; the design is now
  recorded, this task lands it. The order-carrying accumulators (queries, usedNames, ambient,
  childTags, refNames, diagnostics — byte-stable query order is their documented invariant)
  become an explicitly typed `PassShared` environment; each pass's productions become return
  values the next pass receives as REQUIRED parameters (`runLoops(shared) → LoopPlans`;
  `runHarvest(shared, loopPlans) → HarvestPlans`; `runEffects(shared, loopPlans, harvests) →
  EffectPlans`), so harvest-before-loops is a compile error in `analyzeClient` and "harvest
  read an empty `forPlans` map" is unrepresentable. `resolveComposeRefs` returns a typed
  `{ mode: 'resolved' | 'skipped' }` so a missing `composeRegistry` must be acknowledged;
  `ambiguousComposeNodes` stays the already-reported channel, carried on the resolved result.
  The `diagnostics` threading is deliberately untouched (ADR 0040's accepted tradeoff).
  LT-226's EffectsContext extraction is the structural pattern.
  **Check:** goldens + parity byte-identical; a harness calling `runHarvest` without
  `loopPlans` fails typecheck; `bun test server/tests`, typecheck, warning baseline 0.
  **Doc handoff (LT-235 review):** flip the LE_TRUC_COMPILER.md §4 pass-order passage from *target
  shape* to present tense in the same commit.

---

- [ ] LT-268: Parse the authored stylesheet in the compiler — the `lightningcss` swap for `css.ts` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s9). **Ships in 3.0.** Prerequisite of LT-304, LT-214, LT-269, LT-270.
  **Skill:** le-truc-dev (Tech Writer owns the message copy)
  **Context:** `server/compiler/css.ts` dedents and emits verbatim; the compiler holds **no
  model of the CSS at all**. `lightningcss` is **already a devDependency and already the
  build's CSS effect** (`server/effects/css.ts`). Parse the component's sheet and make its
  rules, selectors and at-rules reachable from the IR. **Spec-grammar validation of authored
  CSS (unknown property, invalid unit, malformed value) rides this swap**: channel compiler,
  **tier 1 Prevented** (ADR 0028 s1), since a malformed sheet has no correct emission.
  Evaluate `css-tree`'s `lexer.matchProperty` only where per-declaration diagnostics are
  wanted rather than a whole-sheet parse failure. This task adds the model and changes no
  output; the scoped emission and the `cssTargets` key are LT-304's.
  **Check:** emitted CSS stays **byte-identical** for every corpus component; a fixture with
  an invalid unit fails the build with the ruled copy; M25 browser-purity review of the
  dependency, as LT-245 does for its candidates.

- [ ] LT-304: Scoped emission of shadow-root-form CSS — native `@scope` or the `:where(:not(…))` lowering, per `cssTargets` ([ADR 0033](adr/0033-scope-component-styles-by-custom-element-name.md) s1–s7). **Ships in 3.0. Depends on LT-268; lands together with LT-306** (the corpus migration), since the old tag-led form becomes an error.
  **Skill:** le-truc-dev (Tech Writer owns the new LTC copy; LT-248 is the docs half)
  **Context:** Owner ruling 2026-09-24. A compiled sheet is authored as shadow-root CSS
  (`:host` plus bare selectors) and the compiler gives it shadow-root scoping in light DOM.
  (1) **`cssTargets`**: a browserslist-style key in `le-truc.config.json` (ADR 0036
  validation rules apply), default Baseline widely available, also fed to `lightningcss`'s
  own lowering. (2) **Boundary**: every custom-element tag the lowered template renders,
  composed and raw dashed tags alike. (3) **Native**: wrap the sheet in
  `@scope (my-element) to (<tag> > *, …)`, or `@scope (my-element)` for a leaf; emit
  `:host` as `:where(:scope)` and `:host(<sel>)` as `:where(:scope:is(<sel>))`; hoist
  `@keyframes`/`@font-face`/`@property` out unchanged. (4) **Lowered**: flat selectors led
  by the tag with a zero-specificity guard per boundary tag, e.g.
  `my-element .input:where(:not(my-element form-listbox > *, my-element form-listbox > * *))`,
  and `:host` as `:where(my-element)`. (5) **New tier 1 errors** (channel compiler, tier 1
  Prevented; next free LTC codes after LTC053): a rule led by the component's own tag
  (fix-it: `:host`), `::slotted()` in a light-DOM component, `:host-context()` anywhere
  (removed from the spec), and every `:global` form except the two whole-rule forms. (5a)
  **`:global`** (s6a): top-level `:global(<whole selector>) { … }` and `:global { … }`
  blocks are hoisted out of the scope verbatim; nested blocks, prefixed,
  trailing (fix-it: plain compound), leading-ancestor and mid-selector forms are the tier 1
  errors above, each with its own reason in the copy. (6)
  **Served CSS**: where a folder serves a compiled surface, the page imports the compiler's
  emitted CSS; the `.ts` twin's hand-written `.css` is served only with the twin (s10).
  **Check:** a fixture per contract point in s1/s3 compares the compiled light-DOM output
  with the same sheet inside a real shadow root: the host rule loses to a page type
  selector in both, and a parent rule never reaches a composed child's internals in
  either; a `:global` rule is emitted outside the scope in both modes; fixtures pin the s7 differences (inward reach, page-authored children, and the
  three lowering differences); the corpus Playwright specs pass once per mode (override
  `cssTargets`); each new error fires on its fixture; LTC051 still compares authored
  sheets; corpus warning baseline 0.

- [ ] LT-306: Migrate every compiled corpus stylesheet to the shadow-root form (ADR 0033 s2) and split the twins' CSS (s10). **Ships in 3.0. Lands together with LT-304.**
  **Skill:** le-truc-dev
  **Context:** Every compiled sheet (`.tsx` and `.tsrx`, both members of a variant set
  identically) moves from tag-led nesting (`my-element { … & .x { … } }`) to `:host { … }`
  plus bare rules, and drops the defensive `>` chains that only guarded against downward
  leakage, keeping a `>` where it expresses real intent (direct children only). Write it as
  a codemod over the parsed sheet (LT-268) rather than by hand, and keep it for pioneer
  projects. `module-dialog`'s `body.scroll-lock` becomes `:global(body.scroll-lock)`.
  The `.ts` twins' hand-written `.css` files stay tag-led and verbatim; point
  `examples/main.css` at the emitted CSS for every folder whose served surface is compiled.
  **Check:** the served pages render pixel-identically before and after where no leak was
  present (Playwright screenshot comparison per example, both CSS modes); LTC051 green
  across every variant set; no compiled sheet contains a rule led by its own tag.

- [ ] LT-305: Baseline guard — fail the build when shipped code needs a feature newer than the pinned baseline (REQUIREMENTS § Browser support). **Ships in 3.0.**
  **Skill:** le-truc-dev
  **Context:** Owner ruling 2026-09-24: the runtime baseline is **Baseline 2023**, pinned per
  major release to three years before it (3.0 → 2023); **minor and patch releases never move
  it**. The stated floor drifted once already (REQUIREMENTS said 2020 while `Object.hasOwn`
  set 2022), so a check replaces the prose. Record the pinned year in one place
  (the runtime's `package.json`, e.g. `"leTruc": { "baseline": 2023 }`; the baseline belongs
  to the runtime's major, ADR 0034 s8) and scan what ships: `src/`, the bundled
  `@zeix/cause-effect`, and the compiler's generated client modules and emitted CSS under the
  default `cssTargets`, against that year. Resolve features to Baseline dates with `web-features`;
  choose the scanner (a browserslist `baseline 2023` query fed to an API/syntax compat
  linter, or a direct `web-features` mapping) and justify it in the handoff. Features the
  runtime uses only behind a guard (`CustomStateSet`, ARIA reflection on internals) are
  allowlisted by name with the reason, never by pattern. A check that the pinned year only
  changes on a runtime major version bump is part of the gate. **Channel: build check, tier 1**
  (a CI failure; no runtime half).
  **Check:** the gate is green at HEAD with Baseline 2023; a fixture using a 2024-only API
  unguarded fails it; bumping the year without a major version fails it.

## P3 — Gate-wave residue (independent of P1/P2; parallelizable)

- [ ] LT-301: Loops in conditional contexts are mis-addressed on the client — diagnose them (LT-212 review; NOTES 2026-09-24). **Gate: before any wave-4 migration whose component nests a loop inside a branch.**
  **Skill:** le-truc-dev
  **Context:** `.tsrx` `@if (…) { … } @else { @for (…) { <li class="item" onClick={…}/> } }` renders
  correctly on the server. The client, though, treats the loop output as a branch root: it binds
  `first('li.item')`, so only the FIRST item gets its handler, and it registers an unused `all()`
  collection instead of an `each()`. `.tsx` reaches the same path through a fragment arm,
  `{c ? <>{xs.map(…)}</> : …}`. **Ruling (Architect, 2026-09-24): diagnose, don't support.**
  A loop output whose nearest control-flow ancestor is an `if`/`switch` branch, on either
  surface, becomes an error. **Channel:** compiler. **Tier:** 1 Prevented (statically
  decidable from the tree). Reuse LTC005: the construct is outside the supported subset, not a
  new rule family. The message must name the fix: `@empty` in `.tsrx`, the empty-state idiom
  in `.tsx`, or move the loop out of the branch. Supporting branch-scoped `each()` is deferred
  until a migration needs it, at which point this becomes a design task. **Tech Writer**
  reviews the copy. Rider from the LT-212 review: an authored `hidden` or `data-unreconciled`
  on a reactive-List `@empty` root is emitted twice beside the compiler's own. Reject both as
  LTC005 in `validateEmptyArm`, because the compiler owns them on that path.
  **Check:** both surface spellings fail the build with LTC005; `@empty` and the idiom still
  compile; corpus output byte-identical; typecheck 0; warning baseline 0, census 20/2/0.

- [ ] LT-302: Arg and setup names shadow the render-harness imports in generated server modules (LT-212 review; NOTES 2026-09-24).
  **Skill:** le-truc-dev
  **Context:** with an arg named `items`, the server module emits
  `for (const item of items(items))`, which throws `items is not a function` at render. Every
  `RUNTIME_HARNESS_EXPORTS` name is exposed the same way (`entries`, `esc`, `attr`, `cls`, …).
  The corpus avoids them by luck. **Ruling (Architect, 2026-09-24): alias, don't forbid**,
  because `items` is an ordinary arg name. Alias a harness import only when a render-scope
  name collides with it (`import { items as __items }`, and the emitter uses the alias), so every
  module without a collision stays byte-identical. Also audit the generated CLIENT module: an
  arg or setup name equal to a destructured factory-context name or an imported `@zeix/le-truc`
  export (`first`, `each`, `watch`, …) is the same hazard. If the client side can collide,
  alias there too, or diagnose if aliasing is impossible because the name is authored
  vocabulary. **Channel:** none for the aliased cases (the collision stops being an error). Any
  collision that can't be aliased is compiler, tier 1 Prevented, with Tech Writer on the copy.
  **Check:** a fixture with args `items`/`esc` renders on both surfaces; corpus output
  byte-identical; typecheck 0; warning baseline 0.

- [ ] LT-300: Review the three LTC005 phrases LT-212 added (LT-212 review).
  **Skill:** tech-writer
  **Context:** new `what` strings passed to the existing `diagnostic.unsupported` builder:
  two in `server/compiler/lower-shared.ts` `validateEmptyArm` (a client construct in an empty
  arm, and a non-element reactive-List arm root) and one in `server/compiler/frontend/tsx/lower-tsx.ts`
  `lowerIfExpr` (a `.map()` as a conditional arm). They read inside the builder's template
  "`<what>` is outside the sanctioned milestone-2 subset of ADR 0023. Supported: …". Review
  them in that assembled form. That template's "Supported:" list itself predates reactive
  lists, `@empty` and the `.tsx` surface; review it in the same pass.
  **Check:** assembled messages meet the error-message lifecycle's criteria;
  `bun test server/tests/compiler/diagnostics.test.ts` green (the LT-212 pins assert on
  `'@empty arm'`, `'non-element root'` and `'conditional arm'`).

- [ ] LT-297: `argsFromAttrs` keys attributes by the arg's camelCase name (LT-290 close-out; latent).
  **Skill:** le-truc-dev
  **Context:** the page-occurrence helper reads `attrs["bigStep"]`, but HTML attribute
  names are case-insensitive and serialize lowercase, so an authored `big-step`/`bigstep`
  occurrence never matches. A camelCase string or Parser arg would silently lose its
  channel and render the default. Not live today: LT-290 removed spinbutton's only
  camelCase channel, and no other corpus arg is camelCase. Key by the attribute name the
  client parser reads (the same mapping `expose()`'s Parser reads at connect), and pin
  it with a camelCase fixture.
  **Check:** a fixture with a camelCase Parser arg renders its authored attribute value;
  goldens unchanged.

- [ ] LT-186: A TSRX rule for an unkeyed element sibling of a `@for` in a reconcile container (LT-185's compiler half).
  **Skill:** le-truc-dev
  **Context:** LT-185 cost form-tokenbox its only text input: the `.tsrx` port dropped the
  `data-unreconciled` attribute, `reconcile()` removed the input as an unkeyed child of
  `data-container`, and nothing said so. LT-185 added the DEV_MODE warning for the runtime half.
  This is the compiler half, and the **user's direction (2026-09-06) is that TSRX is the better
  channel precisely because it is earlier** — the author learns at compile time instead of by
  opening a browser in dev mode. The shape is statically decidable for the `.tsrx` corpus: an
  element sibling of a `@for` inside the same `[data-container]`, carrying neither `data-key`
  nor `data-unreconciled`, will be removed at the first reconcile. Note the two channels are
  **complementary, not alternatives** — the compiler cannot see hand-authored HTML written by a
  library consumer, which is the case the runtime warning keeps covering. Do not retire the
  LT-185 warning when this lands.
  **Channel:** compiler (a new `TSRX0NN`), per ADR 0028 sub-design 1 — **confirmed at the
  LT-185 review**, and it is the user's direction: the compiler is earlier than a browser
  dev-mode warning. **Tier:** 1 (Prevented). **Error, not warning** — decided here so it is not
  re-litigated at implementation: the compile-warning baseline's target is zero (ADR 0029 s6,
  REQUIREMENTS M23), so a warning would either be fixed immediately or break the baseline, and
  the fix-it is one attribute. Check the false-positive shape FIRST — a container that
  legitimately self-cleans a dirty server render: if a corpus component needs that, come back
  before writing the rule rather than weakening it.
  **A deviation from ADR 0028's usual pairing, stated so it is not "fixed":** the ADR's Prevented
  tier says the runtime check "remains, behaving as Contained". Here the runtime half is LT-185's
  DEV_MODE advisory, not a Contained error — nothing fails at runtime, so do NOT convert it to a
  `console.error` or invent an error class to match the pattern.
  **Copy:** Tech Writer owns the final wording and reviews it against LT-185's runtime message so
  the two agree (the ADR 0028 lifecycle applies — this introduces a code).
  Acceptance: the form-tokenbox shape at its pre-LT-185 state produces the diagnostic; a sibling
  carrying `data-unreconciled` does not, and neither does `module-list.tsrx` (whose container
  holds only the `@for`) — pin both negatives, the vacuous assertion is the failure mode; the
  compile-warning baseline stays at 0 over the corpus; `bun test server` green.
  **ADR 0037 rider (2026-09-21):** reactive conditions inside a reconcile container are
  **banned** (compiler, tier 1) until this rule exists — and this rule must also cover (or
  explicitly exempt) ADR 0037's arm templates as container children. See
  [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) sub-design 5.

- [ ] LT-170: Strengthen two gate-wave assertions in `gate-wave-verification.test.ts` that don't test what they claim.
  **Skill:** docs-server-dev
  **Context:** Filed by the LT-144/LT-145 review (2026-09-03), re-confirmed present 2026-09-17.
  Two tests in `server/tests/compiler/gate-wave-verification.test.ts` pass today but don't verify
  the behavior their name/comment claims — a regression in the underlying compiler behavior
  would fail neither.
  1. **`'the reactive spelling plans a client binding the static spelling does not'`** (line
     ~440) only asserts `hostVariant.spans`/`bareVariant.spans` are truthy — true of any
     compiled component. Fix: assert on the actual compiled `clientCode`, e.g.
     `hostVariant.clientCode` contains a `watch(...host.count...bindText(` call and
     `bareVariant.clientCode` does not (confirmed by hand at review: the distinction is real and
     present today).
  2. **`'composed under form-combobox, initial render stays hermetic'`** (line ~483) only
     asserts the string `<form-listbox` appears in the composed output — trivially true.
     `form-combobox` composes its listbox with `filterable={false}`, so there is no clear button
     to check; the acceptance-relevant behavior is the other known composed-filter case from the
     LT-154 review (the combobox's selected-but-`hidden` inner option is authored `truc:pass`
     filter wiring). Assert the first option renders both `aria-selected="true"` AND `hidden=""`
     in the initial (pre-`truc:pass`) render, matching `sim-driver.test.ts`'s own corpus
     snapshot for `form-combobox`.
  Acceptance: both tests fail if the underlying compiled/rendered behavior regresses;
  `bun test server/tests` stays green.

- [ ] LT-147: Lower reactive `aria-*` on element targets to `bindAria()`, with a reverse IDL name table.
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. About which binding helper the compiler emits, not
  about server-execution tiering. v2.6 added `bindAria()` (ADR 0026) and the compiler does not
  know about it: all 7 reactive ARIA bindings in the corpus lower to `bindAttribute` with a
  **compiler-synthesized `String()`** — `String(selected.get() === pid)` (module-tabgroup),
  `String(host.value === optValue)` (form-listbox), `String(parseOklch(host.value).h ?? 0)`
  (form-colorgraph) — precisely the hand-rolled coercion ADR 0026 §2 exists to remove.
  **Fix:** lower a reactive `aria-*` attribute on an element target to
  `watch(<thunk>, bindAria(el, '<idlName>'))`, dropping the synthetic `String()` and letting the
  helper apply ARIA's own coercion (boolean → `'true'`/`'false'`, number → decimal, `nil` →
  clear). **Two hard constraints.**
  1. The attribute→IDL mapping is a **lookup table, not a transform**: ARIA attribute names
     carry no inner hyphens, so `aria-valuenow` gives no clue where the camel hump falls
     (`ariaValueNow`). Build the table by enumerating `ARIAMixin`'s names and applying the
     library's own forward rule (`ariaAttributeName`, `src/bindings.ts:512`) — do not
     hand-maintain a second list that can drift from the platform.
  2. `ARIAMixin` splits into **44 string-valued props and 8 element-reference props**
     (`ariaActiveDescendantElement`, `ariaControlsElements`, `ariaDescribedByElements`,
     `ariaDetailsElements`, `ariaErrorMessageElements`, `ariaFlowToElements`,
     `ariaLabelledByElements`, `ariaOwnsElements`) that take `Element`/`Element[]`. An IDREF
     *string* must NEVER be routed to one — `aria-describedby="x"` is not
     `ariaDescribedByElements`. Map string-valued props only; leave the IDREF attributes on
     `bindAttribute`. All of the corpus's IDREF ARIA is server-static today, so nothing
     regresses.
  Acceptance: the 7 sites lower to `bindAria` with no `String()`; the golden clients update; all
  Playwright example specs stay green (they assert on the ARIA *attributes*, which native
  reflection still mirrors for element targets); the post-ADR-0029 zero-warning gate holds (use
  the gate, not a hand-maintained expected count).

- [ ] LT-148: Route the component's OWN host ARIA to `internals`, and diagnose CSS that depends on host ARIA attributes. **Depends on LT-147's mapping table.**
  **Skill:** le-truc-dev
  **Context:** Owner decision, 2026-09-02. Per ADR 0026 §1, host semantics belong on
  `internals.aria*`: invisible in markup, unclobberable by framework attribute rewriting, and
  still overridable by the consumer's own attribute. **Fix:** a reactive `aria-*` on the ROOT
  element lowers to `watch(<thunk>, bindAria(internals, '<idlName>'))` rather than to an
  attribute write on the host. **The two halves must land in the same commit,** because the
  routing is what makes the diagnostic necessary: `bindAria()` on an `ElementInternals` target
  **removes the shadowing content attribute** at its first value assertion (ADR 0026 §1,
  stale-attribute rule), so a server-rendered `aria-expanded="false"` on the host is deleted at
  hydration — by design, and fatal to any CSS selecting on it. **So:** diagnose a selector in
  the component's own `<style>` block that matches the HOST on an `aria-*` content attribute
  (e.g. `module-tabgroup[aria-expanded="true"]`), with the fix-it naming `:state()` (ADR 0016
  §8) as the component-owned styling hook. **The distinction is load-bearing and the diagnostic
  is wrong without it:** ARIA on CHILD elements stays on the attribute channel (native IDL
  reflection mirrors element-target writes), so the corpus's three existing
  `&[aria-selected="true"]` selectors — nested under tab buttons and option buttons in
  `module-tabgroup` and `form-listbox` — are CORRECT and must NOT warn. Only host-matching
  selectors do. **Zero corpus sites exercise either half today**, so write both fixtures first;
  this is a forward-looking guard in the LT-125/129 posture.
  **Carried from LT-177.** (1) This task owns the serialization pin LT-177 deferred: a corpus
  fixture whose root `aria-*` binding serializes WITH the attribute under simulation — LT-177's
  realm-level test pins the mechanism only, and a `.tsrx` fixture was meaningless before any
  root ARIA binding existed. (2) Under simulation `internals` is now non-null for
  non-form-associated components, so an imperative `internals.states.add(…)` in a factory throws
  a `TypeError`; route custom states through `bindState()`, which capability-probes and no-ops
  on skeletal internals.
  Acceptance: a root `aria-*` thunk lowers to the internals form; a host `[aria-*]` style
  selector warns; the three child selectors stay silent; the simulation serialization pin holds;
  the zero-warning gate holds.

- [ ] LT-248: Document compiled-component style scoping (ADR 0033, accepted 2026-09-24) where users read.
  **Skill:** tech-writer
  **Context:** Re-scoped by the ADR 0033 ruling: the doc obligation is no longer "scoped by
  tag name, a known limit" but the ruled model. `docs-src/pages/styling.md`'s compiled-component
  callout and `server/compiler/HOST_PROFILE.md` § Styles (including its selector-enforcement
  open question, now answered) state: a compiled sheet is shadow-root CSS (`:host` plus bare
  selectors), scoped in light DOM so rules stop at every custom element the template renders,
  emitted as native `@scope` or a `:where(:not(…))` lowering per `cssTargets`; host rules lose
  to page styles, as in a shadow root; defensive `>` chains are no longer needed; hand-written
  CSS for runtime-only components stays verbatim and tag-led. **Be plain that only a real
  shadow root gives inward encapsulation**: page CSS can still reach a light-DOM component's
  internals. Name every ADR 0033 s7 difference where an author would otherwise hit it, and
  list what switching to a shadow root changes beyond the stylesheet (s8). Also state the runtime
  baseline (Baseline 2023, REQUIREMENTS § Browser support) in the getting-started or
  installation page. **Lands with LT-304**, not before: until then the docs describe verbatim
  emission.
  **Verification:** `check:links` green; styling.md and HOST_PROFILE.md say the same thing in
  the same words (one is user-facing, one is the authoring profile).

- [ ] LT-303: `<truc:try pending catch>` replaces `boundary()` and the try/catch IIFE in `.tsx` ([ADR 0041](adr/0041-truc-intrinsic-elements-for-compiler-consumed-constructs.md)). **Gate: before the first wave-4 migration that authors a boundary.**
  **Skill:** le-truc-dev; Tech Writer reviews the diagnostic copy (retirement counts)
  **Context:** Owner ruling 2026-09-24. `.tsx` spells both boundaries as one namespaced
  intrinsic: `<truc:try catch={e => <jsx/>}>ok</truc:try>` is the error boundary, and
  adding `pending={<jsx/>}` makes it the async boundary. Both lower to the existing `try`
  IR node (`pendingChildren` set iff `pending` is present), so nothing past the front end
  changes and `.tsrx` is untouched. (1) `host-profile.d.ts`: delete the `boundary`
  ambient; add `IntrinsicElements['truc:try']` with `pending?: JSX.Element`,
  `catch: (error: Error) => JSX.Element` and `children: JSX.Element`, keeping LT-208's
  branded arm typing (verified 2026-09-24: namespaced intrinsics give `tsc` arm types,
  contextual `Error`, and TS17001 on a repeated arm). (2) `lower-tsx.ts`: delete
  `lowerTryIife` and the `boundary` call dispatch, and lower `truc:try` elements instead.
  The switch IIFE and `asIife` stay. The single-root-per-arm rules carry over. The
  arrow-shape and missing-arm errors retire where `tsc` now covers them; a surviving
  shape error keeps channel compiler, tier 1 Prevented. (3) Rewrite `fixtures/tsx/async/`,
  `fixtures/tsx/sync/` and `fixtures/tsx/async-bad-arms.tsx` (under `server/tests/compiler/`) (the negative type test becomes a
  bad `pending`/`catch` attribute) and the parity tests. Byte-identical server output
  against the `.tsrx` twins is the acceptance proof. (4) Sweep JSDoc and comments
  (`lower-tsx.ts` header, `lower-shared.ts:8`/`:487`) so no `boundary()` or try/catch
  IIFE reference survives in code. The authoritative docs were already swept on
  2026-09-24. BACKLOG P1's Tech Writer batch item 5 (the boundary diagnostic wordings)
  now covers the `truc:try` copy instead. Independent of LT-276 (arm mechanism) but
  touches the same goldens — land either first and refresh.
  **Handoff from LT-213 (2026-09-24):** LTC053 in `lower-shared.ts`'s `lowerElement`
  currently rejects every tag `jsxName` cannot flatten, namespaced ones included. Lower
  `truc:try` in `lower-tsx.ts`'s dispatch before it reaches `lowerElement`, or exempt it
  there, so that any other `truc:*` name stays LTC053.
  **Check:** `grep -rn "boundary(" server spike` is empty outside history; parity suite
  green; compile-warning baseline 0.

## P4 — v3.0 deprecated-surface removal (separate branch; gates wave 4)

**Owner sequencing, 2026-09-04:** both removals run on a **separate branch**, and land **before
any wave-4 migration** (LT-095–LT-111) so migrated twins and newly generated clients never
target the removed forms. ROADMAP § "Dead ends: deprecated in 2.x, removed in 3.0" already
declares both; these tasks implement it. The Cause & Effect 2.0 re-export surface rewrite is a
separate track, blocked on CE 2.0 shipping — out of scope here.

- [ ] LT-274: Lower reactive conditions to template-cloned arms on both surfaces (ADR 0037 sub-designs 1–3 and 5). **Gates LT-254** (ADR 0040: the `conditional` `TemplateNode` variant must exist before the first publish).
  **Skill:** le-truc-dev
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) (🔄 Proposed, owner ruling 2026-09-21). A condition that reads a signal — `@if`/`@else`, `.tsx` ternary/`&&`, IIFE switch, `@switch`/`@case` with literal cases — lowers to inert arm `<template>`s plus the server-folded initial winner rendered live, and client-side to `reconcile()` over the new **current-arm-key source** (`Signal<string | null>`; ADR 0017 amendment). Arm keys are the named compile-time constants (`then`/`else`, `case:<literal>`; sub-design 2). Arm effects mount under keyedScopes with collector parity. Static conditions are unchanged — the Folded tier still renders the single winner and omits the rest, so byte-identity across tiers holds. Reactive conditions inside reconcile containers stay banned (LT-186's rule).
  **Deliverable:** shared lowering in both front ends; arm extraction + initial-winner fold rules; the arm-key source form on `reconcile()`; diagnostics with channel/tier fields (dynamic `@case` value: compiler, tier 1 Prevented; reactive-if-in-reconcile-container: compiler, tier 1); goldens and parity extension.
  **Check:** byte-identical skeletons across all three tiers for reactive-if components; both-surface parity for renders *and* diagnostics; equivalence-audit pins refreshed (initial arm adoption is a new designed connect-diff class); M14 bundle budget re-measured; compile-warning baseline 0.
  **Coordinate:** the IR node rides LT-235's discriminated-union session; the boundary switch is LT-276, sequenced after this; diagnostic copy is LT-275.

- [ ] LT-275: Diagnostics lifecycle for reactive conditions — retire LTC005's signal-condition face; Tech Writer copy.
  **Skill:** tech-writer (drafting: le-truc-dev)
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md) reverses "`@if` conditions cannot read signals" (`validateCondition`, `server/compiler/lower-shared.ts`). Only the **condition face** of LTC005 retires — the `t`-in-reactive-position face stays. The error-message lifecycle applies to every face touched: the LTC005 message, the arrow-thunk section's sentence in `server/compiler/HOST_PROFILE.md`, and the teaching in ARCHITECTURE.md, AGENTS.md and the le-truc/cause-effect skills; the new ADR 0037 codes' final wording lands here. Batch with the LT-220/LT-189 copy rounds.
  **Check:** catalog rows added/retired match the diagnostics union; `check:links`; compile-warning baseline 0.
  **Depends on** LT-274.

- [ ] LT-276: Switch the async boundary to template-cloned arms (ADR 0037 sub-design 4). **Sequenced after LT-303** (ADR 0040 s3: LT-303 changes only the `.tsx` spelling of today's `try` node; this task then reshapes it under both front ends). **Gates LT-254** (ADR 0040).
  **Skill:** le-truc-dev
  **Context:** [ADR 0037](adr/0037-reactive-conditions-via-template-cloned-arms.md), owner ruling 2026-09-21: `@try`/`@pending`/`@catch` arms become templates plus the adopted winner, keyed `ok`/`nil`/`err`. Retires the fieldset wrappers `emit-server.ts` places at every arm root, the client's `hidden`+`disabled` sweep, and the LT-086 `.parentElement` addressing — all of it existed only because both arms were live simultaneously. The ok arm's resolved-value text and the err arm's bound catch-param text move into the per-arm mount. LT-211's no-stale-arm ruling and the `isPending` idiom are untouched; LT-078's tree-shaking question is re-pinned against templates.
  **Depends on** LT-274 (the mechanism).
  **Check:** every boundary-using corpus component's goldens refreshed; a form-submission negative test (named controls in non-active arms cannot submit — structural now, pinned anyway); audit pins; baseline 0.

- [ ] LT-281: Flag a non-void factory return — authored-surface rule + DEV_MODE warning (LT-179 residue).
  **Skill:** le-truc-dev (compiler half); Tech Writer owns both messages
  **Context:** TypeScript's void-return assignability means a legacy 2.x `return [...]`
  factory still compiles against LT-179's `(context) => void` factory type while its value is
  silently ignored — a migration trap the types cannot catch (pinned by the "a factory return
  value is ignored" test in `component.test.ts`). ADR 0028 sub-design 1: a factory
  `return`-with-value is statically decidable, so a runtime check owes a compiler rule.
  **Channel and tier (ADR 0028 s1):** compiler — an `LTC` rule for a `return` statement
  carrying a value in factory-body position on authored surfaces, tier 1 Prevented; runtime —
  a `DEV_MODE` warn in `connectedCallback` for hand-authored `.ts` consumers, tier 2
  Contained (the component still enhances; the return is ignored). Not urgent for the
  compiler-authored corpus (generated clients never return); aimed at prerelease early
  adopters migrating 2.x hand-authored components.
  **Check:** catalog rows added; compile-warning baseline 0 holds; batch the copy with the
  LT-275/LT-189 rounds.

---

## P5 — Wave 4: example migrations

**Framework framing (S0, 2026-09-18):** the corpus is no longer only a playground — it is the
**public showcase of the authoring surfaces** for the library's users, which is also the
resolution of COMPILER_REFLECTION §2's "default by rule, not by practice" finding: the owner's
LT-238 ruling (all three spellings side by side) makes the corpus the honest side-by-side demo
of the surfaces' trade-offs, and the wave-4 migrations bank the `.tsx`-default DX story the
reflection asked to see banked somewhere. ~~**Gated on LT-178/LT-179 only** (P4) — the other gates landed 2026-09-18: LT-202 (the
`.tsx` front end in the build) and LT-210 (the TSRX pin upgrade, 0.2.3; owner sequencing
2026-09-17).~~ **[2026-09-21] Those gates are merged (PRs #131/#132) and the wave is
opening in `TODO.md`.** **[2026-09-25]** LT-238, LT-212 and LT-213 are landed (module-codeblock
was the first migration). The remaining per-shape gates are: LT-291 (a compiled parent references a
twin-carrying tag), LT-303 (a migration authors a boundary: LT-104), LT-301 (a loop inside a
branch), LT-307 (a Simulated `.tsx`-served entry), LT-312 (a `.tsx` parent over a `.tsrx`
child), and LT-280 (the loop-heavy composites). LT-291, LT-307 and LT-312 are in the
2026-09-25 iteration, with LT-098–LT-103. **LT-266 addendum (2026-09-21, Architect ruling on review):** the loop-heavy
composites — LT-109 `module-calctable`, LT-110 `module-ticker`, LT-111 `module-todo` — are
**additionally gated on LT-280**: the size-bet conversion proved reactive-list loops lower to
a per-item text fill + events and nothing richer ([spike/size-bet/FINDING.md](spike/size-bet/FINDING.md)),
which cannot express their per-item pass/attribute wiring. The text-shape migrations
(LT-095–LT-108) are unaffected. LT-183 returned GO (ADR 0032, dual front end) — **migrations author
`.tsx`**;
the four `.tsx` variant-set members in `examples/` (moved there by LT-237) and
`ARCHITECTURE.md` § Authoring Surfaces are the shape reference. Otherwise unblocked. The canonical pattern is LT-092's, amended by [ADR 0039](adr/0039-canonical-plus-variants-authored-surfaces.md) (LT-238): same-commit cutover — **retain the `.ts` twin as a variant** beside the new `.tsx` source (it stops being the served surface but stays the artifact of record, and leaves the CEM globs while its component is compiled), point
`examples/main.ts` at the generated client, keep the demo/spec green
against the served compiled component. Surface compiler gaps in NOTES.md — or fix them
directly if small (LT-088 precedent) — never weaken a component to dodge a gap. **Per
migration, record the tier and the reason** alongside the zero-warning check; only the
Simulated tier opens a realm, so Folded and Static both mean near-zero added build cost
regardless of occurrence count.

**Two LT-165 obligations land on wave 4's first Static-tier component.** (a) `check:tsrx`
type-checks each module at its OWN classified tier and the Static census is empty, so the build
type-checks the Static emit path nowhere today; `emit-tier.test.ts`'s "dropped ⇒ name absent"
assertion stands in for it. The first real Static component closes the gap for free — confirm it
does. (b) Census reasons carry `origin: detail (line N)` but not the signal's `resolution`
(`realm` vs `none`), which is self-evident for today's Simulated reasons but not for a Static
one: a Static reason must also say why NOTHING answers it. Add the resolution to the reason text
then — the format is pinned and its tests update with it.

**Suppression records are incomplete by design** (LT-165 step 7). Reactive `truc:html`,
`class:`/`style:` maps (a shared-surface attribute, where a per-site revert would undo other
bindings' legitimate work) and `truc:pass`-into-child sites are NOT recorded, and a parent's
render does not consult a composed child's records. No corpus component hits these today. A
migration that produces a Simulated-tier component with an unresolvable read behind one of those
shapes must extend the record set FIRST — surface it in NOTES.md rather than shipping a site
that is suppressed in name only.

**`data-unreconciled` must survive its migration** (LT-185's root cause). Porting a component
to `.tsrx` silently dropped that attribute from form-tokenbox's input, and `reconcile()` then
removed the input as an unkeyed child — nowhere to type, no diagnostic. **`module-calctable`
(LT-109) and `module-todo` (LT-111) both carry `data-unreconciled` in their hand-written
sources today.** When migrating either, diff the emitted markup's attributes against the `.ts`
twin's before calling the port done, and assert the opt-out survives hydration the way
`equivalence-audit.test.ts`'s LT-185 regression test does for form-tokenbox. **LT-186 (P3) makes
this a compile error** — if it has landed by then, these two migrations get the check for free
and this note is redundant; if it has not, do the manual diff.

- [ ] LT-280: Per-item effect channels in reactive-list loops — the lowering covers text fill + events and nothing richer (LT-266 evidence). **Design first (grilling); gates the loop-heavy composite migrations LT-109/LT-110/LT-111.**
  **Skill:** architect (design + ADR) → le-truc-dev (implementation)
  **Context:** The LT-266 size-bet conversion drafted module-todo on `.tsx` in full and drove
  it through the compiler until it hit structural walls; the evidence and full analysis are
  pinned in [spike/size-bet/FINDING.md](spike/size-bet/FINDING.md) § "The TSX conversion
  attempt". The `ReconcilePlan`/`emitReconcileBlock` reactive-list lowering emits a per-item
  text fill (`watch(item, bindText(…))`, bare `{item}` only) plus event listeners — no
  per-item `truc:pass` (the composite children's `checked`/`value` wiring), no per-item
  reactive attribute (the reorder button's `disabled`), no per-item id/`for`, and a
  non-string item renders as `[object Object]` (module-todo's items are store-backed
  `createStore` objects). Composed children inside reactive-list bodies have no per-item arg
  channel at all (ADR 0024 sub-design 5). The same walls stand on `.tsrx` — this is a
  capability gap in the shared lowering, not a surface gap, and the module-list shape is the
  only loop it fully covers today.
  **Design questions to rule, not to skip:** (1) which per-item channels the lowering earns —
  pass, reactive attribute, id/`for`, composed-child args — and their reconcile semantics
  alongside the existing text fill; (2) the `.tsx` key spelling (`keyName` is hard-coded
  `null` on `.tsx`, `frontend/tsx/lower-tsx.ts` — a `.tsrx` `key k` loop has no `.tsx`
  spelling; ADR 0032 parity gap, related to the keyName grammar-asymmetry ruling LT-221
  recorded); (3) whether non-string item fills stay out of scope — if so that is a
  **silent-trap fix: channel = compiler, tier 1 Prevented** (today it misrenders as
  `[object Object]` with no diagnostic); (4) module-todo's own fate — hand-authored today by
  LT-266's ruling, but under LT-238's three-spelling showcase the flagship composite without
  a `.tsx` spelling is a standing hole in the product story, so the ruling must say which
  spellings module-todo carries when this lands. Coordinate with LT-274 (template-cloned-arm
  machinery may share extraction/addressing vocabulary; both touch the reconcile container),
  LT-242 (any new diagnostic must diagnose identically on both surfaces from day one).
  **Obligations:** the rulings amend ADR 0024 sub-design 5 and likely ADR 0032 (key
  spelling, equivalence scope) — record via `adr-keeper`, do not edit in place. Any new
  diagnostic names **Tech Writer as copy reviewer** (developer drafts; Tech Writer owns
  final wording) and enters the catalog per the error-message lifecycle.
  **Verification:** the design ruling recorded (ADR + task split if implementation is more
  than one change); module-todo (or the design's chosen flagship probe) compiles on the
  sanctioned subset with per-item wiring surviving hydration; parity suite extended;
  `bun test server/tests`, typecheck, warning baseline 0.

- [ ] LT-095: Migrate `basic-blogmeta` by reshaping it into a template owner with typed byline props (LT-033 decision). **Carries LT-173's deferred blogmeta fold verification.**
  **Skill:** le-truc-dev
  **Context:** Design decided 2026-08-29: fully-typed props, NO arbitrary pass-through
  (mediaqueries precedent) — `author` (string), `avatar` (optional URL string), `published`
  (datetime string), `modified` (optional datetime string), `reading-time` (optional number,
  minutes). The template re-emits ALL the schema.org microdata the old light DOM carried —
  `itemprop="author"`/`itemscope`/`itemtype="https://schema.org/Person"`, `datePublished`,
  `dateModified`, and `<meta itemprop="timeRequired" content="PT{n}M">` derived from the
  reading-time prop — with the avatar `<img>` behind an `@if` on the avatar prop and the
  modified span a conditional branch on prop presence. Author-supplied arbitrary siblings inside
  `<basic-blogmeta>` are dropped; consumers port to props. Locale formatting and invalid-date
  handling expressed via setup consts (server-safe, the `fn2Digits` precedent). Consumers to
  port: `examples/basic/blogmeta/basic-blogmeta.html`, `server/effects/pages.ts`
  (`emitBlogCards`), `docs-src/layouts/blog.html`, the examples.md demo markup.
  **Date handling is prescribed** (ADR 0030 s2, and it is what makes the fold possible): use
  `Date.UTC(y, m - 1, d)` with `timeZone: 'UTC'` in the formatter — never shifts the day, reads
  no ambient state. The current `new Date(year, month - 1, day)` + zone-less
  `Intl.DateTimeFormat` reads the build machine's timezone and must not survive the migration.
  Verify the component classifies Folded once migrated; LT-173 step 6 deferred its fold
  verification here.

- [ ] LT-104: Migrate `module-lazyload` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Has a spec + mocks (served under
  `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for:
  async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers
  alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. culori usage follows the `_common` setup point. If
  it composes other form components multiple times, use the static-attr discriminator addressing
  (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`,
  LT-035's compiled precedents exist in the corpus). Watch for: context effects' server-side
  rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Also ports
  `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the
  compiled artifact (or the served page, matching the corpus's spec conventions); mocks served
  under `/test/module-listnav/mocks/...` stay working. Note: LT-200 (merged with `next`)
  moved this component's initial hash sync into effect activation — the ported template must
  keep that shape.

- [ ] LT-108: Migrate `module-carousel` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Has a spec.
  Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Reactive lists
  lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on
  non-root children (LT-037) carefully. Formats numbers through `Intl`; read LT-142's fold rule
  and ADR 0029's tier split rather than re-deciding whether those thunks fold.

- [ ] LT-110: Migrate `module-ticker` to `.tsx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6,
  `IntersectionObserver`, `populate`). Expect this to stress the loop/effect analysis hardest —
  surface compiler gaps in NOTES.md rather than restructuring the component away from its
  demonstrated patterns. Formats through `Intl`; same tiering reference as LT-109. **This is
  LT-165 step 7's corpus pin:** Simulated tier with its `Math.random()` expression suppressed
  and everything else simulated.

- [ ] LT-111: Migrate `module-todo` to `.tsx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture).
  Has a spec. Completing this satisfies LT-014's trigger — after review, confirm the corpus
  sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common`
  helpers.

---

- [ ] LT-309: module-codeblock follow-through from the LT-096 review
  **Skill:** le-truc-dev
  **Context:** Two changes, both on `module-codeblock` (both surfaces where applicable).
  (a) The overlay's `on(overlay, 'click', …)` in `.tsx` setup is a workaround that LT-096's own
  selector fix made unnecessary. Its comment is now false. Inline it as `onClick={() => ({
  collapsed: false })}` on the overlay button and drop the explicit `overlay` ref if nothing
  else reads it. Verified in review: it lowers to `first('button:not(basic-button *)')` plus a
  guarded `on()`. Also fix the emitter printing an empty `if (overlay) {}` guard when a ref's
  only use is a setup `on()`.
  (b) The copy messages are read from the COMPOSED child's host (`copy.getAttribute(
  'copy-success')`). `copy-success` is not an attribute basic-button declares, so this reaches
  past the child's boundary (HOST_PROFILE § data account, bullet 3). The page chrome is also
  inconsistent: `fence.markdoc.ts` writes the pair on both hosts, while `fragments.ts`
  `tabPanel` writes it on the codeblock host only, so tab panels silently fall back. Make
  `copy-success`/`copy-error` module-codeblock's own config attributes: optional args with the
  current defaults, rendered on the root, read from `host`. Drop the duplicate on the inner
  basic-button in both chrome generators, and update the twin in the same commit. This is a
  contract reshape, approved here (the LT-095 checkpoint pattern). Spec: add a tab-panel-shaped
  fixture carrying custom messages on the host only.

- [ ] LT-310: Reactive attributes on the component root element
  **Skill:** architect → le-truc-dev
  **Context:** `collapsed={() => host.collapsed}` on a template root is LTC005 today ("reactive
  constructs on the component root"). So reflecting a Parser-exposed prop back onto the host
  stays a hand-written setup `watch('collapsed', bindAttribute(host, 'collapsed'))`, the last
  non-template statement module-codeblock needs besides the copy wiring. The pattern recurs
  (open/collapsed/expanded state on hosts). Design first: the server renders the root attribute
  from the arg, the Parser seeds from it at connect, and the thunk rebinds it. That is one
  channel, but LTC039's root-attribute exemption and the fold of `host.<prop>` on the root need
  checking against ADR 0024 s3 before implementation. Needs an ADR amendment or a short ADR;
  new diagnostics owe Tech Writer copy review.

- [ ] LT-311: Event handlers on compose sites
  **Skill:** architect → le-truc-dev
  **Context:** A PascalCase compose site has no event-attribute kind (only arg/pass/ref), so a
  parent's reaction to a composed child's event must be a setup `on(childRef, …)` or a raw
  `EffectDescriptor`. module-codeblock's copy wiring is the case: a guarded
  `watch(() => true, copy ? copyToClipboard(…) : () => {})`, because `if` is LTC005 and
  `watch()` in a const-call is LTC045. Proposal: `onClick={…}` on `<BasicButton>` lowers to
  `on(<compose-ref>, 'click', …)` on the child's host. The listener attaches to the child's
  public element, not its internals, so it respects the boundary; the compiler's optional-ref
  guard replaces the hand-written ternary. `copyToClipboard` then becomes a plain click-handler
  factory. Decide the typing: the `.tsx` host profile needs `on*` in `ComposeSiteAttrs`, and
  `.tsrx` needs the same classification. Depends on LT-309(b) for the message channel.

### LT-098–LT-103 review follow-ups (Architect, 2026-09-25)

The six wave-4 migrations landed Folded or Simulated with zero warnings. Their NOTES were
resolved into the tasks below, and one systemic finding surfaced: the compiler replaces an
authored `first()` selector with its own synthesized one. That silently narrows or widens the
hand-authoring contract (splitview `button.divider` → `button[role="separator"]`, colorinfo
`.hex` → `small`). LT-316 is the gate for the next migration batch (LT-104–LT-108), because
every migration trips it.
**[2026-09-25]** LT-316–LT-318 and LT-320–LT-324 moved to `TODO.md`: they sit on components the
current iteration migrated. LT-319 and LT-325 stay here.

- [ ] LT-319: One `truc:pass` spelling for several same-discriminator compose sites (NOTES LT-098).
  **Skill:** architect → le-truc-dev
  **Context:** module-colorinfo renders each channel's `basic-number` twice with one class.
  `truc:pass` needs a unique `first()` ref per site (LTC012), so the migration kept the twin's
  imperative `pass(all('basic-number.<channel>'), …)`. **Ruling (2026-09-25):** that imperative
  form is sanctioned — it compiles as a client-only setup statement, with the runtime backstop
  as its only legality check (ADR 0028 tier 2). **Design question:** should identical
  `truc:pass` objects on compose sites sharing a discriminator lower to one
  `pass(all(selector), …)`, regaining the compile-time check? Decide before a second component
  needs it. It is low priority while colorinfo is the only case.

- [ ] LT-325: Generate `.tsrx` tag-map typings instead of hand-listing generated clients in `examples/tsconfig.json`.
  **Skill:** le-truc-dev
  **Context:** A `.tsx` parent that queries a `.tsrx` child through `first`/`all('<tag>…')`
  needs the child's `HTMLElementTagNameMap` entry. LT-098/LT-100 got it by adding
  `basic-button`/`basic-number`/`form-spinbutton.client.ts` to the tsconfig's `files`, which is
  hand-listing again (the thing LT-312 removed for compose imports). Have `tsrx-imports.d.ts`
  (or a sibling generated file) carry each compiled `.tsrx` tag's map entry, typed through its
  props type, and drop the three hand-listed clients.

## P6 — Cleanup round (after the corpus port)

- [ ] LT-282: `docs-src/api/_media` mirrors have no refresh path (LT-272 residue, unfiled until the LT-179 review).
  **Skill:** docs-server-dev
  **Context:** `_media/*.md` inside the gitignored TypeDoc output dir are hand-copied mirrors
  of repo docs (`REQUIREMENTS.md`, ADRs). No build generates or refreshes them, so they go
  stale silently and freshness depends on somebody remembering (LT-272 hand-refreshed them
  once; the gap was left unfiled). Decide: generate the mirror in `build:docs` from the repo
  sources, or delete it and link the repo files instead. Filed while its staleness was
  re-observed during the LT-179 review.

- [ ] LT-249: Report non-string catalog values — a malformed `i18n/<locale>.json` entry is silent in both the census and sync (LT-217 review falsification). **Survives the LT-240 ruling, and grows a sibling:** ICU adds a second malformed-value class (a string that is not a parseable pattern), handled in LT-219 — land them as one `malformed` family with consistent copy, and drop the "LT-219 placeholder precedent" phrasing below for LT-219's argument-preservation case.
  **Skill:** docs-server-dev
  **Context:** Found by accident during the LT-217 review (2026-09-18): a catalog entry whose
  value is not a string — probed as a nested group, `{"basic-pluralize": {"stray.few":
  "wenige"}}` instead of the flat compound `"basic-pluralize.stray.few"` — is silently ignored
  everywhere: the translation census reports **0 gaps**, `i18n:sync` reports nothing and prunes
  nothing, and the entry sits in six catalogs forever. This is the silent-wrong-answer class in
  the exact channel (LT-196's) built to make catalog data problems loud, and the shape is
  realistic: a hand-editor nesting "under the component" is the most natural mistake there is.
  **Channel and tier (ADR 0028 s1):** the **build report / translation census**, tier **not
  applicable — a report, not an error**, same posture as missing/stale/orphaned: a catalog is
  DATA, the build never fails on it, and the compiler has no jurisdiction. Tech Writer owns the
  census wording (batch with LT-189 item 8's family).
  **How:** in `collectI18n`'s orphan walk (and the declared walk where values are read), a key
  whose value fails `typeof === 'string'` pushes a census record (new `TranslationGap['status']`
  case or reuse `orphaned` with a distinct reason — Architect's call at pickup; a distinct
  `malformed` case reads better). `i18n:sync` lists malformed entries in its summary and
  **cannot auto-fix** (it must not guess a shape — follow the LT-219 placeholder precedent).
  **Falsification probe to pin:** plant a nested-group value in a scratch catalog; census
  reports it; sync lists it unpruned; the flat twin behaves as today.
  **Acceptance:** the probe above pinned over the real catalogs with injection (LT-196 test
  pattern); committed catalogs stay gap-free; census/sync summaries unchanged when all values
  are strings.
- [ ] LT-093: Make LTC004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Skill:** le-truc-dev
  **Context:** Re-confirmed empirically 2026-08-29: `const DEFAULT = 'red'; const color =
  createCell(DEFAULT)` consumed only through a style-map still fires LTC004's "never rendered"
  message, though the signal IS credited as rendered (`thunkRendered`) —
  `substituteArgExpr`'s free-name gate rejects the verbatim initializer because the client
  module may not define the name. **Step 1 (small):** split the diagnostic — "rendered but
  initializer not client-portable" (name the offending free names) vs "never rendered".
  **Step 2 (goal):** feed signal-initializer free names into `computeClientNeededNames` as
  client-needed seed positions so plain-setup and import-local names in initializers place
  client-side; the fixpoint has grown accretively (clientSetup statements, composed refs, pass
  set-thunks — LT-069/087/088), so the plumbing gap is much narrower than when option (b) was
  judged heavy. Also fold in a compiler unit test for the `imports.plainLocalNames`
  `badFreeNames` widening (currently unexercised after the LT-091 redesign), and the LT-116
  finding that `returnsNumber`'s heuristic misses number-signal reads (`count.get()`) in `value`
  thunks, which now lack `String()` coercion under property dispatch — consult `inferredType` so
  the coercion fires for number-typed signal reads (no corpus offender today; add the unit test).
  **Re-triaged 2026-09-06 (LT-165 step 5 landed).** The ADR 0029 concern stands and has
  sharpened: LTC004 left the diagnostic channel, so a false firing on a fully
  phase-1-resolvable component now tiers it into simulation **silently** — it buys a realm and
  says nothing. It is not invisible, though: the tier census records the reason with its
  LTC004 origin and line, so the failure mode is inspectable rather than lost. Stays in P6 on
  that basis. **Cheap check to run at the end of wave 4, before this task:** scan the census for
  any Simulated component whose ONLY reason is a LTC004 origin — each one is a candidate false
  firing, and the list sizes this task's real payoff.

- [ ] LT-135: Follow plain-const indirection when crediting client-only setup reads (LT-119 sharp edge).
  **Skill:** le-truc-dev
  **Context:** LT-119 credits a signal in `thunkRendered` when a `clientSetup` statement reads
  it, but the check is `containsSignalGet(stmt.node, …)` on the statement itself. Hoisting the
  predicate into a plain setup const — `const isOpen = () => open.get(); watch(() => !isOpen(),
  …)` — moves the read out of the statement and the signal draws LTC004 again, so the author
  must repeat the predicate at every site (`form-combobox.tsrx` does, with a comment saying
  why). **Re-checked 2026-09-06 (LT-165 step 5 landed) — the original premise is false.**
  "The diagnostic is loud, not silent" no longer holds: LTC004 left the diagnostic channel, so
  hoisting a predicate into a plain setup const now routes the whole component to the Simulated
  tier with **no warning at all** — the author gets a jsdom realm instead of a one-line fix-it,
  and the `form-combobox.tsrx` comment ("repeat the predicate, here is why") is unenforced
  guidance the next author has no way to discover. The census reason still names the origin, so
  it is diagnosable after the fact. **Architect question at pickup:** this may warrant moving
  out of P6 — raise it rather than assuming the P6 placement still reflects its cost.
  **Fix:** resolve reads through `component.plainSetup` consts the statement names — the same
  one-hop widening `computeClientNeededNames` already does — or fold into LT-093, which is the
  same free-name-through-a-const wall from the other direction. The negative case is pinned in
  `server/tests/compiler/client-setup-credit.test.ts`; flip that test when fixing.

- [ ] LT-187: `reconcile()` misreports a DUPLICATE `data-key` as "key not present in the source" (LT-185 review finding).
  **Skill:** le-truc-dev
  **Context:** Pre-existing, found reading the removal branch during the LT-185 review. In
  `classify()` (`src/helpers/reactive.ts`) a child is adopted only when
  `harvested !== null && keySet.has(harvested) && !current.has(harvested)`. A SECOND child
  carrying a `data-key` that is in the source but already claimed by an earlier sibling falls
  through all three conditions to the removal branch, where it draws the keyed message —
  "key not present in the source" — which is false. The key IS present; the child is a
  duplicate. An author chasing that message looks at their data source, where nothing is wrong,
  instead of at the two elements sharing a key in their markup. Removing the duplicate is the
  correct action, so only the message is wrong, not the behaviour.
  **Fix:** distinguish the two cases at the branch — `keySet.has(harvested)` separates "duplicate
  key, first occurrence wins" from "key not in source" — and give the duplicate its own message
  naming the collision.
  **Channel:** runtime DEV_MODE advisory (REQUIREMENTS S3), same as its sibling — NOT an ADR 0028
  tier, for the reason recorded in LT-185's review. Statically decidable for the `.tsrx` corpus
  in principle, but the compiler emits `data-key` on `@for` items itself and cannot produce a
  duplicate, so no `TSRX` rule is owed; hand-authored `reconcile()` markup is the only source.
  **Copy:** Tech Writer owns the wording; batch it with LT-185's and LT-186's messages so all
  three read as one family.
  Acceptance: a duplicate-key child draws the duplicate message, a genuinely absent key still
  draws the existing one, and both are pinned (the existing message has no test today — add one
  while there); `test:src` green.

- [ ] LT-134: LTC035 and LTC042 give opposite advice on the same construct (LT-131 review finding).
  **Skill:** le-truc-dev
  **Context:** LTC035 (`duplicateIdAcrossArms`) tells the author "Give each arm's element a
  distinct id" — a static id per arm. LTC042 then warns on each of those static ids. Both are
  individually true (LTC035 is about two ids colliding within ONE instance, LTC042 about one
  id colliding across TWO instances) and the server-arg fix satisfies both at once, but neither
  message says so, and an author fixing LTC035 as instructed walks straight into LTC042. No
  corpus component hits it today. **Fix:** make LTC035's fix-it name the server-arg shape too —
  "give each arm's element a distinct id, taken as server args so they stay unique per instance
  (LTC042)" — and check whether LTC038 (`duplicateComposeId`) needs the same. Cheap,
  message-only; the point is that the diagnostic set should not contain a loop. **Tech Writer
  reviews the copy.**

- [ ] LT-136: Name the `@for` collection/server-arg shadowing in the tsc failure it causes (LT-119 review finding).
  **Skill:** le-truc-dev
  **Context:** A `@for (const x of items)` loop lowers CLIENT-side to
  `const items = all('<selector>')` — the loop's collection name becomes a query variable that
  SHADOWS the server arg of the same name. Setup or `expose()` code reading the arg then means
  two different things per half: server `items.length` is the array length, client
  `items.length` is `undefined` on a `Cell`. **Verified 2026-08-30, and it is loud:**
  `expose({ n: () => items.length })` over a `@for (const item of items)` loop compiles with
  ZERO compiler diagnostics but fails `check:tsrx` with `TS2339: Property 'length' does not
  exist on type 'Cell<HTMLSpanElement[]>'`, mapped back to the right `.tsrx` line. So this is a
  message-clarity task, not a correctness hole — same posture as LT-125. The tsc text names
  `Cell<…>` but never says *why* the author's `string[]` arg became one, and the fix (rename the
  loop binding, or project the value through `expose()`) is not discoverable from it. **Fix:**
  detect the collision in the compiler — a `@for` collection name that also names a server arg,
  where the arg is read outside the loop body — and emit a dedicated diagnostic naming both the
  shadowing and the rename. Low priority: no corpus component hits it, and the build already
  stops.

- [ ] LT-138: The `truc:html={}` sanitizer default is inverted between server and client (LT-128 verification finding). ~~**Gated: deferred until a component actually authors `truc:html`; none does today.**~~ **[2026-09-25] Gate tripped:** module-splitview.tsx (LT-102) authors static `truc:html={start}`/`{end}`, and no build path calls `configureHtmlSanitizer`, so a server-composed splitview renders its panes as escaped text. The static form never binds client-side, so it shows no flip yet; the reactive form's flip is still unverified. Promote with the next iteration.
  **Skill:** le-truc-dev
  **Context:** The two halves of one `.tsrx` source disagree on the default trust posture:
  `server/compiler/runtime.ts:335` defaults `htmlSanitizer` to escaping ALL markup (`<`/`>` →
  entities, so nothing ever renders — safe but inert), while the client's
  `dangerouslyBindInnerHTML` (`src/bindings.ts:652`) ships NO sanitizer and assigns raw unless
  `configureHtmlSanitizer()` was called. Both are configurable and both document themselves as
  "the library owns no sanitizer", but the DEFAULTS point opposite ways. For a reactive
  `truc:html={() => …}` that means an unconfigured app server-renders escaped, inert text and
  then flips to live markup on hydration — a visible content change and an inconsistent security
  posture from one authored attribute. **Unverified:** no corpus component authors the
  attribute, so this has never run end to end; confirm the flip with a fixture before designing
  the fix. **Decide** which default is right, then make both halves agree, and make
  `configureHtmlSanitizer` on one side not silently leave the other unconfigured.
  **One sanitizer serves both channels (settled by LT-152, 2026-09-03).** jsdom is in the build
  regardless of tiering, and DOMPurify's documented Node path
  (`createDOMPurify(new JSDOM('').window)`) was verified on it against two hostile payload sets.
  So: DOMPurify server-side through `configureHtmlSanitizer`, DOMPurify client-side, and
  `sanitize-html` retires. That matters beyond tidiness — two sanitizers with different
  allowlists mean a `truc:html` value that survives the server's filter can be altered by the
  client's at connect, i.e. a hydration diff in the one place a hydration diff is a security
  question. The retirement is small: `sanitize-html` was never a production dependency
  (`configureHtmlSanitizer` is called only from `server/tests/compiler/features.test.ts:25`).
  **ADR 0010's policy is untouched** — the library still ships no sanitizer and the consumer
  still supplies the hook; this is about what the compiler runtime is configured with and what
  the docs recommend.
  **Target state (owner, 2026-08-31): seamless Trusted Types.** The API is Baseline 2026 and the
  client half is already shaped for it — `Sanitizer` returns `string | TrustedHTML` and
  `dangerouslyBindInnerHTML` assigns through a cast a Trusted-Types-enforcing CSP accepts
  (`src/bindings.ts:35`, `:682`). The blocker is TypeScript's DOM lib and it has NOT lifted:
  `lib.dom.d.ts` in the installed TS 6.0.3 still has no `TrustedHTML` interface, which is why
  `src/bindings.ts:32` carries a local `type TrustedHTML = object` placeholder. **Unverified:**
  whether TS 7 fixes it — the published `typescript@7.0.2` tarball ships no `lib.dom.d.ts` in
  the old layout, so check against however TS 7 delivers its DOM lib before planning. Two things
  follow if it has landed: drop the placeholder for the real type, and decide whether the SERVER
  half gets a Trusted-Types-shaped seam too (it produces strings into markup so it cannot hold a
  `TrustedHTML`, but it can share one policy-configuration entry point with the client so an app
  configures trust ONCE rather than per environment — which is the actual fix for the
  inverted-defaults problem).

---

## P7 — Backlog (not scheduled)

**[2026-09-19, owner: explicit 3.0 non-goals parked here.]** Everything the framework-goal
sessions and their follow-ups deferred now sits in this band rather than floating as an
unstated intention. From P1: **LT-262** (the AEM/HTL spike — pioneer 3 is not a release gate;
ADR 0034 s6 names pioneers 1 and 2) and **LT-264** (the `@zeix/le-truc-simulation` split —
ADR 0035 s4 defers it to a later 3.x, once the seam has a consumer). Already here and
unchanged in status: **LT-214**, **LT-269**, **LT-270** (ADR 0042's checks over the parsed
sheet, each gated on a real need). **LT-268**, **LT-304**, **LT-305** and **LT-306** (the
accepted ADR 0033 scoping and the baseline guard) moved to P2b on 2026-09-24: they ship in 3.0.
Also non-goals for 3.0, recorded in their ADRs rather than as tasks: stage 2 of style
composition (ADR 0042 s3, ROADMAP), the declarative shadow-root spelling (ADR 0033 s8),
the foreign-runtime "Mounted" tier (ADR 0032, amended 2026-09-19), and publishing the
`.tsrx` front end (ADR 0034 s1, gated on `@tsrx/core` 1.0).

- [ ] LT-262: AEM/HTL integration spike — ahead of pioneer 3, not during it.
  **Skill:** architect
  **Context:** ADR 0034 s3 and its Bad consequence: AEM is a build-**integration** problem, not
  an emit problem. Component dialogs, the authoring model and clientlibs are undesigned, and the
  HTL emitter is the smallest part of it. Pioneer 3 is a client engagement, which is the wrong
  place to discover the shape.
  **Deliverable:** a spike answering how a compiler-emitted HTL partial reaches an AEM component,
  how clientlibs consume the generated client module and CSS, what the dialog/authoring model
  demands of the server-args surface, and what HTL's escaping contract requires that Twig's did
  not; the verdict written as tasks or as a recorded limitation. **Not release-gating for 3.0**,
  but scheduled well before pioneer 3 commits.
  **Check:** the spike either produces the HTL target's task list or records, with reasons, that
  AEM needs something the current artifact set cannot give it.

- [ ] LT-264: Split `@zeix/le-truc-simulation` out of the compiler package. **Not a v3.0 deliverable — a later 3.x, once the seam has a consumer.**
  **Skill:** le-truc-dev
  **Context:** [ADR 0035](adr/0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s4.
  With LT-263's seam in place the substrate can ship as its own package, so activation is
  installation: present or absent, no configuration flag, no dynamic import, no degradation path
  threaded through the compiler. Deliberately **not** scheduled for 3.0 — a third npm name, release
  process and changelog on a release already gated on two external projects (ADR 0034 s6), against a
  saving of ~50 KB of JavaScript over the optional peer dependency, since jsdom is the weight and an
  opted-out consumer never installs it either way.
  **Deliverable:** the package, an exact-range peer on `@zeix/le-truc-compiler`, and a CI matrix — the
  substrate executes *generated client modules*, so the two-phase load/render contract, the `define()`
  recording, the children-first compose ordering key and the emission shape all cross the boundary and
  the pair is in permanent version lockstep. **jsdom must be a regular `dependency` of the new package,
  not a devDependency** — a devDependency is not installed for consumers.
  **Check:** a consumer project installs the compiler alone and builds green with Simulated components
  routed Static; adding the substrate package alone re-enables the tier with no config change.

- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Skill:** le-truc-dev
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed the current
  unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no
  client task) only when the resolved value is read nowhere outside its own arm AND the guarding
  promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer
  of the async boundary — build fixtures around it, same caution as LT-077.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Skill:** le-truc-dev
  **Context:** Architecture decision 2026-08-29: generation-time inlining.
  `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the
  docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines
  `DEV_MODE='"true"'`), pass it to the compiler as a `devMode` option, and the compiler INLINES
  the folded constant into generated client modules. Generated code must never reference
  `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the
  library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration
  assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch —
  emitted only under the generation-time dev flag and folded away entirely otherwise.

- [ ] LT-214: Dead-rule detection over the parsed stylesheet (ADR 0042 s1). **GATED on a real need** (ADR 0042 is Proposed): the selector-prefix half of this task moved to LT-304 with the ADR 0033 ruling (2026-09-24).
  **Skill:** le-truc-dev (Tech Writer owns the message copy)
  **Context:** A rule under the component's own tag that matches **zero** elements of the
  rendered template warns: a typo, a renamed class, a rule left stale by a markup refactor.
  `matchesSelector`/`countForSelector` (`server/compiler/analysis/selectors.ts`) already
  answer it and are load-bearing for LT-118's branch-root collision check. **Channel
  compiler, tier 2 Contained**: light-DOM markup is not closed, so the check must
  **exempt** any subtree holding a compose node or `dangerouslyBindInnerHTML`, exempt
  `::slotted` and reaches into composed children, and respect LT-124's deliberate widening
  of class matching for page-authored enhancement. An over-eager version is worse than none.
  **Depends on LT-268.** **Coordinate with LT-245**: if the `css-select` + `parse5` spike
  lands, the check gets cheaper, so do not hand-roll a CSS matcher for it first.
  **Acceptance:** a fixture whose stylesheet names a class no element carries warns; a
  fixture with a compose site or `dangerouslyBindInnerHTML` in the matched subtree does
  **not** warn; corpus warning baseline stays 0.

- [ ] LT-269: Typed custom-property seam — `@property` registration derived from the signal's type (ADR 0042 s2). **GATED on a real consumer**: `bindStyle`/`setStyle` appears **nowhere** in the corpus or the docs components today, so this must follow a use, not precede one.
  **Skill:** le-truc-dev (Tech Writer owns the message copy)
  **Context:** `bindStyle` (`src/bindings.ts`) takes `string`, so every value crossing from
  a signal into CSS is stringly-typed at exactly the point where both sides are known at
  compile time — `infer-type.ts` has the signal's value type and the stylesheet is in the
  same file. Where a signal drives a custom property, check the two agree and emit
  `@property --x { syntax: '<number>'; inherits: false; initial-value: … }`, which hands
  enforcement to the browser too (invalid-at-computed-value-time instead of a silently
  dead declaration) and brings interpolation and animation along. **The hard part is the
  syntax, not the plumbing:** `inferType` returns only `string`/`number`/`boolean`/
  `unknown`, and `<length>` vs `<number>` is precisely the distinction CSS makes and
  TypeScript does not — so infer the syntax from the **CSS side**, where the property is
  consumed (`width: var(--w)` implies `<length>`), reusing LT-268's parse rather than
  inventing author-facing branded types. Channel: compiler; **tier 2 Contained** for the
  TS↔CSS disagreement, with the emitted registration carrying the runtime half.
  **Depends on LT-268.** **Check:** a fixture whose numeric signal drives a `<length>`
  property warns; the emitted `@property` block round-trips through the equivalence audit.

- [ ] LT-270: Typed style handle — stage 1 of style composition, unblocked from TSRX 1.0 (ADR 0042 s3).
  **Skill:** le-truc-dev
  **Context:** ADR 0033 sub-design 6 parked the whole composition package on TSRX 1.0
  because `.tsx` "has no such construct". That holds for **standalone** blocks only — a
  `<style>` in a children list with raw CSS as template syntax, which JSX cannot spell and
  which Le Truc wants least anyway (one tag-scoped sheet per component leaves
  sibling-scoping no role). **Assigned blocks** (`const theme = <style>{css`…`}</style>`)
  and `class={theme.dark}` are ordinary TSX, and that is where the anti-drift property
  lives: the class map is minted from the sheet the compiler parsed, so `theme.dark`
  cannot name a class the sheet does not define — a typo becomes a compile error instead
  of a silently dead class. **Stage 1 is the whole benefit with none of the machinery:**
  `theme.dark` lowers to the literal `"dark"`, emission stays verbatim, output stays
  byte-identical, no hashing and no selector rewriting. The one real surface change is
  accepting a `<style>` in **setup** position — today the sheet must be the root
  fragment's second child — and `.tsrx` must accept the same spelling or the two front
  ends drift (ADR 0032 s6). **Stage 2 (`apply={theme}`, several sheets merged, selectors
  regenerated into `my-element .dark` / `:host(.dark)`) stays backlogged on the original
  terms** — that is where sub-design 6's "CSS must be generated" cost actually sits.
  **Depends on LT-268.** **Check:** a fixture naming a class absent from its own sheet
  fails the build; corpus output byte-identical; both front ends accept the same spelling.
