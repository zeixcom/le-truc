/**
 * The `@tsrx/core` pin adapter (LT-040, regrouping move M2 of
 * LE_TRUC_COMPILER.md §7) — the ONE module importing the pinned parser's
 * VALUES (0.1.60, ADR 0023 sub-design 2). Every pipeline stage takes the
 * parser, predicates, and stylesheet accessors from here instead of
 * importing `@tsrx/core` directly; siblings may still import its TYPES
 * (`TsrxNode`), which erase at compile time and carry no pin footprint.
 * A pure leaf (a re-export, nothing else), so a pin upgrade touches only
 * this file and core-shim.d.ts — the same isolation ADR 0024 asked for,
 * achieved without routing sibling imports through the front end (the old
 * `compiler.ts` ⇄ `lower-template.ts` value cycle via the `isForOfNode`/
 * `isVoidTag` re-exports is gone).
 */

export {
	getStyleElementStylesheet,
	isStyleElement,
	isTemplateForOfNode,
	isVoidElement,
	parseModule,
} from '@tsrx/core'
