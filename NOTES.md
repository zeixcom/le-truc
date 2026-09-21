# NOTES

Deviation notes and unexpected challenges from agent sessions, newest first. Entries are transitory — resolved entries are deleted once incorporated elsewhere (code headers, ADRs, TODO tasks).

---

## 2026-09-21 — LT-179 (remove factory return contract)

- **Parallel-session race:** the LT-178 Tech Writer copy rider's `swapSlots` reason string landed uncommitted in this shared checkout mid-task (foreign edit, this branch only). Reverted before committing so LT-179 lands pure; the rider is still OPEN and its string change should land with the Tech Writer's own change. The one test assertion that pinned that copy is now worded to pass under either spelling.
- **Rider suggestion for the Architect:** TypeScript's void-return assignability means a legacy `return [...]` factory still *compiles* against the new `(context) => void` factory type while its value is silently ignored (pinned by a component.test.ts test). A DEV_MODE warning on a non-undefined factory return would catch unmigrated 2.x code at runtime; not added here — it is a new diagnostic surface (ADR 0028 tier question + Tech Writer copy) and outside LT-179's letter.
- In-margin decisions made (recorded in code docblocks + CHANGELOG): `each()`'s callback now takes `reconcile()`'s `bindItem` contract — a returned `MaybeCleanup` registers on the per-element scope (typing it `void` would have silently dropped returned cleanups, the exact footgun class this task kills); extension `onConnect` narrowed to a single `EffectDescriptor | void` (both built-ins returned exactly one); `describeDescriptor()`'s generic hand-authored label is now reachable only via extension-registered raw descriptors, which is how component.test.ts covers it.
