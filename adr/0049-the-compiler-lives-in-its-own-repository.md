# ADR 0049: The Compiler Lives in Its Own Repository

## Status

✅ Accepted — 2026-10-10, owner session (LT-523). Amends [ADR 0034](0034-distribution-compiler-package-and-template-emission.md) s1's build home and [ADR 0036](0036-corpus-configuration-surface.md) s2's anchor; the package identity ([ADR 0034] s1–s2, s8; LT-254) is unchanged.

## Context

LT-254 stood `@zeix/le-truc-compiler` up inside this monorepo: sources in `server/compiler/` (+ `server/runtimes/`, the [ADR 0038](0038-runtime-neutral-build-path.md) seam the compiler imports), assembled for publish from `compiler/`. The owner directs the split (2026-10-10): the compiler moves to `le-truc-compiler/` as a sibling folder and a separate public repository, `zeixcom/le-truc-compiler`. Three pressures: the package is real and wants its own issue tracker and release cadence; template emission ([ADR 0043](0043-the-target-emitter-interface-for-template-emission.md), LT-516) is about to grow a third front end that should be born in its final home; and le-truc's docs build consuming the published package — not its own sources — is [ADR 0036] s2's stated endgame.

## Decision

1. **Fresh history.** The new repository's first commit is the moved tree; le-truc keeps the complete historical record. A `git filter-repo` subtree split was rejected (interleaved runtime/docs commits; the rewrite path was probed once with `cause-effect-gitreversed` and earned no repeat). This ADR's merge commit is the cutover marker.

2. **What moves / what stays.** Moving: `server/compiler/` (87 modules), `server/runtimes/`, the compiler test suite with fixtures (97 files), the package scripts (`build:compiler`, `check:contract`, `check:peer`, `check:package`), `tsconfig.compiler.json`, the `compiler/` assembly directory, the simulation portability check, and the compiler docs (`LE_TRUC_COMPILER.md`, `HOST_PROFILE.md`, `VOCABULARY_LEDGER.md`, `COMPILER_SPEC.md`). Staying: the runtime, the examples corpus, the docs site and dev server, the generated tree, goldens, census and corpus-level checks, CEM.

3. **The consumer relationship.** le-truc depends on `@zeix/le-truc-compiler` — a `link:` to the built sibling for development, a pinned pre-release in CI and releases. At cutover le-truc's `le-truc.config.json` **drops its `runtimeImport` pin**: generated server modules import `@zeix/le-truc-compiler/runtime` like any consumer's, and the goldens re-pin that one import line by design — byte-identity thereafter is measured **through the installed package**, converting ADR 0036's falsifiability promise into a cross-repo proof.

4. **Defaults re-anchor by mirroring.** The compiler repository carries its fixture corpus at the same relative paths the defaults name (`examples/**`, `server/generated/components`, the locale list), so every default stays honest in its own tree and [ADR 0036] s2 stands verbatim.

5. **`check:peer` reads the registry.** The runtime peer's export list and version come from the published `@zeix/le-truc` (installed devDependency / `npm view`), no longer from this repo's barrel. Lockstep becomes a release convention: the runtime publishes first; compiler CI fails until the floor is satisfiable from the registry.

6. **Test split.** Unit tests, fixtures and portability move; the corpus-level integration suite (`check:corpus`, census, goldens) stays in le-truc — the consumer side is where corpus regressions belong.

7. **Repository posture.** Public from the first push, consistent with `zeixcom/le-truc` and the docs site; MIT `LICENSE` lands in the first commit (the manifest already claims it); typecheck, suite, contract, package, peer and lint are required checks; an NPM-token publish workflow ships disabled until the first pre-release. The queue tooling is not copied — the split work itself tracks in le-truc's store until cutover; the new repo starts on plain GitHub issues (reversible; revisit freely).

**Sequencing.** The current iteration closes first (its two remaining design rulings, then the changelog sweep); the split chain opens the next iteration; template-emission build tasks (from LT-516's amendment) file against the new repository and never against `server/compiler/` here. **Prerequisite:** `@zeix/le-truc@3.0.0-next.1` on the registry — the split repository types its peer against the published runtime and its `check:package` installs the peer from the registry; the first pre-release remains the owner's outward act.

## Alternatives Considered

- **Stay in the monorepo** (status quo): one checkout, one queue, tooling done — but the package's public life (issues, releases, contributors) is buried inside the runtime's repo, and the docs build keeps consuming its own sources, so the consumer proof ADR 0036 promises never becomes real.
- **`git filter-repo` history split**: preserves per-module history; rejected in ruling 1.
- **npm-only dev loop**: the most honest consumer relationship, but every cross-repo change needs a registry round-trip before the docs site shows it.
- **Canary channel**: fast and npm-clean; canary drift becomes its own failure mode and litters the registry.
- **Genericized or required config fields**: friendlier defaults or more explicit ones, but the first breaks ADR 0036's anchor and the second is a breaking change to the just-published config surface.

## Consequences

**Good:** le-truc's build becomes the compiler's first real consumer, proven by goldens; the compiler gets its own cadence and public tracker; template emission is built in its final home; the two packages' version independence (ADR 0034 s8) gains the process boundary it always described.

**Bad / accepted tradeoffs:** cross-cutting changes become a two-repo dance (`link:` mitigates, not removes); lockstep discipline moves from tooling (one checkout) to convention (runtime-first publishing); le-truc's CI now depends on registry availability; until the cutover lands, this repo carries the compiler twice — once in-tree, once as the staged sibling.

## Related

- Requirements: [§5](../REQUIREMENTS.md#5-technical-constraints), [M28](../REQUIREMENTS.md#m28-distribution-and-dependency-weight)
- Amends: [ADR 0034](0034-distribution-compiler-package-and-template-emission.md) (s1 build home), [ADR 0036](0036-corpus-configuration-surface.md) (s2 anchor, stands verbatim by ruling 4)
- Related: [ADR 0038](0038-runtime-neutral-build-path.md) (the seam that moves with it), [ADR 0043](0043-the-target-emitter-interface-for-template-emission.md) (the subsystem born there), [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md)
