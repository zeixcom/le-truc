/**
 * Ambient type shim for the pinned `@tsrx/core` dependency.
 *
 * The package's main entry ships no usable types for our surface (its
 * `types` field points at a `.js` file), and ADR 0023 pins `@tsrx/core` at
 * 0.1.60 behind a single emitter module (`server/tsrx/compiler.ts`). This
 * shim is that boundary's type side: it declares exactly the functions the
 * compiler uses, over the loose `TsrxNode` structural type, so a pin
 * upgrade only ever touches `compiler.ts` and this file.
 *
 * Runtime resolution is unaffected — Bun loads the real package.
 */
declare module '@tsrx/core' {
	export type TsrxNode = {
		type: string
		start?: number
		end?: number
		[key: string]: unknown
	}

	/** Parse a `.tsrx` module into an estree-shaped AST (custom JSX node types). */
	export function parseModule(source: string, filename: string): TsrxNode

	/** True for `<style>` elements; their stylesheet is retrievable below. */
	export function isStyleElement(node: unknown): boolean

	/**
	 * Stylesheet of a `<style>` element. `.source` is the verbatim CSS text
	 * (including original indentation); `renderStylesheets()` class-hashing is
	 * deliberately NOT used (ADR 0023 sub-design 2).
	 */
	export function getStyleElementStylesheet(node: TsrxNode): {
		source: string
	} | null

	/** True for `@for (…) { … }` template nodes. */
	export function isTemplateForOfNode(node: unknown): boolean

	/** True for HTML void elements (rendered self-closing, no end tag). */
	export function isVoidElement(tag: string): boolean
}
