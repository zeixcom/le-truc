# TODO

## Sequencing (architect, 2026-08-30, after the LT-118 review; wave 1 updated after the LT-127 review)

Seventeen hand-written examples still await migration (LT-095, LT-096–LT-111), and the
open compiler debt divides cleanly into "cheaper before those" and "cheaper after". The
recommended order, and the reasoning that puts the compiler first:

**Wave 1 — the addressing surface, before it multiplies. Two of three landed; LT-130 is
what remains.** Every migration adds `first()` sites and compose sites, so a change to how
elements are addressed costs more with each one landed. **LT-124** (landed 2026-08-30):
class discriminators are token selectors, and the same commit canonicalized `#id` — the
correctness fix, since LT-123's optional form had turned a selector mismatch from a thrown
required-reason into a silent no-op. **LT-127** (landed 2026-08-30): composed-element
`ref={}` retired, so composed and raw elements share one addressing mechanism. **LT-130
(open)** — two ref-addressed elements in one `@if` branch — is the last of the three and
should be done before wave 4: it is the limit that stopped LT-118 from reproducing its
twin's markup exactly, LT-100 (`module-catalog`) wants it landed first, and it is a
change to the same branch-addressing code LT-124 just touched. It does NOT block wave 2,
which is corpus work that touches no addressing code.

**Wave 2 — data-account debt on the corpus that is already migrated.** **LT-119** and
**LT-120** close the LT-112/113 ownership sweep. Worth doing before the remaining
migrations because the migrated corpus is the pattern the next seventeen are read against,
and it currently contains two reach-ins the data account forbids.

**Wave 3 — diagnostic honesty, each small and independent.** **LT-129** (TSRX039's
over-broad warning; no corpus component exercises the shape any more, so write the fixture
first), **LT-125**, **LT-126**, **LT-075**, and **LT-128** (an upstream question, not a
code change — answer it before more components adopt `html={}`).

**Wave 4 — the migrations themselves,** LT-095 and LT-096–LT-111. LT-100 (`module-catalog`)
wants LT-130 landed first; LT-095 (`card-blogmeta`) carries a reshape decision already made.

The one judgement call worth the owner's attention: this ordering spends roughly a wave and
a half on compiler debt before the migration count moves again. The alternative — push
migrations now, codemod later — is defensible if the corpus port is the deadline-bearing
goal, but LT-124 should jump the queue either way, because it is the one item that is
silently wrong rather than merely unfinished.

## Open — prioritized

- [ ] LT-132: Two `first()` names matching the SAME element silently drop the second (LT-127 review finding).
  **Skill:** le-truc-dev
  **Context:** `const a = first('input', 'a'); const b = first('input', 'b')` over a template with ONE `<input>` compiles with zero diagnostics. Both refs are attached to the same element — `compiler.ts` pushes a second `{kind:'ref'}` onto `element.attrs` — but every consumer reads it with `.find(a => a.kind === 'ref')` (`analysis/effects.ts:598`, `:812`, `:1402`, `analysis/harvest.ts:395`, `:440`), so only the FIRST name ever becomes a query. The generated client then declares `a` and references an undeclared `b`; `check:tsrx`'s emit-then-check catches it as a tsc error on GENERATED code, with no TSRX diagnostic and no source-mapped explanation of why. **Pre-existing since LT-055** (verified at HEAD on a raw element, not introduced by LT-127), but LT-127 widens the exposure: two names for one compose site were syntactically impossible while `ref={}` was an attribute, and are expressible now. **Fix:** diagnose it where the ref is attached — `compiler.ts`'s `elementRefs` loop for raw elements and `analysis/compose-refs.ts` for compose sites — when a matched node already carries a `ref` attr. Alternatively make the second name an alias of the first query (`addQuery` already dedups by selector+cardinality), but a diagnostic is the honest answer: two names for one element is a mistake, not a shorthand. Acceptance: both the raw and the compose shape report a source-mapped error, and no corpus component regresses.

- [ ] LT-131: A template-owning component cannot render a per-instance unique `id` (LT-124 review finding).
  **Skill:** le-truc-dev — but read the ruling below first; part of this is an architect decision already made.
  **The live case:** `examples/basic/gauge/basic-gauge.tsrx:114` renders `<p id="basic-gauge-label">` and wires `<meter aria-labelledby="basic-gauge-label">` to it. `basic-gauge.html` places THREE `<basic-gauge>` instances. The hand-authored page uses `basic-gauge-label-1/-2/-3`; the compiled template hardcodes one id, so a page built from `renderBasicGauge()` gets three duplicate ids and three `aria-labelledby` references that all resolve to the FIRST instance's `<p>` — invalid HTML and a real accessibility defect, in a project whose requirements make accessibility a goal. The demo page currently hides this by being hand-authored and out of sync with the template, the same drift that masked two latent bugs in LT-118 — so **regenerate `basic-gauge.html` from `renderBasicGauge()` as part of this task** and expect it to surface.
  **Ruling (architect, 2026-08-30):** the id is NOT the compiler's to generate. Inventing one (a counter, a hash) would make the server render non-deterministic across pages and give the client nothing stable to re-derive. It belongs to whoever instantiates the component — which is exactly the data account's bullet 3 position on instance discriminators (`class`/`id`/`data-*` at the compose site are the parent's channel). So: `basic-gauge` takes the id as a **server arg** with a documented default, the parent supplies a unique one per instance, and the template wires `id={labelId}` / `aria-labelledby={labelId}` from that single arg — one value, two sites, no duplication (it is not the TSRX039 shape: both sites are the SAME channel, not two channels for one value).
  **Also in scope:** a diagnostic. A static `id` attribute in a template is a latent duplicate whenever the component is instantiated more than once, and the compiler can see it at compile time. Warn on a static `id` in a template, with the fix-it naming the server-arg shape. Check the corpus for the other two (`basic-hello.tsrx:47` `id="subject"`, `form-colorgraph.tsrx:467` `id="color-error"`) — colorgraph's is the same `aria-*` wiring shape and probably the same fix; hello's may be a single-instance demo, which the warning would still (correctly) flag.
  **Acceptance:** `basic-gauge.html` regenerated and carrying three DISTINCT label ids, the `aria-labelledby` wiring correct per instance, the new diagnostic firing on a static-id fixture, and every spec green in both engines.

- [ ] LT-130: Two ref-addressed elements in one `@if` branch are rejected (LT-118 finding).
  **Skill:** le-truc-dev
  **Context:** `@if (zero) { <><span class="zero" hidden={…}>{zero}</span><span class="other" hidden={…}>+</span></> }` — two elements in one branch, each carrying client constructs and each bound to its OWN author-declared `first()` ref — is rejected with "Multiple addressable elements with client constructs inside one @if branch — union addressing addresses a single root per branch". The message is right about union addressing, but these two elements are not being union-addressed: each has its own optional query and its own `if (ref) { … }` guard, exactly like the same two elements written outside a branch. The one-root-per-branch limit exists because branch ROOTS are addressed by a synthesized union selector; an element the author addressed explicitly with `first()` does not need that and should be exempt. **Why it matters now:** it is the one thing that stopped form-spinbutton from reproducing the twin's markup byte-for-byte (bare `+` when no zero-state, two spans when there is — the `@else { <>+</> }` fragment arm this would have completed works fine on its own, verified). The component instead always renders `<span class="other">+</span>`, visually identical and harmless, but a shape the author did not choose. **Fix:** in `analysis/effects.ts`'s branch handling, count only elements WITHOUT an author-declared ref toward the one-addressable-root limit. Acceptance: the two-span `@if` arm above compiles, each span keeps its own guarded effects, and the existing union-addressing tests stay green.

- [ ] LT-129: TSRX039 fires on the sanctioned host-attribute OVERRIDE pattern (LT-118 finding).
  **Skill:** le-truc-dev
  **Context:** Found while restoring form-spinbutton (LT-118). Writing `step={step}` on the component's own inner `<input>` raised TSRX039 — "`step` is exposed through a Parser and is ALSO rendered into this component's own markup from the `step` arg". But `step`'s Parser is `asNumber(asNumber(1)(input.step))`: its FALLBACK reads that very input attribute. That is not duplication, it is the data account's explicitly sanctioned override — "a host attribute is a legitimate *override* where the contract defines precedence (host attribute wins over the harvested value), not a second copy" (TSRX-HOST-PROFILE § data account bullet 2), and LT-112 restored exactly that precedence for `value`/`min`/`max`/`step`. **The criterion, confirmed with the owner 2026-08-30:** fire only when the two channels carry the SAME value by different routes. Two shapes are not duplication and must not warn — (a) a Parser whose FALLBACK EXPRESSION READS the site being rendered (`asNumber(asNumber(1)(input.step))` reads `input.step`), which is the contract's declared precedence, and (b) a site whose value is deliberately DIFFERENT from the prop (form-spinbutton renders the control's `step` as `'1'`-or-`'any'` from the component's own `step` — related values, not one value twice). (b) already escapes because it is not a bare identifier; (a) is the one to fix. **Fix:** exclude a Parser-exposed prop whose fallback expression reads the same site the arg renders into — the warning should fire only when the two channels are genuinely independent copies (form-textbox's `value`, form-tokenbox's `description`, which remain true positives). **Note:** that workaround was REVERTED — the integer/float heuristic is deliberate and form-colorgraph depends on it (LT-118 owner remark 3), so spinbutton now renders `step={Number.isInteger(step) ? '1' : 'any'}`, which escapes TSRX039 through shape (b) rather than through the fix this task describes. Nothing is blocked, but no corpus component exercises shape (a) any more — write the fixture first. But the next author who writes the bare-identifier form for a fallback-reading Parser gets a warning telling them to do something the contract already does.

- [ ] LT-128: Decide `html={}`'s future against current upstream `@tsrx/core` — do NOT namespace it `truc:html`.
  **Skill:** le-truc-dev
  **Context:** Raised in the 2026-08-30 `truc:`-namespacing discussion and deliberately excluded from it. `html={}` is NOT a Le Truc host-owned attribute: `classify-attributes.ts:195` documents it as "the `.tsrx` spelling of the upstream `{html expr}` keyword (newer grammar than the pinned parser)" — a polyfill for core TSRX vocabulary that pinned 0.1.60 cannot parse. Namespacing it would fork from upstream and turn the eventual switch to the real construct into a second migration instead of a deletion. **Unverified:** that comment is the only evidence, and current upstream grammar was not checked (offline). **Do:** confirm against current `@tsrx/core` whether `{html expr}` exists and in what shape; if it does, plan the migration from `html={}` to it (and schedule it with the pin upgrade), if it does not, record that `html={}` is a Le Truc invention after all and re-open the namespacing question. Zero corpus uses today (`form-listbox`'s docstring mentions it; nothing authors it), so nothing is blocked — this is about not painting ourselves into a fork.
  **Not in scope:** `truc:text` was considered and dropped as speculative (owner, 2026-08-30) — the stated case, overriding a server-known empty string with a client-only binding, is already spelled `{host.X}` (what managed form props do) or `{() => …}`.

- [ ] LT-125: Diagnose a ref-derived setup local that reaches the server render (LT-121 review finding) — do NOT widen the stub set.
  **Skill:** le-truc-dev
  **Context:** LT-121's `refStub` covers `expose()`'s argument only: `emit-server.ts`'s `stubNames` is computed from `component.exposeArgNode`. A `first()`-bound ref read by an emitted SETUP statement outside `expose()` gets no stub. Reproduced 2026-08-30: `const input = first('input', '…'); const initial = input.value` with `<span class="label">{initial}</span>` compiles with ZERO diagnostics and emits a server module whose body is `const initial = input.value` with no `input` declared — `tsc` then fails with "Cannot find name 'input'", which `check:tsrx` catches. **The failure is loud, and it must stay loud.** The tempting fix — adding these names to `stubNames` — is WRONG: it would make the module compile and render `esc(String(refStub))`, i.e. an empty site where the author asked for a DOM-derived value the server cannot know. That is the LT-092 silent-empty-render class all over again. **Fix:** a diagnostic instead. A setup local whose initializer reads a `first()`-bound ref is client-only by construction; classifying it server-known and splicing it into the markup is the bug. Either exclude ref-derived locals from `serverKnown` (so the site is caught by the existing "no server-renderable value" machinery) or add a dedicated code naming the harvest form as the fix (`expose({ x: <ref read> })` + `{x}`, TSRX-HOST-PROFILE bullet 4). Small and self-contained; the probe above is the test.

- [ ] LT-126: `returnsNumber` does not detect number-signal reads, so no `String()` coercion is emitted (folded in from NOTES.md, 2026-08-30).
  **Skill:** le-truc-dev
  **Context:** `analysis/harvest.ts`'s `returnsNumber` recognises number LITERALS and conditionals over them only — a thunk reading a number-typed signal (`count.get()`) is not detected, so the coercion is skipped. Harmless while the only sink was `bindAttribute`; LT-116's dirty-flag widening makes `value` thunks on native controls lower to `bindProperty`, whose DOMString setter makes it reachable (`value={() => count.get()}` → generated client fails `check:tsrx`). No corpus source does this today, and LT-116's own tests pin only the literal/conditional shapes — so this is a latent gap with no current victim. **Fix:** consult the signal's `inferredType` for identifier `.get()` reads. Small, self-contained, blocking nothing; write the failing fixture first, since nothing in the corpus will fail for you.

- [ ] LT-119: form-listbox `visibleOptions` readonly prop; restore form-combobox's popup-visibility gate (LT-112 escalation decision).
  **Skill:** le-truc-dev
  **Context:** The twin hid the popup when zero options matched (`options.length > 0` in the visibility memo); the compiled listbox exposes no live visible-option state. Per the data account, add the missing child public prop — `visibleOptions` (readonly, derived from the filtered options list) on `form-listbox.tsrx` — and gate the combobox popup on it (compose through the declared interface; no reaching into the listbox's buttons). Re-flip the LT-092-flipped spec test to the original assertion. Small, self-contained; keep both specs green.

- [ ] LT-120: Retire the two pre-existing reach-ins via child public interfaces (LT-113 sweep findings).
  **Skill:** le-truc-dev
  **Context:** Two `querySelector` calls into composed children's owned markup violate the data account: `form-inplace-edit.tsrx`'s `textbox.querySelector('input')` (dblclick/click focus+select) and `form-combobox.tsrx`'s `listbox.querySelector('button[role="option"]')` (ArrowDown focus-first-option). Fix via boundary additions: `form-textbox` exposes a `focus()`/`select()`-delegating method (or focuses its own control via a public `focus` method matching native semantics), `form-listbox` exposes `focusFirstOption()`. Update both parents' handlers to the public calls; specs stay green; no behavior change.

- [ ] LT-093: Make TSRX004 honest for credited-but-unportable signal initializers, then thread initializer free names into client placement (LT-036's wall).
  **Skill:** le-truc-dev
  **Context:** Re-confirmed empirically 2026-08-29 (LT-071 re-evaluation): `const DEFAULT = 'red'; const color = createCell(DEFAULT)` consumed only through a style-map still fires TSRX004's "never rendered" message, though the signal IS credited as rendered (`thunkRendered`) — `substituteArgExpr`'s free-name gate rejects the verbatim initializer because the client module may not define the name. Step 1 (small): split the diagnostic — "rendered but initializer not client-portable" (name the offending free names) vs "never rendered". Step 2 (goal): feed signal-initializer free names into `computeClientNeededNames` as client-needed seed positions so plain-setup and import-local names in initializers place client-side; the fixpoint has grown accretively since the NOTES entry (clientSetup statements, composed refs, pass set-thunks — LT-069/087/088), so the plumbing gap is much narrower than when option (b) was judged heavy. Also fold in a compiler unit test for the `imports.plainLocalNames` badFreeNames widening (LT-090 review note — currently unexercised after the LT-091 redesign removed the corpus's two-way pass). Also fold in the LT-116 NOTES entry: `returnsNumber`'s heuristic misses number-signal reads (`count.get()`) in `value` thunks, which now lack `String()` coercion under the property dispatch — consult `inferredType` so the coercion fires for number-typed signal reads (no corpus offender today; add the unit test). No current migration is blocked by this wall (workaround: inline the constant or add a direct render site) — priority below the component tasks.

- [ ] LT-095: Migrate card-blogmeta by reshaping it into a template owner with typed byline props (LT-033 decision).
  **Skill:** le-truc-dev
  **Context:** **Design decided 2026-08-29 (checkpoint resolved):** fully-typed props, NO arbitrary pass-through (mediaqueries precedent) — `author` (string), `avatar` (optional URL string), `published` (datetime string), `modified` (optional datetime string), `reading-time` (optional number, minutes). The component's template re-emits ALL the schema.org microdata the old light DOM carried — `itemprop="author"`/`itemscope`/`itemtype="https://schema.org/Person"`, `datePublished`, `dateModified`, and `<meta itemprop="timeRequired" content="PT{n}M">` derived from the reading-time prop — with the avatar `<img>` behind an `@if` on the avatar prop and the modified span a conditional branch on prop presence. Author-supplied arbitrary siblings inside `<card-blogmeta>` are dropped; consumers port to props. Locale formatting and invalid-date handling expressed via setup consts (server-safe, the `fn2Digits` precedent). Consumers to port: `examples/card/blogmeta/card-blogmeta.html` (rewrite to attribute-configured usage), `server/effects/pages.ts` (`emitBlogCards` emits `<card-blogmeta author="…" avatar="…" published="…" modified="…" reading-time="…">`), `docs-src/layouts/blog.html`, the examples.md demo markup. Cutover is same-commit per the canonical pattern (LT-092): delete the `.ts` twin, point `examples/main.ts` at the generated client, drop any CEM exclusion, keep the blog pages rendering correctly (Playwright blog specs or a real-browser check).

- [ ] LT-075: Extend TSRX033 (impure server fold) to static/server-rendered attribute literals.
  **Skill:** le-truc-dev
  **Context:** Follow-up from LT-061. `classify-attributes.ts`'s `kind: 'server'` branch (e.g. `<div title={Date.now()}>`) isn't checked for impure ambients the way template children are. Needs a small refactor of `classifyAttribute`'s generic `invalidAttribute` wrapping (or a post-classification check in `lowerElement`, mirroring TSRX030). No current example exercises this — low urgency, cheap once someone's back in this area.

- [ ] LT-078: Implement conditional branch tree-shaking for `@try`/`@pending`/`@catch` (CHECKLIST §9).
  **Skill:** le-truc-dev
  **Context:** Performance optimization, not a bug fix (LT-065 confirmed current unconditional behavior is already safe). Needs a new usage-graph analysis: shake (emit no client task) only when the resolved value is read nowhere outside its own arm AND the guarding promise depends solely on server-definitive args. `form-listbox.tsrx` is the one real consumer of the async boundary — build fixtures around it, same caution as LT-077.

- [ ] LT-076: Establish a dev-mode signal for generated `.tsrx` client code, then implement the hydration assertion (CHECKLIST §6).
  **Skill:** le-truc-dev
  **Context:** **Architecture decision 2026-08-29:** generation-time inlining. `server/build.ts`/`server/effects/tsrx.ts` gain a dev/prod mode from the build pipeline (the docs site's examples bundle ships dev diagnostics today — `build:examples:js` already defines `DEV_MODE='"true"'` — so site/dev builds pass dev-mode ON; a prod site build flips it off), pass it to the compiler as a `devMode` option, and the compiler INLINES the folded constant into generated client modules. Generated code must never reference `process.env` (bundler-agnostic, constant-folded at generation, same philosophy as the library's own `--define`). With that signal in place, implement CHECKLIST §6's hydration assertion: on upgrade, recompute each folded expression and `console.warn` on mismatch — emitted only under the generation-time dev flag and folded away entirely otherwise.

- [ ] LT-096: Migrate `module-codeblock` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** Smallest hand-written example (~43 lines). Migrate `examples/module/codeblock/module-codeblock.ts` → `.tsrx` following the corpus precedents and TSRX-HOST-PROFILE.md. Cutover is same-commit per the canonical pattern (LT-092): delete the `.ts` twin, point `examples/main.ts` at the generated client, drop any CEM exclusion, keep the demo/spec green against the served compiled component. Surface compiler gaps in NOTES.md — or fix them directly if small (LT-088 precedent) — never weaken the component to dodge a gap. **Known pre-existing bug to fix during this migration (LT-117 review):** the twin calls `copyToClipboard(code, copy, {...}` bare — the `EffectDescriptor` is created and discarded, so the copy-click listener never attaches (label stays "Copy" on click; verified at HEAD). Per AGENTS.md it needs registration — `watch(() => true, copyToClipboard(...))` or returning it — and a spec assertion that click actually copies/toggles the label (verify via clipboard or button-text state).

- [ ] LT-097: Migrate `module-cem-list` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~39 lines, an `each()` loop over CEM manifest data. Migrate per the canonical pattern (see LT-096). Watch for: loop body reactive attrs on non-root children (the LT-037 fix), selector uniqueness among repeated items.

- [ ] LT-098: Migrate `module-colorinfo` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~86 lines, color info display. Migrate per the canonical pattern (see LT-096); culori usage follows the `asOklch.ts`/`_common` setup point (modes must be registered there, LT-091 finding 3).

- [ ] LT-099: Migrate `module-pagination` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, pagination controls. Migrate per the canonical pattern (see LT-096); has a spec — keep it green against `/test/module-pagination`.

- [ ] LT-100: Migrate `module-catalog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~94 lines, component catalog. Migrate per the canonical pattern (see LT-096); has a spec — keep it green against `/test/module-catalog`.

- [ ] LT-101: Migrate `module-dialog` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~75 lines, native `<dialog>` + `showModal()` orchestration. Migrate per the canonical pattern (see LT-096); has a spec. Watch for: `dialog.` method calls from client-only setup statements (LT-069 gate), focus-related event handlers as bare `on()` statements.

- [ ] LT-102: Migrate `module-splitview` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~77 lines, pointer-capture drag between panes. Migrate per the canonical pattern (see LT-096). Watch for: `setPointerCapture`/`PointerEvent` client-only ambients (LT-069 widened `JS_GLOBALS` for exactly this class of code).

- [ ] LT-103: Migrate `module-scrollarea` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~104 lines, scroll area with `IntersectionObserver`. Migrate per the canonical pattern (see LT-096); has a spec. Watch for: effect-with-cleanup idiom (`watch` + `return () => observer.disconnect()`, the LT-069 acceptance case).

- [ ] LT-104: Migrate `module-lazyload` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~114 lines, `createTask` async loading. Migrate per the canonical pattern (see LT-096); has a spec + mocks (served under `/test/module-lazyload/mocks/...`, resolved from the component dir's `mocks/`). Watch for: async boundary shape — this is one of the few real `@try`/`@pending`/`@catch` consumers alongside `form-listbox` (fieldset auto-wrap, LT-077/086); tree-shaking interplay with LT-078.

- [ ] LT-105: Migrate `module-coloreditor` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~120 lines, color editing UI. Migrate per the canonical pattern (see LT-096); culori usage follows the `_common` setup point. If it composes other form components multiple times, use the static-attr discriminator addressing (LT-087/089/090).

- [ ] LT-106: Migrate `context-media` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~142 lines, the context-protocol example (`provideContexts` + `requestContext`, LT-035's compiled precedents exist in the corpus). Migrate per the canonical pattern (see LT-096). Watch for: context effects' server-side rendering semantics; no spec exists — verify on `/test/context-media` in a real browser.

- [ ] LT-107: Migrate `module-listnav` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~129 lines, navigation list. Migrate per the canonical pattern (see LT-096). Also ports `examples/module/listnav/module-listnav.test.ts` — a unit test file — to run against the compiled artifact (or the served page, matching the corpus's spec conventions); mocks served under `/test/module-listnav/mocks/...` stay working.

- [ ] LT-108: Migrate `module-carousel` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~161 lines, `each()` items + `IntersectionObserver` autoplay gating. Migrate per the canonical pattern (see LT-096); has a spec. Combines the LT-097 loop concerns with the LT-103 cleanup idiom.

- [ ] LT-109: Migrate `module-calctable` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~200 lines, the heaviest `reconcile()` consumer (8 call sites). Migrate per the canonical pattern (see LT-096); reactive lists lower to the compiled `each()`/reconcile path (LT-003) — check loop-body reactive attrs on non-root children (LT-037) carefully.

- [ ] LT-110: Migrate `module-ticker` to `.tsrx` with same-commit cutover.
  **Skill:** le-truc-dev
  **Context:** ~283 lines, the most loop-dense example (`each()` ×11, `MutationObserver` ×6, `IntersectionObserver`, `populate`). Migrate per the canonical pattern (see LT-096). Expect this to stress the loop/effect analysis hardest — surface compiler gaps in NOTES.md rather than restructuring the component away from its demonstrated patterns.

- [ ] LT-111: Migrate `module-todo` to `.tsrx` with same-commit cutover — last hand-written example, completes the corpus port.
  **Skill:** le-truc-dev
  **Context:** ~379 lines, the largest example (`reconcile()` ×10, `each()`, pointer capture). Migrate per the canonical pattern (see LT-096); has a spec. Completing this task satisfies LT-014's trigger (every example outside `test/*` and `docs/*` is then `.tsrx`) — after review, confirm the corpus sweep: no `.ts` component files remain in `examples/` outside `test/`, `docs/`, and `_common` helpers.

- [ ] LT-014: Type-flow diagnostics — Volar language-core plugin over the LT-011 span table (ADR 0024 milestone 4, stage 2).
  **Skill:** le-truc-dev
  **Context:** Blocked on trigger: every example outside `test/*` and `docs/*` is cut over to its compiled client — that means LT-111 (module-todo, the last hand-written module example) AND LT-114..LT-117 finishing the five currently dual-state components (basic-number, basic-gauge, basic-pluralize, form-radiogroup, basic-button). CLI-first (LT-011, done) covers CI/agent workflows; this adds in-editor squiggles via a `@volar/language-core` plugin projecting the generated client module, reusing LT-011's span table.

---

## Done (archive)

Full task-by-task rationale, review notes, and corpus-impact numbers for everything below have been compacted out of this file; see git history (`git log -p -- TODO.md`) for the original entries if needed.

**TSRX compiler bring-up (ADR 0024 milestones 1–4):** LT-001/002 (compiler core + client codegen), LT-005 (isomorphic form-component format), LT-006 (CEM generation parity), LT-003 (reactive lists via `reconcile()`), LT-004 (Volar projection — infeasible, reshaped into LT-011), LT-008 (form-corpus migration enablers), LT-013 (tsrx.dev feature parity — `@switch`/`@try`/`html={}`), LT-011 (CLI-first span-table diagnostics, editor-level deferred to LT-014).

**Composition & children (ADR 0024 sub-design 10):** LT-015 (server-side PascalCase composition), LT-016 (`pass={{ }}` unified prop dispatch), LT-017 (two-way `pass()` codegen), LT-018 (`{children}` insertion), LT-019 (type-check generated server modules), LT-020 (module-list/form-textbox real composition).

**Async boundaries & control flow:** LT-012 (`isPending` routing, residue → LT-025), LT-023 (optional `@if`, hoisted handler consts), LT-024 (widened arg→DOM substitution), LT-025 (reactive `html={}`, `@try` addressing, `createMemo` — found LT-050).

**Example migrations, round 1:** LT-026 (`examples/basic/*`, found LT-027), LT-027 (`freeIdentifiers` TS type-position fix), LT-033 (`examples/card/*` — surfaced 3 genuine cliffs, now LT-071), LT-034 (plain-import placement inference), LT-035 (context protocol — `requestContext`/`provideContexts`).

**Bindings & reactive maps:** LT-030/029 (map-form `bind*()` overloads, merged), LT-028 (`style-map` AttributeIR, gaps → LT-031/032), LT-031 (`class-map` → `bindClass` array-form), LT-032 (root-level `class-map` exemption), LT-036 (style/class-map credited as harvest sites), LT-037 (`plain-imports.ts` traces `'server'`-kind attrs), LT-038 (`watch()` auto-wraps lazy-child thunks).

**Compiler regrouping (M1–M7):** LT-039 (`ir.ts`), LT-040 (`core.ts`), LT-041 (shared predicates → `ast-utils.ts`/`spans.ts`), LT-042 (`walk.ts` visitor), LT-043 (`evaluability.ts`), LT-044 (import handling, removed `node:path` — browser-purity gate), LT-045 (browser-bundle smoke test), LT-046 (remaining walks reviewed, won't-do), LT-021/LT-022 (`compiler.ts`/`analyze.ts` split into locality-focused modules), LT-047/LT-048 (direct unit tests for `evaluability.ts`, `loops.ts`/`naming.ts`), LT-049 (deleted dead `diagnostic.withLine`), LT-050 (`configureHtmlSanitizer()`).

**CHECKLIST.md triage (2026-08-26), conformance & ergonomics:** LT-051 (reactive-lift analysis, TSRX017), LT-052 (removed `&{}` sigil, TSRX018–020), LT-053 (`pass` → `truc:pass`), LT-054 (hard errors + codemod for near-miss React JSX, TSRX021–024), LT-055 (`ref={}` → `first()`, TSRX025–027), LT-056/LT-057 (`form.ts` reset-ordering + `defaultValue` baseline fix), LT-058 (TSRX028 — managed form member shadow), LT-059 (TSRX029 — named inner control), LT-060 (reconciled `form-textbox.revised.tsrx`, found the `@if` union-addressing bug), LT-061 (TSRX033 impure-fold rule, gap → LT-075), LT-063 (hydration — live-property harvest for dirty-flag attrs, assertion → LT-076), LT-064 (TSRX035 duplicate-id-across-arms, fieldset fix → LT-077), LT-065 (tree-shaking preconditions verified safe by omission, optimization → LT-078), LT-066 (TSRX030–032 authoring lint rules), LT-067 (docs pointed at tsrx.dev/llms.txt; eval re-run left as a manual user action), LT-068 (`TSRX-HOST-PROFILE.md` authored).

**2.5.1 form-reset release (shipped 2026-08-27):** LT-072 (ported form-reset fix to `bugfix/form-reset-baseline` off `next`, PR #119), LT-073 (form-docs consistency pass), LT-074 (changelog entry). Tagged `v2.5.1`; `next`/`package.json` now at `2.6.0`.

**Authored-import policy (ADR 0024 sub-design 16, re-amended 2026-08-27):** LT-079 (required explicit FactoryContext imports — superseded same day, highlighting rationale failed empirically), LT-080 (host-profile roster doc fix), LT-081 (migrated 53 test fixtures to the real-export import rule), LT-082 (sub-design 16 implementation itself — `REAL_EXPORT_NAMES`, scope-aware TSRX036/037, per-name import placement — reviewed ✓ 2026-08-29), LT-084 (rewrote host-profile's import section for the sub-design 16 policy).

**LT-127 review (architect, 2026-08-30):** Approved, committed as `59bcf3a3`. Read the `compose-refs.ts`/`first-refs.ts`/`plan.ts` diffs independently and re-ran the gates rather than trusting the handoff: server 1182/1182, `check:tsrx` 22/22 with the 18-warning baseline unchanged, tsc clean. The pass-split is the right shape — deferring a selector that names a custom-element tag is the only sound answer inside single-file `compileSource`, since rejecting there rejects a selector about to resolve. The three constraints in the handoff are all real and I confirmed the reasoning on the first: the discovery pass DROPS any file it errors on, so an error there is not a louder warning, it is a silent skip. Reviewer fix applied directly: TSRX027's message now says the discriminating attribute goes on the COMPOSE SITE, not inside the child, with an example — the handoff's own check (3), and the one place the message could send an author to edit the wrong file. On check (1): a typo'd raw custom-element selector now reports TSRX026 from pass 2 rather than pass 1 — same code, same message, later line, and `check:tsrx` still fails. Accepted; the ir.ts field docstring records it. On check (2): `analyzeClient` is called once per `compileComponent` and each call re-parses (verified — no other caller in `server/` or `scripts/`), so the IR mutation is sound; it is a layering wrinkle, not a bug, and the alternative (threading the registry into the front end) is the thing this task deliberately avoided. Not blocking, filed instead: LT-132 (two `first()` names matching one element silently drop the second — pre-existing since LT-055, widened by this task).

**Composed addressing (ADR 0024 sub-design 10, 2026-08-29/30):** LT-087 (`first()` widened to composed elements by resolved child tag + compose-site static attrs — design changed mid-implementation, approved), LT-089 (multiple same-source composed instances discriminated by a static `class`/`id`/`data-*`; client half sound, missing server half filed as LT-090), LT-090 (compose-site `class`/`id` materialized on the child's server-rendered root via `composeHostAttrs`), LT-127 (composed-element `ref={}` retired outright — compose sites are addressed by `first('<child-tag>.<discriminator>')` like any other element, resolved in the registry-aware second pass; LT-087's raw-AST pre-scan deleted with it).

**Client-setup gate & the form-colorgraph acceptance case:** LT-069 (client-setup free-name gate widened to element locals and effect helpers), LT-070 (first migration attempt — partial, split to LT-088), LT-088 (re-attempt, gated on LT-089, blocked on LT-090), LT-091 (first real-DOM coverage for a composed-ref component), LT-071 (deferred component-shape questions re-evaluated 2026-08-29, split into LT-093/094/095).

**`@try` arm inertness (CHECKLIST §8):** LT-077 (non-active arms auto-wrapped in `fieldset[disabled]`), LT-086 (`:has()`-based addressing replaced with a browser-baseline-safe alternative).

**Server folds & host-derived evaluability:** LT-085 (server-fold rule widened to derived `host.<prop>` thunks; TSRX034 escalated to an error for `disabled`/`checked` on real form controls).

**Site cutover and its remediation (2026-08-29/30):** LT-092 (docs site serves compiled `.tsrx` components instead of hand-written twins; folds in LT-094; remediation filed as LT-112/113, four stopped cutovers spun into LT-114..116), LT-112 (children-are-data harvesting restored, ported demos/specs re-swept), LT-113 (`form-textbox`'s `description` made writable, `module-coloreditor`'s reach-in reverted), LT-114 (root lazy text children get a client `bindText`), LT-115 (arg→DOM substitution no longer freezes reactivity; illegal root self-query fixed), LT-116 (loop-body boolean dirty-flag attrs lower to property writes), LT-094 (folded into LT-092).

**Enhancer-mode removal and the default-path capabilities it needed (2026-08-30):** LT-121 (server ref-stub crash — every harvesting component's `render*()` threw), LT-122 (`{arg}` sites gain the client binding when the arg names an exposed prop; TSRX039), LT-123 (site-inferred `first()` cardinality, TSRX026 required-only, TSRX008 bare root), LT-117 (`config.enhancer` and every enhancer-only branch deleted; `basic-button`'s harvest contract re-expressed in the default template-owning path).

**Addressing-surface correctness, wave 1 (2026-08-30):** LT-118 (`form-spinbutton`'s zero-state affordance restored; premised on wrong assumptions, corrected mid-flight — found LT-129/LT-130 and two latent bugs), LT-124 (class discriminators emitted as token selectors `span.label` rather than exact-match `[class="label"]`, with `matchesSelector` as the load-bearing half; extended to `#id` — found LT-131).

- [x] LT-082: Implement the sub-design 16 authored-import policy — real-export imports required, FactoryContext ambient again (LT-079 reversal) — reviewed ✓
  **Review (2026-08-29):** Approved. `REAL_EXPORT_NAMES` (`ast-utils.ts`) verified byte-for-byte against `index.ts`'s actual value exports (108/108, no missing, no extra) — the hand-maintained-duplication risk flagged in the handoff is real but currently accurate. `reportLeTrucImportMismatch`'s scope-aware scan correctly handles the `JSXCodeBlock` sequential-scoping case the LT-079 review defect required (verified by reading the `VariableDeclarator`/`BlockStatement`/`Program`/`JSXCodeBlock` branches). Unused-import detection is correctly split: `placeLeTrucImports` (imports.ts) owns "authored but never used" (TSRX014), `reportLeTrucImportMismatch` (compiler.ts) owns "missing" (TSRX036) and "context name in import line" (TSRX037, correctly promoted warning→error) — no overlap, no gap. `emit-client.ts`'s synthesized-import line now correctly guards against emitting an empty `import {  }` once authored imports can cover the whole name set. Re-ran the full verification suite fresh rather than trusting the handoff's numbers: `bun run scripts/check-tsrx.ts` (21/21 clean, only the pre-existing TSRX034 warnings), `bun test server/tests` (1062/1062 — the handoff's "60 failures" note was a pre-LT-081 snapshot, confirmed stale), `bun test src/tests` (426/426), `bun run build:cem` (64 declarations, no duplicate tags). Matches ADR 0024 sub-design 16 and its own "Rejected" log entry on the reversed explicit-import experiment. ADR 0024's status note updated to reflect LT-082 landing.
  **Skill:** le-truc-dev
  **Changed:** see full handoff in git history (`git show 1eacaeee`) — `server/tsrx/{ast-utils,imports,compiler,diagnostics,ir,emit-client,globals.d}.ts`, corpus (17 files), `server/tests/tsrx/{globals,le-truc-imports,client.golden}.test.ts` + 5 snapshots.
