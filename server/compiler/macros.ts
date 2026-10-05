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

/**
 * A `harvest()` entry: reads a field's raw value from the item's markup. A
 * `Parser` of the field's type fits (`asNumber()`, `asParser(…)`); an
 * optional field's entry may also return `undefined`, which a `Parser`
 * cannot.
 */
export type FieldParser<V> = (value: string | null | undefined) => V

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

/**
 * The per-field parsers of a list seeded from server args (ADR 0046 s7,
 * LT-429): `createList(harvest(items, { due: asDate() }), …)`. The client
 * rebuilds each server-rendered item field by field from the item's markup,
 * and reads each field through a parser. The compiler infers a parser from
 * a same-file item type (`string` → `asString`, `number` → `asNumber`,
 * `boolean` → `asBoolean`); an entry here overrides that, and declares the
 * parser of a field it cannot infer (a `Date`, a field of an imported
 * type). For an item type the compiler cannot read, the map's keys are the
 * field list. Recognized only as the seed argument of `createList`; the
 * server reads `seed` through unchanged.
 *
 * @param seed - The server-side seed, an array of items from server args
 * @param parsers - A parser per field, each typed against its field
 * @returns `seed`, on the server
 * @throws {Error} Always — reached only when the source was not compiled.
 */
export function harvest<T extends object>(
	seed: T[],
	parsers: { [K in keyof T]?: FieldParser<T[K]> },
): T[]
export function harvest(_seed: unknown, _parsers: unknown): unknown {
	throw uncompiled('harvest')
}
