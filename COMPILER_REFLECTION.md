# Compiler Reflection — is this the right compiler?

**Date:** 2026-09-18 · **Author:** Architect · **Scope:** the six owner questions against
[`server/compiler/LE_TRUC_COMPILER.md`](server/compiler/LE_TRUC_COMPILER.md), ADRs 0024/0027/0029/0030/0032/0033,
the 22-component corpus, and the structural evidence in [COMPILER_REVIEW.md](COMPILER_REVIEW.md).

This is a reflection document, not a plan of record. It deliberately argues rather than surveys: where I
think the design is right I say so briefly, and spend the words on where I think it is wrong or unproven.
Nothing here is scheduled; where an item becomes work it becomes an `LT-` task and, where it changes a
documented decision, an ADR.

---

## 0. Headline

**Three of the six answers are "yes, and the evidence is on the page." Three are "you are paying for
something you have not yet banked."**

| # | Question | Verdict |
| --- | --- | --- |
| 1 | Does a compiler of this shape make sense? | **Yes for the addressing analysis; not yet proven for the Simulated tier.** The single biggest simplification available is deleting a tier, not refactoring a module. |
| 2 | Do `.tsx`/`.tsrx` lower the DX gap? | **`.tsx` yes, substantially. The *dual* surface is a DX tax, currently paid and not banked** — zero corpus components are on the default surface. |
| 3 | Co-location and seamless composition? | **Co-location: achieved. Composition: typed and checked, but "seamless" is overclaimed.** i18n is the one place co-location visibly breaks down. |
| 4 | Does the i18n shape scale? | **No — the census machinery is excellent, the *message model* is not.** No interpolation is a hard ceiling, not a corner case. |
| 5 | Can OSS reuse cut maintained code? | **Yes: ~2.5–4k lines, concentrated exactly where COMPILER_REVIEW finds the drift.** Smaller than the tier question, larger than any refactor. |
| 6 | Rewrite part in Go/Rust/Zig? | **No, and not for sentimental reasons.** The output is TypeScript that `tsc` must check; there is no measured performance problem. Keep the option cheap, don't exercise it. |

The numbers that frame everything below: **21,812 lines of compiler + 16,466 lines of compiler tests =
38.3k lines of tooling serving 4,774 lines of authored components across 22 components.**

---

## 1. Does a compiler of this shape make sense for Le Truc at all?

### What it is actually three compilers

It helps to stop calling it one thing. `server/compiler/` bundles three jobs with very different
justifications:

**(a) A template → HTML-string emitter.** Mundane, well-understood, and cheap. Any project that wanted one
could have it. Not the reason this exists.

**(b) A DOM-addressing analyzer.** `first()` selector synthesis, structural uniqueness proof, harvest
planning (how does each signal seed itself from markup the server already wrote), per-branch addressing,
registry-aware resolution across compose sites. **This is the part that justifies the whole program.** It
exists only because Le Truc's client half is "enhance server HTML in place, addressed by selector" — a
constraint nobody else has, which is exactly why no library does this for you. It converts Le Truc's
single most common production failure (`MissingElementError`, a runtime browser error discovered late)
into a build failure. REQUIREMENTS §1 names this as the v3 problem in so many words: *"`first()` failures
are the symptom; drift is the disease."* This part is right, it is novel, and it is the moat.

**(c) A server-evaluation engine.** Tiers, the value harness, jsdom simulation, the suppression pass, the
fixed-point gate, the CI equivalence audit. The most expensive and least proportionate part.

Splitting them this way makes the real question answerable: **(b) justifies a compiler; (c) needs to
justify itself separately.**

### The Simulated tier is the biggest open question in the codebase

The census is **20 Folded / 2 Simulated / 0 Static** (`form-combobox` via compose-read, `form-listbox`).
Against those two components stand:

- `sim/` — 1,687 lines (realm, patch table, boundary, report)
- jsdom as a build dependency, plus `@types/jsdom`
- the fixed-point gate (connect run twice, byte-identical `outerHTML` required)
- the suppression machinery (snapshot skeleton state, revert after quiescence drain, never inside it — a
  subtle ordering constraint recorded only in prose)
- the CI equivalence audit: *every Folded component rendered through the realm as well*, byte-identical
  required (~4 s/run)
- `check:sim`, `eval:substrate`, `scripts/sim-portability-check.ts`
- a permanent second answer to "what does this expression evaluate to," which ADR 0027 itself named as the
  hazard it was avoiding, and which ADR 0029 answers with a test rather than by removing it

The compiler's own documentation contains the argument against it. §5.5, justifying why the Static tier
exists, says of a component whose unanswerable reads reach a rendered site: *"Simulating such a component
would spend the realm's per-occurrence cost and produce nothing the client does not already correct."*
That sentence is a general claim about the Simulated tier wearing a Static-tier hat. And §8's invariant —
**the emitted markup is byte-identical across all three tiers** — means the realm never changes the
*shape* of the served HTML, only some initial values inside it, which the client then corrects at connect
anyway.

So the question to grill, plainly: **what is materially worse if the Simulated tier is deleted and
`form-combobox`/`form-listbox` route Static?**

The honest answer in its favour is the no-JS experience: those two are the corpus's most
content-bearing form components, and a listbox that ships with its options' initial reactive state omitted
is a visibly worse no-JS page than one that ships them. That is a real argument and it may win. But it is
an argument about **two components**, and it should be made explicitly against ~1.7k lines of driver, a
jsdom dependency, a process-owning realm, a second evaluation mechanism, and a permanent CI audit whose
entire purpose is to police the fact that two mechanisms exist. Right now that trade has never been stated
as a trade — the Simulated tier arrived as ADR 0027 before the classifier existed to show how rarely it
fires.

**Recommendation:** put this to an explicit decision with the census in hand. If the answer is "keep it,"
record *why* in ADR 0029 so the next reviewer does not re-open it. If the answer is "retire it," this is
the single largest simplification available anywhere in the system — larger than every item in
COMPILER_REVIEW's four waves combined.

### The ratio test, stated honestly

38.3k lines of tooling for 4.8k lines of components is only justified by one of two things:

1. **The compiler ships beyond this repo.** ADR 0032 s5 explicitly dissolved the packaging gate ("the
   standalone core ships with no upstream dependency on the `.tsx` path"). But there is no second consumer
   today, and no adapter beyond Bun. Until a real project outside `examples/` compiles through it, every
   compiler line is amortized over 22 demo components.
2. **The drift class it prevents is genuinely expensive in the field.** Plausible — REQUIREMENTS argues it
   from agency experience — but unmeasured.

Both are believable. Neither is demonstrated. And it is worth naming that **REQUIREMENTS' own v3 success
criteria do not test the thesis**: "the example corpus is 100% compiled," "the warning baseline holds at
zero," "the equivalence audit is green" are all measured against this repository. They confirm the
compiler works; they cannot confirm it was worth building. The criterion that would is an external
adopter, or a measured reduction in drift bugs on a real client project.

**This is not an argument to stop.** It is an argument that the next milestone after v3's corpus goal
should be *one real project outside this repo*, and that the compiler's growth should be paused at that
gate rather than continuing to deepen against a 22-component corpus that already passes.

### Verdict

**Yes — a compiler of roughly this shape makes sense, because (b) cannot be bought and cannot be
hand-maintained.** But the shape currently in progress is wider than the justification: the evaluation
engine grew to three mechanisms for a corpus that exercises one and a half of them, and the cost is carried
by a consumer base of one.

---

## 2. Are the TSX/TSRX surface formats suitable to lower the DX gap?

### `.tsx` is the right call, and the win is concrete

Not a matter of taste — ADR 0032 s3 bought three specific things that are hard to overstate:

- **Editors work.** Plain tsserver, no projection, no span-table detour for authored code. LT-014 retired
  as moot. The single biggest DX item in the program.
- **The React prior becomes correct instead of diagnosed.** The entire TSRX021–024 near-miss family, the
  `className`/`htmlFor` rename table, and the codemod script exist because `.tsrx` is close enough to JSX
  that every developer's and every agent's instincts misfire. On `.tsx` those instincts are simply right.
- **Compose type errors land on the authored parent file** through real parameter types, checked by real
  `tsc`, with no remapping.

That is a genuine step toward framework-grade DX, and the spike proved it byte-for-byte.

### The dual surface is the problem, and its guard does not cover the failure

ADR 0032's own Consequences section lists the cost: *"every new front-end capability is built and paid
twice."* The standing guard against drift is the parity suite — *the same component authored in both
surfaces must render byte-identically.*

**COMPILER_REVIEW §2.3 documents three live drifts, and the parity suite could not have caught any of
them**, because all three are in the *diagnostic* path, not the render path:

1. The `.tsx` list-body diagnostic is unconditionally wrong (`offenders` is an array; an empty array is
   truthy) — an author hitting it reads `reads , which derive per item or client-side`. The `.tsrx` twin is
   correct.
2. `.tsrx` rejects a reserved `keyName`; `.tsx` omits that arm.
3. `.tsrx` rejects per-item `ref` attributes explicitly; `.tsx` falls through to a generic message.

Parity tests successful renders. Drift lives in failed ones. That is a falsifiable gap in the equivalence
contract and it should close: **extend the parity suite to diagnostics** — the same *invalid* component in
both surfaces must produce the same code and the same message text. That is cheaper than the
`SurfaceAdapter` refactor and catches the class the refactor is meant to prevent.

### The default surface is default by rule, not by practice

All 22 corpus components are `.tsrx`. The `.tsx` ports live in `spike/tsx/`. So today the project pays the
dual-front-end tax in full — two parsers, two lowering paths, two diagnostic vocabularies, a parity suite,
shared-module extraction work — and banks none of the `.tsx` DX benefit in its own corpus, docs, or
examples.

ADR 0032 cancelled the forced migration deliberately and for stated reasons, and that ruling stands. But
"cancelled" and "never" are different, and the current state is the most expensive point on the curve.
**Either migrate the corpus (banking the editor/tsc/prior wins, and making `.tsrx` genuinely optional
rather than genuinely primary) or accept `.tsrx` as primary and stop calling `.tsx` the default.** A
mixed corpus is fine as a destination; it is expensive as a permanent waiting room.

### What is still worse than a frontend framework — and why

Being honest about the residual gap matters more than cataloguing the wins, because some of it is
architectural and will never close:

| Gap | Fixable in the surface? |
| --- | --- |
| **Everything the client can show must already exist in server HTML.** The client toggles `hidden`; it never creates alternatives. | **No.** This is DOM-is-truth (ADR 0003/0024 s3). It is the trade the whole project is built on. See §4 for what it costs i18n. |
| **Addressing limits**: one reactive list per component; one addressable construct root per `@if` branch; composed children accept statics and server expressions only. | **No.** These are consequences of proving selectors structurally. They will be the top source of "why won't my component compile," and they have no analogue in any framework. |
| IIFEs for `switch`/`try` on `.tsx`; no statement-context arms. | Partly — this is exactly the ergonomics loss the dual ruling exists to soften. |
| `boundary({ ok, nil, err })` is host vocabulary to learn. | Acceptable; it is one construct. |
| CSS needs template-literal wrapping inside `<style>`; no `{count}` shorthand. | Cosmetic. |
| Styles are scoped **by tag name** (ADR 0033), not encapsulated. | By design; collision safety rests on convention. Worth stating in docs as a known limit rather than a feature. |

The first two rows are the real answer to the question. `.tsx` closes the *authoring* gap almost entirely
— the file looks like a React component and the editor treats it like one. It does not close the *mental
model* gap, and it should not pretend to: an author still has to know that markup is a proof obligation,
not a render target. **The documentation risk is precisely that `.tsx` makes the surface familiar enough
that authors stop expecting the constraints.**

### Verdict

**`.tsx` lowers the DX gap substantially and was the right decision.** The dual surface currently raises
the maintenance cost without lowering the DX gap for anyone, because nothing in the corpus uses the
surface that lowers it. Fix the parity suite's diagnostic blind spot regardless; decide the migration
question with a date.

---

## 3. Do we achieve co-location and seamless composition?

### Co-location: yes, and it is the clearest success in the program

One file carries server args, signals, `expose()`, markup, event handlers, and scoped styles. The
`basic-counter` pair is the proof — 78 lines, everything visible at once, no sibling files, no selector
that can silently stop matching. Against the v3 problem statement ("one component, three files"), this is
delivered.

Two honest qualifications:

- **Styles are co-located but not encapsulated.** ADR 0033 scopes by custom-element name. That is the right
  call for light-DOM components, but it means the co-location does not buy isolation — two components can
  still collide through a shared descendant selector. Worth being explicit about in docs.
- **i18n breaks co-location in practice, not in principle.** Source strings live in the component
  (`export const i18n`) — correct, and the right call versus per-component catalog files. But the rendered
  form of a message is smeared across the `export const i18n` record, the template markup, the `truc:case`
  attributes, and the CSS class names. See §4; `basic-pluralize` is the exhibit.

### Composition: typed and checked, but not seamless

What genuinely works, and is better than most frameworks manage: **compose-site argument types are checked
against the child's real parameter type, by real `tsc`, with the error on the authored parent file.** That
is a strong guarantee and `.tsx` made it cheap. `truc:pass={{ }}` legality is decidable at compile time
from the registry. Cross-surface composition falls out of the path-keyed registry for free.

What "seamless" hides:

- **A two-pass corpus orchestration** (registry discovery, then real compilation), with a duplicate-tag
  check that must run between the passes before ordering becomes load-bearing.
- **A contamination fixpoint over the compose graph** (§5.2): a parent that *reads* a child — `first()`
  addressing a compose site, or `truc:pass` into it — inherits its tier. So adding a `first()` in a parent
  can silently re-route the parent's whole server-evaluation mechanism. The failure mode is not an error;
  it is a different tier, visible only in the census.
- **Registry-aware `first()` resolution** across compose sites, with its own diagnostic (TSRX027,
  ambiguous compose addressing) and its own analysis pass.
- **`children` and `i18n` as reserved args**, `argsFromAttrs` as a static qualification gate for
  page-rendering (a component with a `children` arg or a required compose-only arg is silently never
  page-rendered).

None of that is wrong. But composition here is a *compile-time graph computation with tier consequences*,
not a function call. The gap between the authored experience (`<CardCallout kind="info">`) and the
machinery behind it is the widest in the system, and its failure modes are the ones least likely to be
understood by an author reading the error.

**Recommendation:** make tier contamination visible where it happens. The census reports a component's
tier and reason; it should name the *compose edge* that caused a contamination re-route, so "I added a
`first()` and my component left the Folded tier" is legible at the site rather than inferable from a build
report.

### Verdict

**Co-location: yes, delivered, and it is the program's clearest win. Composition: strong static checking,
genuinely better than the alternatives, but "seamless" overclaims** — it is seamless to *write* and
decidedly not seamless to *reason about* when something routes unexpectedly.

---

## 4. Does the i18n shape scale, and is it flexible enough?

**This is where I would push hardest, and it is the answer I am most confident about.**

### What is genuinely excellent

The *bookkeeping* design is better than most production i18n systems I have seen:

- Source strings declared inline in the component — no sibling catalog file, so the drift ADR 0024 cures
  is not reintroduced.
- **Bidirectional census**: every declared key must be translated *and* every catalog key must be declared;
  an orphan (renamed key, deleted component, translator typo) is reported because it can never render.
- **Reachability-aware in both directions** (LT-190/LT-217): a plural category outside the locale's
  platform set is the translator's nothing-to-do, not a gap.
- **Staleness via a committed manifest** of source-string hashes — a source edit invalidates exactly the
  translations it should.
- **No tiering and no override stack**: a key resolves in exactly one place. This is the single best
  decision in ADR 0030; override stacks are where i18n systems go to die.
- The catalog never reaches the client.

Keep all of that. It is not the problem.

### The message model is the problem

A message is **a static string literal**, resolved at build time, taking **no arguments**. Everything else
follows from that one constraint.

**1. No interpolation. This is a ceiling, not a corner case.**

"Hello, {name}" is not expressible as a message. The author must split it into template fragments around a
`<span>`. That works in English and breaks the moment word order differs — which is the entire reason ICU
MessageFormat exists. Any message containing a name, a count, a date, a product, or a link is affected.
After plain static strings, this is the *most common* i18n requirement, and it is unsupported.

**2. Plurals cost O(categories) in DOM, markup, keys and translation.**

`basic-pluralize` renders one pluralized noun as:

```tsx
<span class="zero" truc:case="zero" hidden={() => pluralCategory(host.lang, host.ordinal, host.count) !== 'zero'}>{t['task.zero']}</span>
<span class="one"  truc:case="one"  hidden={() => …!== 'one'}>{t['task.one']}</span>
…six in total…
```

Six spans, six thunks, six declared keys, six translations per locale, plus `truc:case-type` on the parent,
plus the pruning machinery, plus the reachability carve-outs in both directions of the census. The React
equivalent is `t('task', { count })`.

And this is *per pluralized noun*. A sentence with two count-dependent nouns is a cross product of spans.

**3. No `select` (gender, formality), no nested selects, no ordinal-and-cardinal in one message, no
inline formatting.** `{date, date, long}` and `{amount, number, currency}` are unexpressible; `timeZone`
and `currency` sit on the `i18n` *record* rather than inside the message, so formatting choices cannot
vary per message or per locale-specific phrasing.

**4. Locale is a build constant.** Per-locale pages, pruned per locale. Correct and elegant for an SSG docs
site. But REQUIREMENTS §1 says the target clients run **PHP, Java, Python, C# CMSes** — which render per
request, frequently at a per-user locale. A per-locale-page build model does not serve that. This is not a
defect; it is an undeclared scope boundary, and it should be declared.

### Is it flexible enough for "most use cases"?

**For a content site whose messages are mostly standalone static strings: yes.** That is this repository,
which is why it does not hurt yet.

**For anything with counts, names, dates or currency inside a sentence: no.** And that is most product UI,
including most of what the form components in this very corpus would need if they carried real prose.

### The fix, and its honest cost

**Adopt ICU MessageFormat for message values** (`@messageformat/core` compiles an ICU pattern to a plain JS
function at build time). A message becomes a function of its arguments; `t.task({ count })` is a
server-known expression that folds in the value harness like any other.

What that **deletes**:

- `truc:case` / `truc:case-type` — the whole per-category attribute vocabulary
- per-locale pruning of rendered alternatives (ADR 0030 s6) and its `pluralCategories` plumbing
- the reachability-aware carve-outs in both census directions (LT-190 and LT-217 complexity, in both
  walks)
- the `<key>.<category>` dotted-key shape rule and its "must end in a CLDR category" validation
- the six-span pattern, everywhere

What it **buys**: interpolation, `select`, nesting, inline number/date/currency formatting, and — not
incidentally — a message format translators and translation tooling already know.

**The honest cost, stated plainly:** today "the catalog never reaches the client" is an invariant. A
*reactive* message (one whose arguments change client-side, like `host.count`) would need its compiled
message function shipped, because the client can no longer select among pre-rendered alternatives. That is
a real break in a stated invariant and the owner's call to make.

But quantify it before rejecting it: it is a few hundred bytes for the *reactive messages of one
component*, versus six pre-rendered spans plus six thunks plus six bindings in the served HTML for a single
noun. Static messages — the overwhelming majority — stay exactly as they are, server-rendered, catalog
never shipped. The invariant would narrow from "never" to "only for messages whose arguments are
client-reactive," which is a defensible and much smaller claim.

### Verdict

**The bookkeeping scales beautifully; the message model does not.** The current shape is flexible enough
for static prose and nothing else, and the cost of each additional requirement is paid in DOM, markup,
keys and census complexity simultaneously. **This should be decided before the second locale ships end to
end**, because every component authored against the current shape is a component that has to be rewritten
if it changes.

---

## 5. Can OSS reuse significantly reduce maintained code?

**Yes — roughly 2.5–4k lines (12–18%), concentrated precisely where COMPILER_REVIEW finds the drift.**

### Why the original "no dependencies" instinct was right and is now wrong

The code is explicit about its own reasoning. `selector-syntax.ts`'s header argues the case directly:
*"pulling one in — or a DOM to probe with — for this one rule is not worth the dependency; the shapes
below are the ones a hand-written selector actually gets wrong."* That was a correct call at 5k lines.

At 21.8k lines with a *documented* drift record — five divergent "which names can the client resolve"
lists, four answers to "is this a signal read," sixteen hand-rolled template walks, eleven hand-rolled
estree walks with five different skip-lists, a scope analysis forked from `freeIdentifiers` that never
received a known bug fix — the calculus has flipped. **The hand-rolled versions are now the drift
source.** COMPILER_REVIEW §2.4/§2.5 is the evidence; this section is the cheaper remedy for the same
findings.

### Candidates, ranked by leverage

| Library | Replaces | Est. | Notes |
| --- | --- | ---: | --- |
| `@typescript-eslint/typescript-estree` | `frontend/tsx/to-estree.ts` (848 lines) | **−800** | This is *exactly* that package's job, maintained against every `typescript` major. Directly retires ADR 0032's stated "Bad" consequence: *"the converter must track `typescript`-major AST drift."* Highest leverage single swap in the table. |
| `eslint-visitor-keys` (+ `estree-walker` or `zimmerframe`) | the 11 hand-rolled estree walks, 5 skip-lists | **−200** | Settles "do we descend into type positions" by construction rather than five ways. Directly supersedes COMPILER_REVIEW wave-3 item 10 — better to adopt the canonical key table than to hand-write a twelfth walker. |
| `eslint-scope` / `@typescript-eslint/scope-manager` | `freeIdentifiers` + the forked `visit` in `front-end.ts` | **−300** | A **correctness** win, not just volume: the fork is missing the `ForStatement`/`ForOfStatement`/`CatchClause` cases the original grew. A maintained scope manager cannot have that class of gap. |
| `css-select` + `parse5` *(parse5 is already a dep)* | much of `analysis/selectors.ts` (590 lines) | **−300** | The structural-uniqueness proof currently walks the IR by hand in five near-identical copies. Parsing the markup the emitter *itself produced* and querying it with a real CSS engine answers the same question with far less machinery — and dissolves the latent `pendingChildren` inconsistency §1's "also worth a look" flags, rather than re-litigating it per call site. Needs care: the proof is over the *template* including unrendered branches, so branch arms must be materialized for the probe. Worth a spike. |
| `postcss-selector-parser` or `css-what` | `selector-syntax.ts` + `parseSimpleSelector`'s subset | **−250** | The subset is now the *limiting factor* on what `first()` can verify (descendant combinators, `:not()` — all "cannot verify"). A real parser widens verification and shrinks code at once. |
| `magic-string` | `spans.ts` bookkeeping, the `cursor.offset +=` invariant | **−150** | Gives real source maps free, which the playground (ADR 0025) will want anyway. |
| `@messageformat/core` | the plural-category machinery (§4) | **−?** | Net *capability gain*, volume secondary. See §4. |
| `lightningcss` *(already a devDep)* | `css.ts` dedent + tag-scoping | small | Nesting downlevel and minification come along. |
| `happy-dom` / `linkedom` | jsdom | — | **Only relevant if `sim/` survives §1's grilling.** Do not evaluate this before that decision. |

### What must stay hand-written

The IR, the tier classifier, harvest planning, `first()` addressing and cardinality, both emitters, the
compose-graph contamination fixpoint. These encode Le Truc's semantics. **There is no library for any of
them, and there should not be** — this is the (b) layer from §1, and it is the thing worth maintaining.

### Interaction with COMPILER_REVIEW

Wave 3 proposes writing the shared thing yourself in several places (one `walkEstree`, one selector
engine, a `CodeBuilder`). **Where a maintained library already is the shared thing, adopt it instead of
authoring version twelve.** Items 10 (`walkEstree`) and 11 (template walks) are the clearest substitutions;
item 15's `CodeBuilder`/`jsString()` should stay hand-written (it is small, and the escaping policy is
ours).

### Verdict

**Yes, meaningfully — but note the ordering.** Every library swap above, added together, is smaller than
the Simulated tier question in §1. Answer that first, then take these; otherwise there is a real risk of
carefully modernizing code that is about to be deleted.

---

## 6. Could part of the compiler be rewritten in Go, Rust or Zig?

**Technically yes for the middle layer. Practically no, and the reasons are structural.**

### Three blockers, in order of hardness

**1. The output is TypeScript that `tsc` must type-check — and that check is load-bearing.**

`check:tsrx` is emit-then-check against the generated modules. §6 states outright that the value-harness
signature contract is caught **only** there: *"no unit test sits between the emitter and the gate."* A
native compiler does not remove the need for a Node/Bun process running `tsc`; it adds a second toolchain
beside the one you still need. Worse, the *server* modules are checked because composition makes them
import each other's real types — that is a genuine type-system computation, not a lint.

**2. The `.tsx` front end *is* `typescript`.**

oxc and SWC parse TSX fine syntactically, and ADR 0032 already considered and rejected `oxc-parser` for a
good reason (*"recreates the pinned-0.x-parser boundary problem ADR 0024 just paid to contain"*). But the
deeper issue is that the DX wins of §2 — compose-site type errors on the authored parent, `expose()` drift
against `Initializers<P>`, the `JSX.IntrinsicElements` host profile — are **type-checker** work, not
parser work. That cannot move to any native parser. The front end would still be tsc, or the wins go away.

**3. jsdom.**

There is no Go/Rust/Zig equivalent with jsdom's fidelity, and fidelity is the entire point: `sim/` executes
the *real* generated client module in a *real* JS engine against a *real*-enough DOM. This is immovable —
unless §1 retires the Simulated tier, in which case the blocker disappears along with the reason to care.

### The candidate that remains, and whether it pays

The plausible target is the machinery layer — IR → analysis → emit, ~10k lines — compiled native or to
WASM, with `typescript` in front and `tsc` behind.

It does not pay:

- **There is no performance problem.** Build time appears as a complaint in no document. The corpus is 22
  components. The only measured cost driver anywhere is the realm at ~1.1 ms/occurrence and the equivalence
  audit at ~4 s per CI run — and neither is compiler CPU.
- **It costs a serialization boundary at the IR** (`ComponentIR` crossing FFI or IPC on every component),
  precisely where COMPILER_REVIEW wave 4 is trying to make the *type-level* contracts stronger. Two efforts
  pulling opposite directions.
- **It breaks the browser-purity gate.** `scripts/build-tsrx-browser.ts` bundles the front end for the
  browser with `node:*` externals unshimmed, CI-pinned — the seed of ADR 0025's in-browser playground. A
  native core forces that to WASM, which is possible but is a new build axis for a Proposed ADR's benefit.
- **It doubles the contributor bar** for a project whose contributors are agency frontend developers
  (REQUIREMENTS §2).

### Language-specific note, since it was asked

If it ever happens, **Rust is the only credible one** — `oxc`/SWC are real, mature JS/TS tooling
ecosystems. Go has `esbuild`, which does not type-check and does not expose an analyzable TS AST. Zig has
no ecosystem for this work at all; choosing it would mean writing the parser too.

### The cheap way to keep the option

**Keep `ComponentIR` a serializable data structure.** It nearly is already — `ir.ts` is documented as a
"pure type leaf," with `ExtractContext` (front-end mutable state, *with function members*) as the one
violation, which COMPILER_REVIEW wave 4 item 19 already proposes evicting. Doing that item preserves the
entire native-rewrite option **for free**, as a side effect of a cleanup that is worth doing anyway.

### Verdict

**No.** Not because it is impossible, but because the compiler's real constraint is a type system it cannot
take with it, and the performance it would buy is performance nobody is short of. Revisit only if (a) the
output artifact stops being TypeScript, or (b) build time becomes a genuine complaint on a real project.
Until then, take the free option value from wave-4 item 19 and spend nothing else on it.

---

## 7. What I would do, ranked

1. **Grill the Simulated tier against its 2-component census.** Biggest single lever in the system by an
   order of magnitude. Either record why it stays, in ADR 0029, or retire it — `sim/`, jsdom, the
   suppression pass, the fixed-point gate and the CI equivalence audit go with it.
2. **Close the parity suite's diagnostic blind spot.** Same invalid component, both surfaces, same code and
   same message. Cheap, and it catches the class where all three observed drifts actually live.
3. **Decide the i18n message model before the second locale ships end to end.** Every component authored
   against the current shape is a component that must be rewritten if ICU wins. The `basic-pluralize`
   six-span pattern is the exhibit; put it next to `t('task', { count })` and decide deliberately.
4. **Set a date on the surface question.** The current state — default by rule, zero adoption in the corpus
   — is the most expensive point on the curve. Migrate and bank the win, or stop calling `.tsx` the
   default.
5. **Take COMPILER_REVIEW waves 1–2 as written; substitute libraries into wave 3.** Specifically:
   `typescript-estree` for `to-estree.ts`, `eslint-visitor-keys` instead of a hand-written `walkEstree`,
   `eslint-scope` for the forked scope walk, `magic-string` under `spans.ts`. Spike `css-select` + `parse5`
   for the selector engine before committing to it.
6. **Do wave-4 item 19** (`ExtractContext` out of `ir.ts`) — it is worth doing on its own merits and it is
   the entire price of keeping the native-rewrite option alive.
7. **Do not rewrite in Go, Rust or Zig.**

And one that is not a compiler task at all: **find the second consumer.** The compiler's justification
(§1) rests on a claim about drift costs in real agency projects, and the only evidence that could confirm
it lives outside this repository.

---

## 8. What I would defend without hesitation

So the critique above is read at the right weight:

- **The addressing analysis.** Converting `MissingElementError` from a late browser runtime failure into a
  build failure is the real product, it cannot be bought, and it is well built.
- **Co-location.** The three-file drift problem is solved, and the single-file components read well.
- **`.tsx` as the surface.** Right decision, well evidenced by the LT-183 spike, with the DX wins measured
  rather than asserted.
- **"No tiering and no override stack"** in ADR 0030. A key resolves in exactly one place. That is the
  discipline most i18n systems lack and the reason the census can be bidirectional at all.
- **The test corpus.** 16.5k lines including golden snapshots, a cross-surface parity suite, and a 2.6k-line
  diagnostics suite. It is what makes every recommendation in this document and in COMPILER_REVIEW safe to
  attempt.
- **The documentation discipline.** Zero `TODO`/`FIXME`/`HACK` markers in 21.7k lines, every odd decision
  carrying a prose comment citing an LT number or an ADR. That institutional memory is why this reflection
  could be written from the repository alone.

The critique is about proportion, not about quality. The parts that are wrong are wrong because they were
built before the evidence that would have sized them existed — and that evidence now exists, in the
censuses this compiler generates about itself.
