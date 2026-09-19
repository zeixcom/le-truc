/**
 * The `@tsrx/core` pin adapter (LT-040, regrouping move M2 of
 * LE_TRUC_COMPILER.md §7) — the ONE module importing the pinned parser's
 * VALUES (0.1.63, ADR 0023 sub-design 2). Every pipeline stage takes the
 * parser, predicates, and stylesheet accessors from here instead of
 * importing `@tsrx/core` directly. Siblings import no types from it either:
 * the estree node type the machinery walks is its own `AstNode`
 * (`ast-node.ts`, LT-271), so this file and `core-shim.d.ts` are the pin's
 * entire footprint.
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
