/**
 * Typed `.tsrx` compose imports for authored `.tsx` (LT-096).
 *
 * The compiler resolves a `.tsx` parent's compose import of a `.tsrx`
 * child (`imports.ts` accepts both specifiers), but tsc cannot read a
 * `.tsrx` module. Each entry here types one such child through its
 * GENERATED server module's args — the compiled contract itself, so a
 * compose site is checked against the child's real args with no second
 * copy to drift. Add an entry when a migrated `.tsx` composes a child that
 * is still `.tsrx`-only; delete it when the child gains a `.tsx` spelling.
 *
 * Requires the compiled corpus (`scripts/build-corpus.ts`), like every
 * generated-module import in `examples/`.
 */

declare module '*/basic-button.tsrx' {
	export const BasicButton: (
		args: Parameters<
			typeof import('../../../generated/components/basic-button.server').renderBasicButton
		>[0],
	) => JSX.Element
}
