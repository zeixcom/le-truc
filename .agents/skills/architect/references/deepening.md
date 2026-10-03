# Architecture Review: Deepening

Use this reference when the owner asks to improve the architecture or to look for refactoring opportunities.

## Heuristics

- **Deletion test**: imagine deleting the module. If complexity vanishes, the module was a pass-through (shallow). If complexity reappears across N callers, it was earning its keep (deep).
- **Interface vs. implementation**: when the interface is nearly as complex as what is behind it, the module is shallow.
- **Locality**: do the bugs live in the module, or in how callers call it?
- **Seams**: one adapter means a hypothetical seam; two or more mean a real one.
- **Coupling leaks**: look for modules that bleed across their boundaries.

## Output

Present numbered candidates. Each candidate gives the files, the problem (in depth, locality and leverage terms), a plain-English solution, the benefits (including testability), and any ADR it conflicts with ("contradicts ADR 00NN — worth reopening because …"). Do not propose interfaces until the owner picks a candidate. Then question the design tree: its constraints, what sits behind the seam, and which tests survive.

When the owner rejects a candidate for a load-bearing reason, offer to record the reason as an ADR, so later reviews do not suggest it again.

## Vocabulary

- **Module**: anything with an interface and an implementation.
- **Interface**: everything a caller must know to use the module — types, invariants, error modes, ordering and config, not only the signature.
- **Depth**: how much behavior sits behind a small interface (leverage).
- **Seam**: where an interface lives; a place where behavior can change without an edit in place.
- **Adapter**: a concrete thing that satisfies an interface at a seam.
- **Leverage**: what callers get from depth.
- **Locality**: what maintainers get from depth.
