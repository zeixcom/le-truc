# ADR 0034: Distribution — `@zeix/le-truc-compiler`, TSX-Only at 3.0, Folding Travels as Template Emission

## Status

✅ Accepted. Amended 2026-09-24 (owner, at the ADR 0040 acceptance): sub-design 8 adds independent versioning of the two packages.

## Context

The compiler was built in this repo against this repo. [REQUIREMENTS §5](../REQUIREMENTS.md#5-technical-constraints) already declares it ships as a separate package at v3.0, but every v3 success criterion is repo-internal, and the reflection's ratio test ([COMPILER_REFLECTION.md](../COMPILER_REFLECTION.md) §1) went unanswered: the machinery amortizes over 22 demo components until something outside `examples/` compiles through it.

Grilling the framework goal (LT-241, owner session 2026-09-19) surfaced a harder fact than packaging. The compiler emits three artifacts per component: `*.client.ts`, `*.css`, and `*.server.ts` — **a TypeScript module that only a JS build can execute**. Folding happens when `server/build.ts` imports and runs it during the Bun SSG pass. [§1](../REQUIREMENTS.md#1-problem-statement) names the target backend as a Java/PHP/Python/C# CMS that cannot run Node, and the mismatch is not only language but *time*: folding is build-time, CMS markup is request-time. Today the Folded and Simulated tiers — the capability the compiler exists to deliver ([ADR 0029](0029-tiered-server-evaluation.md)) — have exactly one consumer runtime, and it is this repo's docs site.

The owner's adoption plan makes this load-bearing rather than theoretical: three pioneer projects in order — a Zeix SSG project migrated from Le Truc 2.x, a Zeix Craft CMS (PHP) project, and a client AEM (Java) project — with outside adoption expected only after them. Pioneer 2 cannot consume `*.server.ts`.

## Decision

### 1. The compiler ships as `@zeix/le-truc-compiler`

`@zeix/le-truc` remains the browser-only client layer, unchanged and backend-agnostic. The compiler is a separate package named for its **function, not its input format** — the name survives `.tsrx` arriving in a later 3.x and template emission arriving alongside it. The `@tsrx/le-truc` name declared by §5 Required is withdrawn; the npm name is registered before the first pre-release, because a package name is the one decision that cannot be revised after first publish.

### 2. v3.0 publishes the `.tsx` front end only

`.tsrx` remains a fully supported *repo-internal* surface — the dual-surface parity contract ([ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md)) holds unchanged in this repo — but it is not part of the published package at 3.0. Publishing it would make the format, the pinned pre-1.0 `@tsrx/core` parser, and the `TSRX###` diagnostic codes public API before the format is stable. `.tsrx` support publishes in a later 3.x, gated on `@tsrx/core` reaching 1.0. This is the reason the TSX surface was adopted: it decouples shipping from that milestone.

### 3. Folding travels off SSG as **template emission**, not as HTML files

For a CMS, a folded HTML partial and a template are the same artifact. A Craft page's props are *content* — arbitrary title text, an entry list — so pre-folding per prop signature is combinatorially dead. What folding can do for a non-JS backend is resolve everything prop-independent and leave the props as holes; an artifact with holes that a backend fills is a template.

So the compiler gains a third emission target: a **partial with holes** — the component's markup with every prop-independent expression folded, and each server arg emitted as a template variable in a target template language. **Twig is the 3.0 target**, verified against the Craft pioneer project before release. HTL (AEM) follows for pioneer 3. *(Amended 2026-09-19, owner, at the LT-239 follow-up: targets sit behind a **target-emitter interface**, and it is decided before the first emitter is written rather than extracted from Twig afterwards. Only the interface is a 3.0 commitment; the set of targets is not. A second implementation must be addable without reshaping the first — see LT-257.)* Each target owns an explicit escaping contract: the emitter is responsible for placing the target language's escaping at every hole, and an unescapable position (a hole inside an attribute the target cannot escape safely) is a compile-time diagnostic, not a silently unsafe emit.

This is scoped as a **v3.0 requirement** ([M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission)), not a 3.x aspiration, because it is on pioneer 2's critical path.

### 4. The partial-readiness invariant

**A component's folded output may depend only on its own props and a closed, enumerable set of page-ambient values.** Nothing else may reach the fold.

Under sub-design 3 this is exactly what makes emission possible: the props are the holes, and the ambient set is what the emitter must pass through the include. The closed set today is the reserved `i18n` parameter ([ADR 0030](0030-internationalization-as-build-time-server-data.md) s2): `lang`, `t`, `timeZone`, `currency`, `dir`. A later design that lets the fold read arbitrary page context forecloses template emission and, with it, the CMS persona.

The invariant is checkable now and applies to every design from here forward, including designs that land before the emitter does. Because ADR 0030 commits 3.0 to per-locale SSG pages, a template's dimensionality is locale × component, not locale × prop-combination — the emitter emits one partial per component per locale, or one partial plus a locale hole, at the emitter's discretion.

### 5. jsdom is an optional peer dependency, and its absence is a routing outcome

The Simulated tier's substrate ships as an **optional peer dependency**. It is not gated on SSG versus SSR: simulation is build-time in both cases, and SSG/SSR only changes when the build runs.

When the substrate is absent, components that would route Simulated **route Static and record why**. The tier census ([ADR 0029](0029-tiered-server-evaluation.md) s6) gains an `unavailable substrate` reason. This is a census row, not a diagnostic, so the zero-warning baseline ([M23](../REQUIREMENTS.md#m23-census-reporting-zero-warning-baseline)) is unaffected. A consumer who skipped the install line gets a degraded initial view and a report line — never a crashed build.

This sets the floor for the open Simulated-tier ruling (LT-239): the tier is opt-in per consumer, because an optional peer dependency *is* opt-in. That ruling remains free to decide pluggability of the substrate and whether the tier survives at all; it is no longer free to make the tier mandatory for every downstream build.

**[Amended 2026-09-19, owner, at LT-239: this sub-design's decision stands, its premise was wrong.** The compiler as it stands cannot classify, report, or typecheck without the substrate — `server/compiler/tier.ts` imports `sim/patch-table` to decide tiers and to source census reasons, `sim/report.ts` is the build report that three non-simulating modules import, and `SimulationRealm` exposes `JSDOM['window']` in the published type surface. So "absent substrate routes Static and records a reason" is not implementable today: with no substrate there is no classifier. [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) s3 cuts those three couplings and is a **prerequisite of** this sub-design, not a refinement of it. ADR 0035 s4 additionally specifies the seam as a package boundary, so the substrate can later split into `@zeix/le-truc-simulation`; s2 scopes the Simulated tier SSG-only, because a simulated component's output cannot be expressed as a template (s3's holes) and so never reaches pioneers 2 and 3.]

### 6. Adoption is staged, and the release gate is a live consumer

Three pioneers in order: (1) a Zeix SSG project migrated from 2.x — the drift-cost measurement, taken as a before/after on the same components; (2) a Zeix Craft (PHP) project — the sub-design 3 verification; (3) a client AEM (Java) project — the HTL target and the clientlibs integration. **v3.0 does not release until pioneer 1 is live as a showcase and sub-design 3 is verified against pioneer 2**, exercised through a series of pre-releases. Outside adoption is expected only after the three.

The 2.x → 3.0 migration is codemod-assisted, not push-button: `.html` and `.css` move mechanically, the factory body copies over verbatim, inline event handlers and 1:1 effects transform deterministically, and the residue — chiefly resolving `first()` selectors to structural JSX — is reported for judgement. At pioneer scale (~50 components) that residue is affordable. The codemod is also the measurement instrument, so the baseline is captured before it runs.

### 7. Per-request SSR stays out of scope for 3.x

[§7](../REQUIREMENTS.md#7-out-of-scope) stands and [ADR 0029](0029-tiered-server-evaluation.md) s8 is unchanged. A JS sidecar the CMS calls at request time would serve the persona and would contradict the project's founding constraint — no JavaScript layer on the backend. It is reconsidered no earlier than 4.0, and sub-designs 3 and 4 are what keep it reachable without an authoring break.

### 8. The compiler and the runtime version independently; a peer range ties them

`@zeix/le-truc-compiler` and `@zeix/le-truc` serve different consumers and carry separate semver lines. The compiler's public API is `contract.ts` plus the generated-module API (the server render signature, the client module's exports); emitted bytes are not part of it. Emitted client modules import the runtime, so the compiler declares `@zeix/le-truc` as a **peer dependency**, and the peer range is where the two lines meet:

| Change | Compiler | Runtime |
|---|---|---|
| New IR member or optional IR field, e.g. for a third front end | minor | none |
| Emitted code starts using a newer runtime API | minor, raising the peer floor to that runtime minor | the minor that added the API |
| Tightened or removed `contract.ts` types, or a changed generated-module API | major | none |
| Runtime major | new peer range; major if the emitted code must change | major |

- **Raising the peer floor is a compiler minor**, never a major: a project on a current runtime is unaffected, and one on an older runtime gets a peer-dependency warning instead of a silent break. Emitted code must never use a runtime export newer than the declared floor; a build check enforces it (LT-254).
- **Adding a member to a published IR union is a minor.** The contract is written for front ends, which produce IR; `contract.ts` states that exhaustive switching over IR unions is not covered by its stability policy.
- **The browser baseline belongs to the runtime's major** ([REQUIREMENTS § Browser support](../REQUIREMENTS.md#browser-support)). The compiler's default output (emitted JS, and CSS under the default `cssTargets`) stays within the baseline of the runtime major its peer range names, so a compiler major never moves the baseline on its own.

## Alternatives Considered

- **Own the SSG ceiling: folding never travels; CMS consumers get Static tier only.** The honest description of today's state, and a real product — drift checking, typed queries, generated clients, i18n catalogs, CEM. Rejected because pioneers 2 and 3 are CMS projects and the folded no-JS initial view is the capability being sold to them; discovering the concession mid-engagement is worse than scoping for it now.
- **Default-state partial (b1): one folded HTML file per component using declared prop defaults.** Cheap, backend-neutral, comfortably in 3.0. Rejected as the 3.0 commitment because the initial HTML carries no real content — it is Static tier with nicer structure, so it would verify nothing at pioneer 2 that matters.
- **Pre-folded per instantiation (b3): a manifest of prop combinations to pre-fold.** Works for closed prop sets. Rejected: content-driven props are unbounded, and it would require the consumer to author an instantiation manifest — a new public API surface that solves the easy half of the problem.
- **Per-request SSR runtime (c).** Reverses the founding premise; see sub-design 7.
- **`@tsrx/le-truc` as the package name** (§5 Required, withdrawn). Names the product after the minority pre-1.0 surface the TSX adoption exists to route around.
- **Publish both surfaces at 3.0.** Makes a pre-1.0 format and its parser pin public API; the `.tsrx` diagnostic codes would become a compatibility obligation before they have settled.
- **jsdom as a hard dependency.** Simplest, and what the repo does today. Rejected: it puts a heavyweight build dependency in every downstream install for a capability two of 22 corpus components use, which is exactly the distribution cost the framework goal makes visible.
- **Remove the Simulated tier to avoid the dependency question.** Not this ADR's call — LT-239 owns it. Sub-design 5 constrains that ruling rather than pre-empting it.

## Consequences

### Good

- The compiler's headline capability becomes reachable by the personas §1 describes, instead of by this repo alone.
- Every v3.0 success criterion becomes falsifiable by something outside `examples/`: a live pioneer, a verified Twig emit, a measured drift-cost number.
- The partial-readiness invariant is a standing test that future designs can be checked against cheaply, and it keeps per-request SSR reachable in 4.0 without an authoring break.
- Downstream installs stop paying for jsdom unless they want the Simulated tier; dependency weight becomes a stated policy rather than an accident of how the repo was built.
- Dropping `.tsrx` from the 3.0 package removes a pinned pre-1.0 dependency from every consumer's tree and defers a public-API commitment that would be expensive to unwind.

### Bad

- **Template emission is a substantial new subsystem inside the 3.0 scope** — a per-target emitter, an escaping contract per target language, and a new public artifact format — scheduled against a client engagement's timeline rather than the repo's.
- **The escaping contract is a security boundary.** Emitting into Twig or HTL means the compiler is now responsible for output encoding in a language it does not execute; a mis-encoded hole is an XSS in a consumer's page. It needs its own test corpus per target, and the unescapable-position diagnostic ([ADR 0028](0028-tiered-error-surfacing.md) tier 1 Prevented) is not optional.
- **The release is coupled to two external projects.** v3.0 cannot ship until pioneer 1 is live and pioneer 2 has verified the emitter; pre-releases mitigate the risk but do not remove it.
- `.tsrx` authors get no published tool at 3.0. The surface stays first-class in-repo and the parity contract holds, so this is a distribution gap rather than a capability one — but it is a visible gap for anyone following the format.
- The optional peer dependency adds a second supported configuration to test: the compiler must be exercised in CI both with and without the substrate installed, and the `unavailable substrate` census reason is new routing code in a path that previously could not be taken.
- AEM is a build-*integration* problem, not only an emit problem — component dialogs, the authoring model, clientlibs — and none of that is designed. It needs a spike well ahead of pioneer 3.

## Related

- Requirements: [§1](../REQUIREMENTS.md#1-problem-statement), [§2](../REQUIREMENTS.md#2-user-personas), [§5](../REQUIREMENTS.md#5-technical-constraints), [§7](../REQUIREMENTS.md#7-out-of-scope), [M19](../REQUIREMENTS.md#m19-tiered-server-evaluation), [M20](../REQUIREMENTS.md#m20-server-simulation-realm), [M23](../REQUIREMENTS.md#m23-census-reporting-zero-warning-baseline), [M24](../REQUIREMENTS.md#m24-build-time-internationalization), [M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Architecture: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s7 (the compiler never ships to clients), [ADR 0029](0029-tiered-server-evaluation.md) s6/s8, [ADR 0030](0030-internationalization-as-build-time-server-data.md) s1/s2, [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md), [ADR 0038](0038-runtime-neutral-build-path.md) (the build path's runtime contract, consumer-visible with this package)
- Provenance: [COMPILER_REFLECTION.md](../COMPILER_REFLECTION.md) §1, §7; owner grilling session LT-241 (2026-09-19)
