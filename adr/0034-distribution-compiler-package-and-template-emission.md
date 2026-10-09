# ADR 0034: Distribution — `@zeix/le-truc-compiler` and Template Emission

## Status

✅ Accepted — sub-design 5 amended by [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md).

## Context

The compiler was built in this repo, for this repo: REQUIREMENTS [§5](../REQUIREMENTS.md#5-technical-constraints) declares a separate package at v3.0, but every v3 criterion is repo-internal. The harder fact: the fold happens when **this repo's build imports and runs the emitted server module** during its SSG pass, while [§1](../REQUIREMENTS.md#1-problem-statement)'s target backend is a Java/PHP/Python/C# CMS that cannot run Node — a mismatch of language *and* time. The Folded and Simulated tiers have one consumer runtime: this docs site. The adoption plan makes that load-bearing — three pioneers: a Zeix SSG project migrated from 2.x, a Zeix Craft (PHP) project, a client AEM (Java) project. Pioneer 2 cannot consume the server module.

## Decision

1. **The compiler ships as `@zeix/le-truc-compiler`** — named for its **function, not its input format** — while `@zeix/le-truc` stays the browser-only client layer. The `@tsrx/le-truc` name is withdrawn; the npm name registers before the first pre-release: a name is the one decision that cannot be revised after first publish. Its `/macros` subpath exports the **compile-time markers** an authored source imports (the `css` tag, `harvest()`). A marker is an import, never an ambient: a `.tsx` source is plain TypeScript, so the import is the only sign that a compiler consumes the call. The compiler recognizes a marker by module specifier and imported binding, so an alias resolves and a same-named local never matches, and it strips the import from both generated modules. The shipped stubs throw when reached uncompiled.

2. **Both authored surfaces ship; `.tsx` is the stable one, `.tsrx` is experimental.** The package compiles whatever the configured corpus carries — the entry point dispatches per file extension over the two first-class front ends of [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6 — and a consumer whose globs select `.tsx` only never reaches the `.tsrx` front end. The stability policy names the difference: the `.tsx` input surface is stable under semver from the first publish, while **the `.tsrx` input surface is experimental** — it compiles and ships, and it may change or be removed in any minor release while so labeled. The grammar, its pre-1.0 parser pin and its `TSRX###` codes are thereby not a compatibility obligation. `@tsrx/core` rides as the compiler's own build-time dependency — never in an emitted client module, never a consumer's direct dependency.

3. **The fold travels off SSG as template emission, not as HTML files.** For a CMS a folded partial and a template are the same artifact: page-supplied server args are *content*, so a fold per signature is combinatorially dead. The fold resolves everything independent of server args and leaves the server args as holes. The compiler gains a third emission target: a **partial with holes**, each server arg a template variable in the target language. **Twig at 3.0**, verified against the Craft pioneer; HTL follows. Targets sit behind a **target-emitter interface** decided before the first emitter ([ADR 0043](0043-the-target-emitter-interface-for-template-emission.md)) — only the interface is a 3.0 commitment, not the target set. Each target owns its escaping contract: an unescapable position is a compile-time diagnostic, never a silent unsafe emit. A v3.0 requirement ([M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission)) — pioneer 2's critical path.

4. **The partial-readiness invariant.** Folded output may depend only on the component's own server args plus a closed, enumerable ambient set — today the reserved `i18n` record ([ADR 0030](0030-internationalization-as-build-time-server-data.md) s2). Letting the fold read arbitrary page context forecloses emission — and the CMS persona. Checkable now, it binds every design from here; and because 0030 commits to per-locale SSG pages, a template's dimensionality is locale × component, not locale × server-arg combination.

5. **jsdom is an optional peer dependency; absence is a routing outcome.** Simulation is build-time in every case. Without the substrate, Simulated-routed components **route Static and record `unavailable substrate`** — a census row ([ADR 0029](0029-tiered-server-evaluation.md) s6), not a diagnostic: the zero-warning baseline is unaffected; a skipped install gets a degraded initial view and a report line, never a crashed build. Per [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md), this is implementable only once the seam cuts the compiler's substrate couplings — a prerequisite; that ADR also scopes the tier SSG-only.

6. **Adoption is staged; the release gate is a live consumer.** **v3.0 does not release until pioneer 1 is a live showcase and sub-design 3 is verified on pioneer 2**, via pre-releases; AEM's HTL and build integration follow for pioneer 3. The 2.x → 3.0 migration is codemod-assisted, not push-button: `.html`/`.css` move mechanically, the factory body copies verbatim, inline handlers and 1:1 effects transform deterministically; the residue — chiefly `first()` selectors to structural JSX — is reported for judgment. The codemod doubles as the measurement instrument: the baseline is captured before it runs.

7. **Per-request SSR stays out of scope for 3.x.** [§7](../REQUIREMENTS.md#7-out-of-scope) stands: a request-time JS sidecar contradicts the founding constraint — no JavaScript on the backend. Reconsidered no earlier than 4.0; sub-designs 3 and 4 keep it reachable without an authoring break.

8. **The compiler and the runtime version independently; a peer range ties them.** The public API is the compiler's exported entry points and result types, the `/macros` exports, and the generated-module API — emitted bytes are not API, and neither is the IR: it is the lowering, internal, and may change in any release. No TypeScript type appears in the public API, so the engine can move from the TypeScript 6 compiler API to TypeScript 7.1 or a native parser without a major. Emitted clients import the runtime, so the compiler declares it a **peer dependency**. Raising the peer floor is a compiler **minor**, never a major (older runtimes get a warning, not a silent break; a build check enforces the floor). Tightened contract types or a changed generated-module API is a major. The browser baseline belongs to the runtime major: default output (JS, CSS under default `cssTargets`) stays within it, so a compiler major never moves it alone.

## Alternatives Considered

- **Own the SSG ceiling (Static only for CMS)**: honest about today, a real product; rejected — the folded no-JS view is what is being sold to pioneers 2 and 3, and discovering the concession mid-engagement is worse than scoping it now.
- **Default-state partial**: cheap, backend-neutral, but no real content — Static tier with nicer structure; verifies nothing that matters at pioneer 2.
- **Pre-folded per instantiation**: content-bearing server args are unbounded, and the consumer must author a manifest — a new public API solving the easy half.
- **A per-request SSR runtime**: reverses the founding premise; see sub-design 7.
- **Ambient compile-time markers**: what `.vue` and `.svelte` do, where the file type already announces compilation; a `.tsx` source does not, so an ambient falls from nowhere and matches by bare name.
- **`@tsrx/le-truc` as the name**: names the product after the minority pre-1.0 surface the TSX adoption exists to route around.
- **Exclude `.tsrx` from the package**: the corpus this repo must compile with its own published package still serves 17 of 43 tags from `.tsrx` (including `basic-button`, the most-composed component), and every variant set's `.tsrx` twin compiles as a CSS-parity check ([ADR 0039](0039-canonical-plus-variants-authored-surfaces.md)) — the repo could not adopt its own package without first rewriting the corpus, a migration cliff gating distribution on nothing technical.
- **Publish both surfaces as stable**: makes the pre-1.0 grammar, its parser pin and its `TSRX###` codes a compatibility obligation before they settle. The experimental label ships the capability without the obligation.
- **A `.tsrx` → `.tsx` source-to-source pre-pass**, so the package compiles one format only: both surfaces are first-class adapters over one shared pipeline ([ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6), and a faithful transpiler between grammars that have diverged (the `css` tag vs the `{count}` shorthand, `@` directives) would be a third front end with the hardest job — worse than compiling both.
- **jsdom as a hard dependency**: what the repo does today — a heavyweight build dependency in every downstream install for a capability few components use.
- **Remove the Simulated tier**: [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md)'s call — sub-design 5 constrains it, not pre-empts.

## Consequences

**Good:**

- The headline capability becomes reachable by §1's personas; every v3.0 criterion becomes falsifiable outside `examples/` — a live pioneer, a verified Twig emit, a measured drift number.
- The partial-readiness invariant is a standing check that keeps per-request SSR reachable in 4.0 without an authoring break.
- Installs stop paying for jsdom unless they want the Simulated tier; the experimental `.tsrx` label ships the capability this repo needs without putting a pre-1.0 pin under semver.

**Bad / accepted tradeoffs:**

- Template emission is a substantial new subsystem inside 3.0 scope, scheduled against a client engagement's timeline rather than the repo's.
- **The escaping contract is a security boundary**: the compiler owns output encoding in a language it does not execute — a mis-encoded hole is an XSS — so per-target test corpora and the unescapable-position diagnostic are not optional.
- The release is coupled to two external projects; pre-releases mitigate, not remove.
- The experimental `.tsrx` surface ships to early adopters: its grammar bugs land in the package's tracker although `.tsx` is the recommended surface, and removing the surface later is still breaking for whoever adopted it, label or no label. The main `.tsrx` consumer is this repo, and [ADR 0039](0039-canonical-plus-variants-authored-surfaces.md)'s `.tsx`-default-served direction keeps shrinking it across 3.x — the label is a bridge, with removal pressure self-controlled.
- The optional peer adds a second supported configuration: CI must run with and without the substrate, and `unavailable substrate` is new routing code on a previously impossible path.
- AEM is a build-*integration* problem (dialogs, authoring model, clientlibs), not only an emit problem — it needs a spike well ahead of pioneer 3.

## Related

- Requirements: [§1](../REQUIREMENTS.md#1-problem-statement), [§5](../REQUIREMENTS.md#5-technical-constraints), [§7](../REQUIREMENTS.md#7-out-of-scope), [M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Related: [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) (the compiler never ships to clients), [ADR 0029](0029-tiered-server-evaluation.md) (census; SSG scope), [ADR 0030](0030-internationalization-as-build-time-server-data.md) (the ambient set), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) (parity contract), [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) (the seam), [ADR 0038](0038-runtime-neutral-build-path.md) (the build path's runtime contract), [ADR 0043](0043-the-target-emitter-interface-for-template-emission.md) (the target-emitter interface)
