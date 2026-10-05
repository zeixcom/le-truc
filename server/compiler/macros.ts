/**
 * `@zeix/le-truc-compiler/macros` — the compile-time markers an authored
 * source imports (ADR 0034 s1, LT-442). A marker is a call the compiler
 * consumes and never runs: it recognizes the call by this module's
 * specifier and the imported name (an alias resolves, a same-named local
 * never matches) and strips the import from both generated modules. The
 * exports here are typed stubs for `tsc` and editors; each throws when a
 * source reaches it uncompiled.
 *
 * The package does not exist yet (LT-254): in-repo, the specifier resolves
 * to this file through a `paths` entry in each tsconfig that checks
 * authored `.tsx` sources.
 */

/** The message a marker stub throws when its source ran uncompiled. */
const uncompiled = (name: string): Error =>
	new Error(
		`\`${name}\` ran in a source that was not compiled — it is a compile-time marker from \`@zeix/le-truc-compiler/macros\`, and only the compiler reads it. Load the component's generated module, not its authored source.`,
	)

/**
 * The CSS template tag (LT-202): `<style>{css`…`}</style>` is the default
 * spelling for a component's stylesheet — editors highlight a `css`-tagged
 * template literal as CSS out of the box. The tag is compile-consumed:
 * evaluated by nothing, and a `${}` substitution inside is rejected by the
 * compiler (typed `never` here so authored code hears the same thing from
 * tsc). A bare template literal still works, but `css` is what the profile
 * teaches.
 *
 * @throws {Error} Always — reached only when the source was not compiled.
 */
export const css = (
	_source: TemplateStringsArray,
	..._substitutions: never[]
): string => {
	throw uncompiled('css')
}
