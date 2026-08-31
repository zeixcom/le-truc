# ARIA-Reflection PoC — Findings

Proof-of-concept workspace for [ADR 0026](../../adr/0026-aria-reflection-via-elementinternals-and-bindaria.md) (🔄 Proposed). Each LT task probes one channel of the two-channel policy against its hardest case and records what it observes here. This file is the running log the LT-006 decision gate reads; it is not documentation of shipped behavior.

## Infrastructure (LT-001)

- `serve.ts` — Bun server on **:3100** serving `pages/*.html` and bundling `*.ts` PoC modules on demand (`Bun.build`, `DEV_MODE="true"`, cached by mtime). Deliberately separate from the docs server (port 3000): `examples/` is the published demo surface.
- `fixtures/aria.ts` — three observation tiers:
  1. **`computedAriaTree(page, selector)`** — the engine's own accessibility tree via CDP `Accessibility.getFullAXTree`, sliced to the element's subtree. **Chromium only** (Playwright exposes no computed-tree API for Firefox/WebKit). This is ground truth: what AT consumes.
  2. **`ariaSnapshotOf()` / `getByRole`** — Playwright's injected ARIA engine. All engines, but a *tool's* view of the DOM, not the platform's.
  3. **`runAxe()`** — axe-core ≥ 4.13 in-page, reading ElementInternals through the element-internals-declaration registry (`globalThis._elementInternals`, populated by the probe).
- Run with: `node node_modules/.bin/playwright test --project=poc-chromium` (or `poc-firefox` / `poc-webkit`).

## ⚠️ Correction (2026-08-31, during LT-002)

LT-001's original baseline wrote `internals.ariaValuenow = '42'` in `poc-basic.ts` — lowercase `n`. The real `ARIAMixin` IDL attribute is **`ariaValueNow`** (capital `N`; likewise `ariaValueMin`, `ariaValueMax`, `ariaValueText`). Since JS objects accept arbitrary property assignment, the mis-cased write silently created an inert data property instead of calling the real setter — no error, no effect on ARIA state. This produced a false negative: the original finding "internals-set `aria-valuenow` does not reach the AX tree" was an artifact of the typo, not a platform gap.

Fixed in `poc-basic.ts`, `poc.spec.ts`, and this file. **Corrected finding**: internals-set `aria-valuenow` (and `aria-valuemin`/`aria-valuemax`/`aria-valuetext`) reach the Chromium AX tree exactly like `role` and `aria-label` do — see the LT-002 findings below, which re-verified this on the harder slider case with the correct property names. `ariaExpanded` and `ariaLabel` were never affected (no casing mismatch possible — single-word suffix). **Lesson for LT-003/LT-004**: the `ariaXxxYyy`-shaped `ARIAMixin` properties (the value-class and element-reference-class ones) are easy to mis-type against the hyphenated attribute name; TypeScript only catches this when the target is typed as `ElementInternals`/`ARIAMixin`, not `any` — keep PoC probes strictly typed.

## Findings matrix — LT-001 baseline (corrected)

Observed 2026-08-31 with Playwright 1.62 (`poc.spec.ts` pins all of this; a tooling/engine upgrade that changes behavior should flip a pinned test and this table).

| Observation channel | internals-set `role` + `aria-label` | internals-set `aria-valuenow` | attribute semantics | internals-related axe violations |
|---|---|---|---|---|
| Chromium engine tree (CDP) | ✅ visible | ✅ visible (`'42'`) | ✅ visible | — |
| Firefox engine tree | n/a (no CDP access from Playwright) | n/a | n/a | — |
| WebKit engine tree | n/a (no CDP access from Playwright) | n/a | n/a | — |
| Playwright tooling (`getByRole`/`ariaSnapshot`) | ❌ invisible (empty snapshot, role not counted) — same in Chromium, Firefox, WebKit | ❌ invisible | ✅ visible | — |
| axe-core 4.13 (registry populated) | ✅ no false positives (also in Firefox/WebKit runs) | ✅ no false positive (`aria-required-attr` stays silent on the internals-only progressbar) | ✅ | none observed |

### The load-bearing discoveries

1. **Chromium maps internals-set `role`, `aria-label`, AND `aria-valuenow` into the AX tree.** All three reach the computed tree identically to their attribute-set equivalents (verified via the corrected `ariaValueNow` property). The internals channel is proven for role, name, *and* live numeric/range state in Chromium — the two-channel policy's "component-owned default semantics on the host" row (ADR 0026 §1) holds for the progressbar case without qualification.
2. **Playwright's tooling tier ignores ElementInternals entirely** — `getByRole('progressbar')` counts only attribute-carrying probes, and `ariaSnapshot` of the internals-only probe is empty, identically on all three engines. Testing-library-style queries cannot see internals semantics; assertions on internals-driven state must go through `computedAriaTree()` (Chromium) or the registry/IDL (all engines). This is the tooling-introspection gap w3c/aria#2663 describes, seen from the test-runner side.
3. **The override/reassert semantics are real** (Chromium, name AND value): a host `aria-label`/`aria-valuenow` attribute beats the internals default, and `removeAttribute` restores the internals value — the platform behavior ADR 0026 §1's consumer-override story rests on. (Also confirmed as a *risk*: stale server-rendered attributes permanently shadow reflection — the no-mixing rule and the LT-002 SSR probe exist because of this.)
4. **axe-core 4.13 + registry produces zero internals-related violations** on the probe page in all three engines — including no `aria-required-attr` complaint for the internals-only progressbar (axe skips internals elements in rules it does not support, rather than false-flagging them). Whether axe *positively* honors internals `role` (the trap test: reflected `role=button` with the native child dropped must be flagged) is LT-005's explicit check; this baseline only proves the pipeline runs silently.
5. Engine-level ground truth for **Firefox/WebKit computed trees is unobservable** through Playwright (no CDP equivalent). Any cross-engine semantics claim beyond the tooling tier needs manual VO/NVDA verification or a dedicated out-of-Playwright harness — recorded as a standing limitation of the PoC.
6. **CDP's `Accessibility.getFullAXTree` does not surface a node's `valuetext` property reliably**, even for pure attribute-set `aria-valuetext` with no internals involved — confirmed as a fixture/tooling artifact, not a channel distinction (see LT-002). Do not read `computedAriaTree().props.valuetext` as ground truth; use the IDL (`internals.ariaValueText`) or the content attribute directly.

## Findings matrix — LT-002 (host default-semantics channel: hue slider)

Hardest case: `internals.role = 'slider'` with all four range properties (`ariaValueMin`/`Max`/`Now`/`Text`) internals-only, reactive at pointermove frequency via `throttle()` — `poc-hue-slider.ts`, modeled on `form-colorgraph`'s real hue slider.

1. **Internals-only fully maps for the slider case.** Role, static bounds (`valuemin`/`valuemax`), and the live `valuenow` all reach the Chromium AX tree correctly (`0`/`360`/`120` for a `setHue(120)` call) — extending finding 1 above from `progressbar` to `slider`, and from static to reactive, throttled updates. There is no engine gap to route around; a mirrored-to-attribute variant tried during development turned out to be solving a problem that didn't exist (see the correction note above) and would have violated the no-mixing rule for nothing. Dropped.
2. **Consumer override and reassert hold for numeric state, not just name/role.** A static `aria-valuenow="270"` attribute wins over the component's internals default (`0`); removing it restores `0`. Same mechanism as LT-001 finding 3, confirmed on the harder continuously-updating case.
3. **No glitching under high-frequency updates.** 50 synchronous `setHue()` calls (simulating a fast pointermove burst) collapse into exactly one throttled flush via cause-effect's `throttle()` (per-animation-frame dedup, M5) — the same primitive `form-colorgraph`'s real drag handlers use. The scheduler-dedup concern in the LT-002 Check criterion is unfounded for this pattern.
4. **The no-mixing wrinkle is real and the mitigation works** (`poc-stale-expanded.ts`): a server-rendered `aria-expanded="false"` attribute permanently shadows a component's runtime `internals.ariaExpanded` reflection — calling `expand()` has zero effect on the computed tree as long as the stale attribute survives. Mitigation confirmed: the component removing its own attribute for the property it manages, on connect and before first reflecting via internals, restores internals authority. **Consequence for ADR 0026 §1**: components that reflect a property via internals and *might* receive a same-named SSR/consumer-authored attribute for that property should proactively `removeAttribute()` it at connect time, or the no-mixing rule is only aspirational — nothing on the platform enforces it. Candidate follow-up for LT-006: should this attribute-drop-on-connect become part of the `bindAria()` contract (LT-004) or stay an author responsibility documented in the policy table?

## Probe inventory

| Page | Component | Probes |
|---|---|---|
| `/basic` | `poc-basic.ts` (`<poc-probe>`, raw custom element) | `#via-internals`, `#via-attribute`, `#via-both` — role/label/valuenow set per mode |
| `/hue-slider` | `poc-hue-slider.ts` (`<poc-hue-slider>`), `poc-stale-expanded.ts` (`<poc-stale-expanded>`) | `#slider-internals`, `#slider-override` — role=slider, reactive valuenow/valuetext, throttled dedup; `#toggle-clean`/`#toggle-stale`/`#toggle-mitigated` — no-mixing wrinkle on `aria-expanded` |

Subsequent LT tasks append their own pages/components here.
