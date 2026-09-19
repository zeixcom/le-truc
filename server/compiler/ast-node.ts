/**
 * The machinery's own AST node type (LT-271).
 *
 * Every stage between the front ends and the emitters walks an estree-shaped
 * tree of loosely-typed nodes. Both front ends produce that shape — `.tsrx`
 * through `@tsrx/core`'s `parseModule`, `.tsx` through
 * `frontend/tsx/to-estree.ts`'s converter — so the type belongs to the
 * machinery, not to either parser.
 *
 * Until LT-271 the shared modules imported it as `TsrxNode` from
 * `@tsrx/core`, which named the machinery after the minority surface and put
 * a `.tsrx`-only package specifier in ~20 surface-neutral files. It is
 * structurally identical to both front ends' declarations, so nothing about
 * the walks changes; `core-shim.d.ts` keeps its own `TsrxNode` because that
 * one really is the pinned parser's type, and `core.ts` remains the single
 * value-level pin boundary (ADR 0024 sub-design 2).
 */
export type AstNode = {
	type: string
	start?: number
	end?: number
	[key: string]: unknown
}
