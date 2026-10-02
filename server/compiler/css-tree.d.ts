/**
 * Ambient type shim for the pinned `css-tree` dependency.
 *
 * The package ships no TypeScript declarations at all, and the compiler
 * uses one narrow slice of it: the declaration-grammar lexer behind
 * LTC064 (ADR 0033 s9, LT-268). css.ts imports the package's prebuilt
 * `dist/csstree.esm.js` bundle — the entry loads its dictionary patch
 * through a runtime `createRequire`, which cannot ride the portability
 * check's self-contained module graph (ADR 0038). This shim is that
 * import specifier's type side: exactly the functions and the loose AST
 * shape the grammar pass uses, so a css-tree upgrade only ever touches
 * `css.ts` and this file. Runtime resolution is unaffected — Bun loads
 * the real bundle.
 */
declare module 'css-tree/dist/csstree.esm.js' {
	/** A source position css-tree records with `positions: true`. */
	export type CssTreePosition = {
		/** 0-based offset within the parsed text. */
		offset: number
		/** 1-based line. */
		line: number
		/** 1-based column. */
		column: number
	}

	export type CssTreeLocation = {
		start: CssTreePosition
		end: CssTreePosition
	}

	/**
	 * The loose AST node shape: css-tree's node types are structural
	 * (`type` plus per-type fields); the grammar pass reads `loc`,
	 * `property`, `value`, `children`, `block` and a Raw node's `value`.
	 */
	export type CssNode = {
		type: string
		loc?: CssTreeLocation
		property?: string
		name?: string
		value?: CssNode
		block?: CssNode
		children?: Iterable<CssNode>
		[key: string]: unknown
	}

	/** A `Declaration` node (`property` plus a parsed or Raw `value`). */
	export type CssTreeDeclaration = CssNode & {
		property: string
		value?: CssNode
	}

	export type CssTreeParseOptions = {
		positions?: boolean
		context?:
			| 'stylesheet'
			| 'atrule'
			| 'atrulePrelude'
			| 'attributeSelector'
			| 'declaration'
			| 'declarationList'
			| 'selector'
			| 'value'
	}

	/** Parse CSS text into an AST (see css-tree's parse contexts). */
	export function parse(source: string, options?: CssTreeParseOptions): CssNode

	/** The spec-grammar lexer over the package's built-in dictionary. */
	export const lexer: {
		/**
		 * Match one declaration against its property's grammar. Resolves
		 * vendor and hack prefixes itself; refuses custom properties and
		 * values referencing `var()`.
		 */
		matchDeclaration(node: CssTreeDeclaration): {
			/** The matched AST, or null when the declaration mismatches. */
			matched: CssNode | null
			/** Why the match failed (null when matched). */
			error: { message: string } | null
		}
	}
}
