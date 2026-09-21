# ADR 0038: Runtime-Neutral Build Path — the `RuntimeIO` Seam, One Glob Grammar, and the Portability Gate

## Status

✅ Accepted

## Context

The compiler's build path executes JavaScript. The corpus compile imports and runs the emitted `*.server.ts` modules to fold ([ADR 0029](0029-tiered-server-evaluation.md)), reads the configured sources, writes the output tree, and spawns typechecking — and every one of those steps originally reached for Bun's globals (`Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.Glob`). For repo tooling that is fine; [§5](../REQUIREMENTS.md#5-technical-constraints) names Bun this repo's primary build tooling. But [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1 commits the compiler to shipping as `@zeix/le-truc-compiler`, and [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight) makes the installing developer a persona. The moment the package exists, its build path's runtime requirement is consumer-visible — and "requires Bun" would prescribe a toolchain to every consumer, when the honest floor for executing a JS package's build is already *a* JS runtime (Node type-strips it unflagged since 22.18).

Two standing constraints already pulled the same direction: `server/compiler/` is pinned browser-pure ([M25](../REQUIREMENTS.md#m25-tooling-continuity)) and may carry no `node:` specifier in the CI-pinned browser bundle ([ADR 0036](0036-corpus-configuration-surface.md) s5), and the corpus config is JSON rather than an executable module precisely so no runtime-specific loader couples to it (ADR 0036 s1). The file-IO, glob and spawn layer was the last Bun-coupled surface; LT-267 landed the seam (2026-09-21, reviewed the same day). This ADR records the decision before the package's first publication (P6-gated LT-254), because the contract below is consumer-visible the moment the package exists.

## Decision

### 1. The build path requires a JS runtime, not Bun specifically

All file IO, globbing and process spawning on the build path goes through one interface, `RuntimeIO` (`server/runtimes/`): `readTextFile`, `fileExists`, `writeTextFile`, `copyFile`, `scanGlob`, `matchGlob`, `spawn`. Two implementations exist side by side — `bun.ts` (Bun natives) and `node.ts` (`node:fs` / `node:child_process`, which Bun and Deno both implement) — and each is loadable under any runtime: runtime-specific APIs are touched only inside method bodies, never at module scope, which is what lets `index.ts` import both statically and select with a single `typeof Bun` check at module load. The interface fixes the contract consumers of the seam can rely on: glob results are sorted relative paths with forward slashes, scan and match share one rule set, and `spawn` never throws on a non-zero exit.

Scope is the build path only. The repo's HTTP dev server stays Bun-only (repo tooling, never published), and the emitted `.ts`/`.css` files — the interface consumers actually get — were already runtime-neutral standard output; no bundler abstraction exists or is planned.

### 2. The seam sits beside the compiler, which stays pure

`server/compiler/` touches no `RuntimeIO`, no `Bun.*`, and no `node:` specifier — it is pure computation over strings, and the corpus-compile orchestration (`server/corpus-sources.ts`, `server/corpus-compile.ts`) is the only bridge to the seam. The browser-purity pin ([M25](../REQUIREMENTS.md#m25-tooling-continuity)) forbids the seam living under the compiler, and confining the seam there means runtime-specific behavior has exactly one home — which is what makes the gate in sub-design 4 small enough to be standing.

### 3. Glob pattern semantics are one grammar, decided once

`server/runtimes/glob.ts` holds the single translator both implementations share. The supported grammar is what the corpus configuration surface ([ADR 0036](0036-corpus-configuration-surface.md)) needs: `*` (within a segment), `?`, `**/` (zero or more directories), a trailing `**`, and literal text. Braces and character classes are not in the grammar — such characters match literally. Semantics are pinned against `Bun.Glob` (the scanner the walk replaces): wildcards never cross `/` and never match a leading dot; `**/` matches zero directories; a hidden file is addressable only by a pattern segment starting with one. "One grammar" is the ruling, not "one implementation": the Bun scanner still delegates to `Bun.Glob`, whose behavior for the supported grammar the translator pins, while the shared walk serves Node/Deno and the matcher everywhere.

Known edges where the categorical no-divergence claim overreaches today, verified live at the LT-267 review and unreachable with any glob this repo or a realistic consumer writes — owned by **LT-277**, which rules each:

1. **Trailing-`**` matcher leak** — the matcher compiles a trailing `**` to an unguarded `.*`, admitting dot-prefixed paths no scanner yields, violating the scan/match single-rule-set claim.
2. **Explicit-dot pattern segments diverge per runtime** — `Bun.Glob` yields a dotfile matched by an explicit-dot segment; the shared walk skips dotfiles unconditionally. Until ruled, dot-prefixed patterns are outside the grammar; if ruled out, rejection at config resolution is tier 1 Prevented under [ADR 0028](0028-tiered-error-surfacing.md) s1.
3. **Node `fileExists` answers true for directories** where the interface contract says regular file — latent divergence inside the seam itself.

### 4. The standing gate: `check:portability`

`bun run check:portability` (`scripts/corpus-portability-check.ts`) bundles a minimal corpus-compile entry once and runs the *same* bundle under every runtime found on PATH (Bun, Node, Deno), each compiling this repo's corpus into its own scratch tree; all emitted bytes must be identical, and the exit code is non-zero on any disagreement, so it gates in CI. The bundle exists for module resolution only — the source graph's extensionless imports are a bundler-facing fact the packaging step will normalize; what the gate proves is that the build behaves identically once the graph is resolvable. It is the server-build counterpart of the client-side `check:sim` gate (see `server/SERVER.md`).

## Alternatives Considered

- **Stay Bun-only; the published package requires Bun.** The pre-LT-267 state, and cheapest. Rejected: it prescribes the consumer's toolchain as a condition of compiling at all, when the seam-plus-gate cost is one script over a claim ([M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)) a published package cannot avoid making.
- **Per-runtime glob semantics** — each implementation keeps its native glob, documented per runtime. Rejected: a consumer's configured globs could then match one file set under Bun and another under Node, the corpus would silently differ per runtime, and no test could catch it for patterns outside this repo's own.
- **Consumer-registered runtime adapters** — an extension point the consumer plugs their IO into. Rejected as premature: the seam has one consumer (the build) and there is no demand for custom IO; the `RuntimeIO` type is already the extension point if one is ever needed.
- **Fold the seam into `server/compiler/`** so the published package boundary contains it directly. Rejected: it would put `node:` specifiers into the CI-pinned browser bundle and break the compiler's browser-purity pin ([M25](../REQUIREMENTS.md#m25-tooling-continuity)); the package boundary is a packaging concern for LT-254, not a reason to couple the compiler.

## Consequences

### Good

- The package's install story states a floor every JS project already meets instead of prescribing a toolchain; the pioneer builds ([ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s6) can run the compiler under whatever the host project uses.
- Runtime-specific behavior has exactly one home, and neutrality is a standing one-command check rather than a claim — the portability gate is cheap enough to run on every relevant change.
- The corpus configuration surface gets glob semantics that cannot drift per runtime; a consumer's configured globs mean one thing everywhere ([ADR 0036](0036-corpus-configuration-surface.md) s2's falsifiability extends to the runtime axis).

### Bad

- Two glob code paths (`Bun.Glob`'s scanner and the shared walk) must be kept honest forever; the parity tests and the gate carry that weight, and the LT-277 edges show the categorical claims can silently overreach.
- `node:` API parity on Bun/Deno is implemented-by-others, and the seam papers over genuine behavioral differences by hand (e.g. spawn failure mapped to exit code 127); the gate covers the build path's emitted bytes, not every method's every input.
- Every new `RuntimeIO` capability costs two implementations and a gate row, not one — the neutrality claim is only as current as the last gate run.

## Related

- Requirements: [§5](../REQUIREMENTS.md#5-technical-constraints), [M25](../REQUIREMENTS.md#m25-tooling-continuity), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Architecture: [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1 (the publication that makes this contract consumer-visible), [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) (the sibling build-path seam — the substrate boundary), [ADR 0036](0036-corpus-configuration-surface.md) s1/s5 (JSON config inherits nothing from the runtime choice; the pure/IO split this seam completes), [ADR 0028](0028-tiered-error-surfacing.md) s1 (the tier for LT-277's config-resolution ruling)
- Operational: `server/SERVER.md` § The Runtime Seam; the gate is `bun run check:portability`
- Provenance: LT-267 (implemented 2026-09-21, reviewed the same day); LT-278 (recorded); LT-277 (owns the glob edge rulings)
