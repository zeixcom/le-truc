# ADR 0038: Runtime-Neutral Build Path — the `RuntimeIO` Seam, One Glob Grammar, and the Portability Gate

## Status

✅ Accepted

## Context

The compiler's build path executes JavaScript. The corpus compile imports and runs the emitted server modules to fold ([ADR 0029](0029-tiered-server-evaluation.md)), reads the configured sources, writes the output tree, and spawns typechecking. Every one of those steps reached for Bun's globals. For repo tooling that is fine: [§5](../REQUIREMENTS.md#5-technical-constraints) names Bun this repo's primary build tooling. But [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1 commits the compiler to shipping as `@zeix/le-truc-compiler`, and [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight) makes the installing developer a persona. Once the package exists, its build path's runtime requirement is consumer-visible. "Requires Bun" would prescribe a toolchain to every consumer, when the honest floor for executing a JS package's build is already *a* JS runtime.

Two standing constraints already pulled the same direction. `server/compiler/` is pinned browser-pure ([M25](../REQUIREMENTS.md#m25-tooling-continuity)), with no `node:` specifier in the CI-pinned browser bundle ([ADR 0036](0036-corpus-configuration-surface.md) s5). The corpus config is JSON rather than an executable module precisely so no runtime-specific loader couples to it (ADR 0036 s1). The file-IO, glob and spawn layer was the last Bun-coupled surface. The decision precedes the package's first publication, because the contract below is consumer-visible the moment the package exists.

## Decision

1. **The build path requires a JS runtime, not Bun specifically.** All file IO, globbing and process spawning on the build path goes through one interface, `RuntimeIO` (`server/runtimes/`): `readTextFile`, `fileExists`, `writeTextFile`, `copyFile`, `scanGlob`, `matchGlob`, `spawn`. Two implementations exist side by side: Bun natives, and `node:fs`/`node:child_process` (which Bun and Deno both implement). Each is loadable under any runtime. Runtime-specific APIs are touched only inside method bodies, never at module scope, so both import statically and a single `typeof Bun` check selects at load. The interface fixes the contract consumers can rely on: glob results are sorted relative paths with forward slashes, scan and match share one rule set, and `spawn` never throws on a non-zero exit. Scope is the build path only. The repo's HTTP dev server stays Bun-only (repo tooling, never published), and the emitted files were already runtime-neutral standard output.

2. **The seam sits beside the compiler, which stays pure.** `server/compiler/` touches no `RuntimeIO`, no `Bun.*`, no `node:` specifier — it is pure computation over strings. The corpus-compile orchestration is the only bridge to the seam. The browser-purity pin forbids the seam living under the compiler. Confining it beside the compiler gives runtime-specific behavior exactly one home, which is what makes the gate in sub-design 4 small enough to be standing.

3. **Glob pattern semantics are one grammar, decided once.** One shared translator serves both implementations. The supported grammar is what the corpus configuration surface ([ADR 0036](0036-corpus-configuration-surface.md)) needs: `*` (within a segment), `?`, `**/` (zero or more directories), a trailing `**`, and literal text. Braces and character classes match literally. Semantics are pinned against the Bun scanner the walk replaces: wildcards never cross `/` and never match a leading dot; `**/` matches zero directories; a hidden file is addressable only by a pattern segment starting with one. The ruling is "one grammar", not "one implementation".

   Three known edges exist where the categorical no-divergence claim overreaches today. Each is unreachable with any realistic glob, and each needs its own ruling:
   - The trailing-`**` matcher compiles to an unguarded wildcard admitting dot-prefixed paths no scanner yields.
   - Explicit-dot pattern segments diverge per runtime: a dotfile is matched by the Bun scanner and skipped by the shared walk. Until ruled, dot-prefixed patterns are outside the grammar; ruling them out would be Prevented at config resolution ([ADR 0028](0028-tiered-error-surfacing.md) s1).
   - Node's `fileExists` answers true for directories, where the contract says regular file.

4. **The standing gate: `check:portability`.** A script bundles a minimal corpus-compile entry once and runs the *same* bundle under every runtime found on PATH (Bun, Node, Deno). Each compiles this repo's corpus into its own scratch tree. All emitted bytes must be identical, and any disagreement fails CI. The bundle exists for module resolution only: the source graph's extensionless imports are a bundler-facing fact the packaging step will normalize. What the gate proves is that the build behaves identically once the graph is resolvable. It is the server-build counterpart of the client-side simulation gate (`server/SERVER.md`).

## Alternatives Considered

- **Stay Bun-only; the published package requires Bun**: the cheapest state, but it prescribes the consumer's toolchain as a condition of compiling at all. The seam-plus-gate cost is one script over a claim ([M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)) a published package cannot avoid making.
- **Per-runtime glob semantics** (each implementation keeps its native glob): a consumer's configured globs could match one file set under Bun and another under Node. The corpus would silently differ per runtime, and no test could catch it for patterns outside this repo's own.
- **Consumer-registered runtime adapters**: premature. The seam has one consumer and there is no demand for custom IO; the `RuntimeIO` type is already the extension point if one is ever needed.
- **Fold the seam into `server/compiler/`**: puts `node:` specifiers into the CI-pinned browser bundle and breaks the browser-purity pin ([M25](../REQUIREMENTS.md#m25-tooling-continuity)). The package boundary is a packaging concern, not a reason to couple the compiler.

## Consequences

**Good:**

- The package's install story states a floor every JS project already meets instead of prescribing a toolchain. The pioneer builds ([ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s6) can run the compiler under whatever the host project uses.
- Runtime-specific behavior has exactly one home. Neutrality is a standing one-command check rather than a claim, cheap enough to run on every relevant change.
- The corpus configuration surface gets glob semantics that cannot drift per runtime; a consumer's configured globs mean one thing everywhere.

**Bad / accepted tradeoffs:**

- Two glob code paths must be kept honest forever. The parity tests and the gate carry that weight, and the recorded edges show the categorical claims can silently overreach.
- `node:` API parity on Bun/Deno is implemented by others, and the seam papers over genuine behavioral differences by hand. The gate covers the build path's emitted bytes, not every method's every input.
- Every new `RuntimeIO` capability costs two implementations and a gate row, not one. The neutrality claim is only as current as the last gate run.

## Related

- Requirements: [§5](../REQUIREMENTS.md#5-technical-constraints), [M25](../REQUIREMENTS.md#m25-tooling-continuity), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Related: [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1 (the publication that makes this contract consumer-visible), [ADR 0035](0035-simulation-seam-ssg-scoped-tier-and-substrate-package.md) (the sibling build-path seam), [ADR 0036](0036-corpus-configuration-surface.md) s1/s5 (the pure/IO split this seam completes), [ADR 0028](0028-tiered-error-surfacing.md) s1 (the Surfacing Tier for the config-resolution ruling)
- Operational: `server/SERVER.md` § The Runtime Seam; the gate is `bun run check:portability`
