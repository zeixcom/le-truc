# ADR 0041: `truc:` Intrinsic Elements for Compiler-Consumed Constructs in `.tsx`

## Status

✅ Accepted — owner ruling 2026-09-24 (LT-213 deliberation). Implementation: LT-303 (`truc:try`); `truc:element` is recorded here and built when a migration needs it (LT-213).

## Context

`.tsx` spells `.tsrx`'s directive grammar as standard expressions ([ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s2), and the capability rule (s6) obliges every front-end capability to be expressible in both surfaces. Some constructs have no honest expression spelling. A compiler-consumed ambient that looks like a runtime call, or an IIFE whose JavaScript meaning is not what the compiler does with it, misstates the construct to readers, to tools, and to agents porting between surfaces. LT-213's dynamic tags added a case with no expression spelling at all. A rule is needed for when `.tsx` gains host vocabulary and when it keeps plain JavaScript.

## Decision

**A construct the compiler consumes structurally gets a `truc:`-namespaced intrinsic element in `.tsx` when all three conditions hold:**

1. **Its JavaScript spelling misstates what the construct means.** A shape-recognized idiom whose JavaScript meaning *is* the rendered output stays JavaScript: ternaries, `&&`, `.map()`, the `.length === 0` empty-arm ternary, and the switch IIFE.
2. **It needs no generic type parameter.** `JSX.IntrinsicElements` entries cannot be generic, so a construct whose children are typed by its input (a loop item) cannot be one.
3. **It joins a closed vocabulary** declared in the `.tsx` host profile (`host-profile.d.ts`), and it passes the capability rule on both surfaces.

Namespaced tag names are standard JSX grammar. TypeScript resolves `<truc:x>` against `IntrinsicElements['truc:x']`, so attribute types, contextually typed function children, and duplicate-attribute errors (TS17001) come free from `tsc`. A lowercase namespaced name cannot collide with PascalCase compose dispatch. The vocabulary extends the existing `truc:` attribute namespace (`truc:pass`, `truc:case`).

**Arms are attributes, not child elements.** TypeScript cannot constrain the count or order of children, so child arms would each need a compiler diagnostic. As attributes, the arms get uniqueness and types from `tsc`, and the children are the primary content.

**Naming follows the authoring surface, not the runtime.** Template vocabulary matches `.tsrx`'s directives, so one component reads with the same words in both surfaces. The runtime keeps cause-effect's words (`watch(task, { ok, nil, err, stale })`), and the IR's internal `ok`/`nil`/`err` keys are never author-visible.

### Members

- **`<truc:try>`**, the error boundary and the async boundary in one element, the spelling of `@try`/`@pending`/`@catch`:

  ```tsx
  <truc:try pending={<p>Loading…</p>} catch={e => <p>{e.message}</p>}>
    <div>{data}</div>
  </truc:try>
  ```

  With `catch` only, it is the error boundary. With `pending` as well, it is the async boundary: all arms render and are `hidden`-toggled by which state won. `pending` renders while the task has no value yet, which is the narrow case of `isPending()` (also true while re-fetching with a retained value). Both are typed `JSX.Element`, and `catch`'s parameter is `Error` because cause-effect wraps non-Errors before dispatch (LT-208). There is no stale arm (LT-211): the in-flight state stays the reactive `isPending(signal)` idiom beside the boundary.
- **`<truc:element tag={…}>`**, the spelling of `.tsrx`'s `<{expr}>` (LT-213). It admits only a server-known tag expression naming an HTML element (no custom elements), folded in the Folded tier. It is recorded here and not yet built. Until it is, both surfaces reject it with LTC053, and in `.tsx` it is also a `tsc` error because it has no `IntrinsicElements` entry.

## Alternatives Considered

- **Expression spellings for the boundaries** (a compiler-consumed ambient call, an IIFE): rejected by condition 1. One reads as a runtime call, the other as synchronous JavaScript error handling, and neither is what the compiler does.
- **Cause-effect naming (`ok`/`nil`/`err`)**: rejected. It names signal states, so a synchronous error boundary has no name in it. The attribute form would also need a container name (`truc:match`), which puts a fourth word into one construct.
- **Arms as child elements (`<truc:pending>`, `<truc:catch>`)**: rejected. Arm uniqueness and order would move from `tsc` into new compiler diagnostics.
- **`<truc:empty>` beside a `.map()`**: rejected. It is attached to its loop only by position, which undoes the explicit empty-arm link LT-212 established.
- **`<truc:for each={…}>`**: rejected by condition 2. The item parameter would be `unknown`, a regression from `.map()`'s precise typing.
- **React's `const Tag = …; <Tag>` for dynamic tags**: rejected. It collides with PascalCase compose dispatch and would need scope analysis to tell a local string from an imported component.

## Consequences

**Good:**
- Every compiler-consumed `.tsx` construct reads as what it is, and it is type-checked by `tsc` with no new diagnostics.
- `.tsx` and `.tsrx` share the boundary vocabulary (`try`/`pending`/`catch`).
- One element spells both boundaries.
- The rule is decidable, so new constructs get a ruling instead of a debate.

**Bad:**
- `.tsx` authors learn a small closed host vocabulary beyond standard JSX.
- The `.tsx` front end recognizes namespaced elements in addition to expression shapes.
- The spike fixtures and parity tests written against the retired spelling are rewritten (LT-303). No corpus component uses the boundary yet.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [M21](../REQUIREMENTS.md#m21-composition-and-interop)
- Architecture: [Authoring Surfaces](../ARCHITECTURE.md#authoring-surfaces)
- Amends: [ADR 0032](0032-adopt-tsx-as-the-authored-component-surface.md) s2 (control-flow spellings) and s6 (the capability rule's exception mechanism)
- Related: [ADR 0037](0037-reactive-conditions-via-template-cloned-arms.md) s4 (the boundary's arm mechanism), [ADR 0040](0040-typed-ir-contracts-discriminated-unions-and-pass-signatures.md) (the boundary's IR)
