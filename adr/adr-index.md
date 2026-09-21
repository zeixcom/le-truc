# ADR Index

Maintained by the `adr-keeper` workflows — update whenever an ADR is created, superseded, or changes status.

| Number | Title | Status | Related Requirements |
|--------|-------|--------|---------------------|
| [0000](0000-template.md) | Template | - | - |
| [0001](0001-use-cause-effect-as-reactive-primitive-layer.md) | Use Cause & Effect as Reactive Primitive Layer | ✅ Accepted | M1, M2 |
| [0002](0002-factory-form-over-builder-pattern.md) | Factory Form Over Builder Pattern | ✅ Accepted | M1 |
| [0003](0003-attributes-drive-state-at-connect-time-only.md) | Attributes Drive State at Connect Time Only | ✅ Accepted | M3, X1 |
| [0004](0004-slot-based-signal-swapping-for-inter-component-binding.md) | Slot-Based Signal Swapping for Inter-Component Binding | ✅ Accepted | M11 |
| [0005](0005-branded-parsers-and-methods-with-symbol-based-branding.md) | Branded Parsers and Methods with Symbol-Based Branding | ✅ Accepted | M13, S1, S2 |
| [0006](0006-lazy-mutationobserver-for-all-collections.md) | Lazy MutationObserver for all() Collections | ✅ Accepted | M7 |
| [0007](0007-effect-descriptors-with-deferred-activation.md) | Effect Descriptors with Deferred Activation | 🗑️ Superseded by [0018](0018-implicit-effect-collection-via-ambient-context.md) | M8 |
| [0008](0008-community-protocol-for-context.md) | Community Protocol for Context | ✅ Accepted | M10 |
| [0009](0009-security-validation-in-bindattribute.md) | Security Validation in bindAttribute | ✅ Accepted (partially superseded by 0010) | M16 |
| [0010](0010-trusted-types-support-via-sanitize-hook.md) | Trusted Types Support via the sanitize Hook | ✅ Accepted | M16, §4, §7 |
| [0011](0011-throw-on-pass-binding-failure.md) | Throw on pass() Binding Failure Instead of Warning | 🗑️ Superseded by [0028](0028-tiered-error-surfacing.md) | M11, S3 |
| [0012](0012-deprecate-unrestricted-write-short-forms-in-pass.md) | Deprecate Unrestricted-Write Short Forms in pass() | ✅ Accepted | M11, S4 |
| [0013](0013-cem-plugin-for-le-truc-factory-pattern.md) | Custom Elements Manifest via `@custom-elements-manifest/analyzer` Plugin | ✅ Accepted | M13 |
| [0014](0014-keyed-per-element-scopes-for-memo-collections.md) | Keyed Per-Element Scopes for Memo-Driven Collections | ✅ Accepted | M5, M6, M7, M11, §1, §4 |
| [0015](0015-late-provider-retry-in-requestcontext.md) | Late-Provider Retry in requestContext | ✅ Accepted | M10 |
| [0016](0016-element-internals-for-form-association-and-states.md) | ElementInternals for Form Association and Custom States | ✅ Accepted | M1, §4 |
| [0017](0017-keyed-template-clone-reconciliation-for-lists.md) | Keyed Template-Clone Reconciliation for Lists | ✅ Accepted | M5, M6, §1, §4, §6 |
| [0018](0018-implicit-effect-collection-via-ambient-context.md) | Implicit Effect Collection via Ambient Context | ✅ Accepted | M8, M5, M6 |
| [0019](0019-extension-based-dependency-injection-for-definecomponent.md) | Extension-Based Dependency Injection for `defineComponent()` | ✅ Accepted | M1, X1, N1, §4 |
| [0020](0020-merge-based-validity-composition-and-relayvalidity.md) | Merge-Based Validity Composition and `relayValidity()` | ✅ Accepted | M1, §4 |
| [0021](0021-root-parameterized-query-and-queryall.md) | `query`/`queryAll` — Root-Parameterized Siblings of `first`/`all` | ✅ Accepted | S6, M4, M8, M14 |
| [0022](0022-debug-extension-for-visual-and-console-instrumentation.md) | `debug()` Extension for Visual and Console Instrumentation | ✅ Accepted | S3, N1, M5, M6 |
| [0023](0023-map-form-overloads-for-bind-helpers.md) | Map-Form Overloads for `bindStyle`/`bindAttribute`/`bindClass`/`bindProperty`/`bindState` | ✅ Accepted | M5 |
| [0024](0024-adopt-tsrx-as-isomorphic-component-format.md) | Adopt TSRX as the Isomorphic Component Format | ✅ Accepted | M1, M3, M4, M10, §1, §4, §5, §7 |
| [0025](0025-client-side-tsrx-playground.md) | Client-Side TSRX Playground | 🔄 Proposed | §1, M12, M13, S2 |
| [0026](0026-aria-reflection-via-elementinternals-and-bindaria.md) | ARIA Reflection via ElementInternals and `bindAria()` | ✅ Accepted | M1, M3, M5, §4 |
| [0027](0027-server-simulation.md) | Server Simulation — Render Initial HTML by Executing the Client Module | ✅ Accepted | §1, M5, M6, M8, §5, §7 |
| [0028](0028-tiered-error-surfacing.md) | Tiered Error Surfacing — Compiler First, Contained Runtime | ✅ Accepted | M11, M15, M16, S2, S3, S5, §4 |
| [0029](0029-tiered-server-evaluation.md) | Tiered Server Evaluation — Route Each Component to the Cheapest Phase That Can Answer | ✅ Accepted | §1, §5, §7 |
| [0030](0030-internationalization-as-build-time-server-data.md) | Internationalization as Build-Time Server Data | ✅ Accepted | §4, §5, §7 |
| [0031](0031-pre-connect-property-writes-capture-and-install.md) | Pre-Connect Property Writes Are Captured and Installed | ✅ Accepted | M2, M3 |
| [0032](0032-adopt-tsx-as-the-authored-component-surface.md) | Adopt `.tsx` as the Primary Authored Component Surface (`.tsrx` Retained) | ✅ Accepted | M1, M3, M4, §5, §7 |
| [0033](0033-scope-component-styles-by-custom-element-name.md) | Scope Component Styles by Custom Element Name; Shadow DOM as the Opt-in; TSRX Style Composition Translated to It | 🔄 Proposed | M17, M18 |
| [0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) | Distribution — `@zeix/le-truc-compiler`, TSX-Only at 3.0, Folding Travels as Template Emission | ✅ Accepted | §1, §5, §7, M19, M20, M23, M24, M27, M28 |
| [0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) | The Simulation Seam — an SSG-Scoped Simulated Tier, a DOM-Free Realm Boundary, and a Substrate Package | ✅ Accepted | §1, §5, §6, M19, M20, M23, M27, M28 |
| [0036](0036-corpus-configuration-surface.md) | The Corpus Configuration Surface — `le-truc.config.json`, This Repo as a Consumer | ✅ Accepted | §1, §2, §5, M24, M28 |

---

**Last updated:** 2026-09-21
