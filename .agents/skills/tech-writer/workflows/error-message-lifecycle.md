# Error Message Lifecycle Workflow

**Use when:** an error class in `src/errors.ts` or a `TSRX0NN` code in `server/tsrx/diagnostics.ts` is added, reworded, or removed — or when the two lists need a consistency pass.

**Ownership:** developers own the *condition* that fires an error; Tech Writer owns the *copy*. A developer writes a first-draft message with the condition; this workflow turns it into final copy and propagates it. See `.agents/skills/le-truc-dev/SKILL.md` and `.agents/skills/architect/SKILL.md` for the handoff triggers.

**Required reading:**
- [ADR 0028](../../../../adr/0028-tiered-error-surfacing.md) — the tier contract these messages have to encode
- `references/ste100-style.md` — both lists are reference text and run STE at **Full** strength

---

## The acceptance criteria for any error message

These are not advice. A message that fails one of them is not done.

### 1. Three parts, in this order

1. **What failed** — the condition, in the author's vocabulary, not the implementation's.
2. **Which component and site** — `elementName()` / `describeRoot()` supply this for runtime classes, `lineOf()` for compiler diagnostics. If the builder does not receive enough to name the site, that is a signature gap to raise with the developer, not something to write around.
3. **What the author should do** — an imperative fix. This is the part that goes missing. "X is not allowed" is not a message; "X is not allowed — do Y instead" is.

Where the fix genuinely depends on information the builder does not have, name the *decision* the author has to make rather than omitting part 3.

### 2. Name the paired rule

A runtime message whose condition has a compiler rule **must name that rule's code**, so a reader who hits the backstop learns the check exists upstream (ADR 0028 sub-design 1 — the runtime is a backstop, not the notification). The reverse cross-reference belongs on the compiler side: a `TSRX0NN` message whose condition also throws at connect names the runtime class.

If a condition has no compiler channel, say why in the JSDoc — "fires on runtime data, not source shape", "TypeScript covers this" — so the next reader does not re-litigate it.

### 3. Do not imply a Tier 2 failure broke the page

A contained error means the component degraded to its server-rendered markup, which is *already correct* (ADR 0028 sub-design 4). "Broken", "crashed", "failed to render" are all wrong for Tier 2. "Did not enhance", "did not activate", "kept its server-rendered markup" are right. This applies to `reportConnectFailure` and `reportEffectFailure` in **both** branches — the production branch is shorter, not more alarming.

Tier 3 is the exception, and there are only two sites: `defineComponent()` at module evaluation, and the Trusted Types re-throw.

### 4. One voice across both lists

Message shape: a sentence stating the condition, an em-dash clause for the mechanism when the reader needs it, then an imperative fix. Backticks for code, `<angle-brackets>` for tags. No exclamation marks, no apology, no "please".

---

## Event: a new error

**Trigger:** a developer adds a class to `src/errors.ts` or a code to `server/tsrx/diagnostics.ts`.

1. **Confirm the tier is recorded.** The Architect decides the tier at task-writing time; if the task does not say, ask before writing copy — the tier decides the wording.
2. **Confirm the channel.** If the condition is statically decidable and the new error is a runtime class, ADR 0028 sub-design 1 obliges a `TSRX` rule too. Flag its absence rather than writing a message that pretends the compiler covers it.
3. Write the message to the four criteria above.
4. Write or extend the JSDoc on the builder: the mechanism, the tier, and the paired channel.
5. Propagate (checklist below).

## Event: a revised message

**Trigger:** wording changes on an existing class or code.

1. Re-check all four criteria — a reword is the cheapest moment to close a missing part 3.
2. **Check the caller-side reason strings.** Several classes take a `reason` argument assembled at the throw site, not in `src/errors.ts`: `InvalidPropertyNameError` (`src/component.ts`), `InvalidPassPropertyError` (`src/helpers/reactive.ts`), `UnsafeAttributeError` (`src/bindings.ts`), `MissingElementError` (the author's own required-reason). The sentence the reader sees is assembled from both halves — read it whole before judging it.
3. Propagate (checklist below). **Message-substring tests are the failure mode here:** they break silently in the sense that they were checking the right thing and now fail for the wrong reason.

## Event: a retired error

**Trigger:** a class is deleted, or a rule stops being emitted.

1. Search the whole repo for the name or code, not just the source file. A retired code often survives in a union type with no builder behind it — `TSRX031` was exactly this. Mark it retired in the union comment rather than deleting the member silently, so the next reader knows the number is spent.
2. Remove its row from `references/errors.md`, or mark it retired if authors may still meet it in an older build.
3. Propagate (checklist below), including the ADR that decided the retirement.

## Event: periodic consistency review

**Trigger:** after a batch of error work, or when the two lists have drifted.

1. Read both lists end to end in one sitting. Drift is only visible in aggregate: the two channels evolved independently, and it showed as compiler messages naming the fix inline while runtime messages stated the condition and stopped.
2. Check every runtime class against the ADR 0028 inventory table. Every row must name a channel that exists — no `TSRX` code that no builder emits, no ✅ for a rule that was never written.
3. Check every message for part 3.
4. Check every Tier 2 message against criterion 3.
5. Record anything you cannot fix as copy — a missing rule, a builder that cannot name its site — as a `TODO.md` task for the owning skill, not as a hedge in the message.

---

## Propagation checklist

An error message has more downstream copies than any other string in the project. Every event above ends here.

| Target | What to do |
|---|---|
| `src/errors.ts` / `server/tsrx/diagnostics.ts` | The builder and its JSDoc — the authoritative copy |
| Caller-side `reason` strings | `src/component.ts`, `src/helpers/reactive.ts`, `src/bindings.ts` — half the sentence lives here |
| `.agents/skills/le-truc/references/errors.md` | One row per error: what fired, why, how to fix, tier. Do not restate the message — point at the condition |
| `.agents/skills/le-truc/workflows/debug.md` | Step 0 routes named errors here; a new *class* of error may need a route |
| `.agents/skills/le-truc-dev/references/non-obvious.md` | Any prose describing how the error surfaces (this is where a stale "uncaught `pageerror`" claim survived the ADR that retired it) |
| `docs-src/pages/` | Prose naming the error: `props.md`, `components.md`, `extensions.md`, `async.md`, `api.md` |
| `docs-src/api/classes/*.md` | **Generated.** Never hand-edit — regenerate with `bun run build:docs` after the JSDoc change |
| **Message-substring tests** | See below — these fail the build, so find them first |
| `adr/0028-tiered-error-surfacing.md` | The inventory table, if the channel or tier changed. Use the `adr-keeper` skill |
| `server/tsrx/LE_TRUC_COMPILER.md` | The diagnostic inventory, for a new or retired `TSRX` code |
| `CHANGELOG.md` | A user-visible message change is a change. Use the `changelog-keeper` skill |

### Message-substring tests

These assert on fragments of the exact strings this workflow edits. Grep them before changing wording, and update the assertion to the new phrase — never weaken it to make it pass.

| File | Asserts on |
|---|---|
| `examples/test/audit/test-audit.spec.ts` | `'reserved word'` |
| `server/tests/tsrx/diagnostics.test.ts` | `'reserved word or Object builtin'`, and code-specific fragments throughout |
| `src/tests/component.test.ts` | `'did not enhance'`, `'the component factory'`, `'server-rendered markup'`, `'pass()'`, `'hand-authored'` |
| `src/tests/internal.test.ts` | `'watch()'`, `'<my-element>'` |
| `src/tests/reactive.test.ts` | failing prop names in `InvalidPassPropertyError` |

Verify with `bun test src/tests`, `bun test server/tests`, and the Playwright examples run.
