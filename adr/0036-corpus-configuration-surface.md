# ADR 0036: The Corpus Configuration Surface — `le-truc.config.json`, This Repo as a Consumer

## Status

✅ Accepted

## Context

The compiler compiled *this repo*. Its source scan was a literal `examples/**` glob and its output root a literal `server/generated/components/`. Less visibly, its emitted module specifiers encoded how deep that output root sat: `'../../../'` appeared as a constant in two emitter modules, and the render-harness specifier `'../../compiler/runtime'` was hard-coded in the pipeline. [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1 commits the compiler to shipping as `@zeix/le-truc-compiler`, and [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight) makes the installing developer a persona. A package whose scan and emit are shaped like one repo's layout cannot serve one. The ratio test ([COMPILER_REFLECTION.md](../COMPILER_REFLECTION.md) §1, §7) stays unanswered until something outside `examples/` compiles through it.

The config surface is a shape problem; the package is a distribution one, and the second does not inform the first. So where the configuration lives is decided here, not behind the P6-gated packaging task.

## Decision

### 1. A project-root `le-truc.config.json`, discovered upward

An installing project places a `le-truc.config.json` at its root. The runner searches upward from the working directory. **The directory holding the file is the project root**: every glob is scanned with it as cwd, and every relative path field resolves against it.

The file is JSON rather than an executable `.ts` config module, deliberately: no import, no transpile, no runtime-specific loader. The file-IO neutrality work therefore inherits nothing from this decision.

Every field is optional. The field table and worked example are documented for an installing reader in `server/compiler/LE_TRUC_COMPILER.md` § 7.1, the surface's reference. This ADR records only what is architectural about it.

### 2. This repo's paths are the defaults, so the docs build is a consumer

Every default is this repo's own path. `sources` defaults to **both** authored extensions (`examples/**/*.tsrx` and `examples/**/*.tsx`, per [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6), and `outDir` to `server/generated/components`. The docs build therefore carries **no config file at all** and reaches the generalized path through the same defaults a consumer overrides.

This is the load-bearing half. Defaults that reproduce the repo make the generalization *falsifiable*: the repo's own output must stay byte-identical through the configured path. Two consumers exercise the mechanism from the first commit, rather than one consumer that does not exist yet.

### 3. The output root's depth is derived, and must sit inside the project root

Every generated module lands flat in the output root, whatever the authored source's nesting. An author's relative import is therefore rewritten as "`../` back to the project root, then a root-relative path". That prefix is `../` once per path segment of the configured `outDir` — **derived, never assumed**. Deriving it is what makes the output root configurable; the glob was the easy half.

An `outDir` **outside** the project root (or equal to it) is therefore refused: the scheme cannot address a directory the root does not contain. This is a **configuration** error, thrown at startup — **channel: none** under [ADR 0028](0028-tiered-error-surfacing.md). It is read before any component is parsed, so there is no source span and no author-fixable component mistake for a Surfacing Tier to grade. No `LTC` code is owed, and none should be minted for config validation. As a corollary, such messages are untiered and unreviewed by the diagnostic machinery, so their text carries the whole user experience on its own.

### 4. The corpus, not the repo, is the registry's scope

`registry.json` is a **project's** corpus index. Its `source` paths are relative to the configured project root. The duplicate-tag rule ([LTC048](../server/compiler/diagnostics.ts)) is corpus-scoped: two same-surface files, or two folders, declaring the same tag fail the compile naming both (folder-local variant sets excepted, ADR 0039), because the tag is the registry's key.

### 5. Configuration is pure; discovery is IO

Config resolution and path math live in `server/compiler/corpus-config.ts` and touch no disk and no runtime-specific API. Config reading and globbing live in `server/corpus-sources.ts`. Two standing constraints require this split and pull against each other: `server/compiler/` must stay free of `Bun.*` and `import.meta.dir` ([ADR 0038](0038-runtime-neutral-build-path.md)), and `imports.ts`/`pipeline.ts` are in the CI-pinned browser bundle and may carry no `node:` specifier at all. The emitter-facing subset is therefore a third leaf, `server/compiler/emit-paths.ts`, which the browser graph may reach.

The configuration reaches the emitters as one trailing optional argument threaded through both front ends, defaulting to this repo's layout. It is not module-scoped mutable state: that would put a hidden global under a compiler whose soundness claim is that it is a pure function of its inputs.

## Alternatives Considered

- **Wait for the packaging task to decide where the config lives**: the packaging task is P6-gated, it does not inform the file format or the discovery rule, and the repo-shaped scan blocks the ratio test in the meantime.
- **An executable `le-truc.config.ts`**: more expressive (computed globs, conditional output roots), but it needs a loader — exactly the runtime-specific coupling the runtime-neutrality work exists to remove — and nothing in the surface needs computation.
- **Defaults that are neutral rather than this repo's**: would force a config file into this repo. The docs build would then be a configured special case instead of the mechanism's first consumer, and byte-identity would stop being the check that proves the generalization.
- **Module-scoped active configuration, set once per run**: avoids threading an argument through two front ends, but it is hidden global state under a pure compiler, and it makes two differently-configured compiles in one process impossible — which the test suite already does.
- **Keep the emitted depth prefix constant and require consumers to match the layout**: cheapest, but "your output directory must be exactly three levels deep" is not a configurable output root, it is a rename.

## Consequences

**Good:**

- The compiler compiles a project's components from a project's configuration. The docs build is one consumer of the mechanism rather than the mechanism itself.
- Byte-identity of this repo's output is a standing, falsifiable check on the generalization — not a claim.
- The single configured glob list is the one place to widen: `build:corpus`, `check:corpus` and the build effect can no longer glob different extension sets.
- The pure/IO split gives the runtime-neutrality work one seam for the corpus scan instead of four call sites, and keeps the browser-purity pin intact.
- An outside-the-repo compile is a runnable check, and it surfaces a class of defect an in-repo check cannot see. For example, an `import.meta.dir`-anchored catalog path made a consumer's build census this repo's translation keys as their orphans.

**Bad / accepted tradeoffs:**

- **The config file is public API before publication.** Unknown keys and mistyped fields are rejected at startup rather than defaulted, but under sub-design 3's untiered channel the message text is the entire remedy.
- `runtimeImport` has no good default until the compiler is published. Every installing project must set it by hand, the most visible "not published yet" seam in the surface. Publication flips it.
- The upward config search has no project boundary, so a stray config file above a checkout captures that checkout's build.
- Configuration flows through both front ends' signatures, adding a parameter to `compileComponent`/`compileComponentTsx` that most callers never pass.
- Generalization is not complete: the *watch* path (`server/file-signals.ts`) and `scripts/i18n-sync.ts` still hard-code this repo's layout. This is deliberate — neither has a consumer before pioneer 1 — but the surface is configured, not the whole build.

## Related

- Requirements: [§1](../REQUIREMENTS.md#1-problem-statement), [§2](../REQUIREMENTS.md#2-user-personas), [§5](../REQUIREMENTS.md#5-technical-constraints), [M24](../REQUIREMENTS.md#m24-build-time-internationalization), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Architecture: [ADR 0034](0034-distribution-tsx-only-compiler-package-and-template-emission.md) s1–s2 (the package this configures), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s6 (why the default glob is dual-extension), [ADR 0028](0028-tiered-error-surfacing.md) s1 (why a config error is untiered), [ADR 0030](0030-internationalization-as-build-time-server-data.md) s5 (`i18nDir`), [ADR 0024](0024-adopt-tsrx-as-isomorphic-component-format.md) s9 (the registry the CEM build reads)
- Background: [COMPILER_REFLECTION.md](../COMPILER_REFLECTION.md) §1, §7 (the ratio test)
