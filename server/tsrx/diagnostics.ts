/**
 * Compile diagnostics for the inlined TSRX compiler (ADR 0023).
 *
 * Diagnostics are the compiler's product surface: a wrong rewrite is a wrong
 * component, so every rule that cannot be applied reports a code, a message,
 * and — where the author can act on it — a suggested fix. `severity` decides
 * how the build effect treats a file (see effects/tsrx.ts): errors fail the
 * build, known milestone gates warn and skip the file.
 */

/* === Types === */

export type DiagnosticCode =
	| 'TSRX001' // reactive @for over a List — milestone 3 (template extraction + reconcile)
	| 'TSRX002' // loop variable referenced inside a reactive thunk — hoist it first
	| 'TSRX003' // hoisted const not rebindable to a server-rendered attribute
	| 'TSRX004' // signal with no harvestable initial-DOM site
	| 'TSRX005' // construct outside the sanctioned milestone-2 subset
	| 'TSRX006' // malformed or unsupported attribute shape
	| 'TSRX007' // template structure the compiler cannot address
	| 'TSRX008' // source shape violation (root tag, exports, style placement)
	| 'TSRX009' // invalid `export const config` extension declaration

export type CompileDiagnostic = {
	code: DiagnosticCode
	severity: 'error' | 'warning'
	message: string
	/** 1-based line in the .tsrx source, when known. */
	line?: number
}

/* === Internal Functions === */

const error = (
	code: DiagnosticCode,
	message: string,
	line?: number,
): CompileDiagnostic =>
	line === undefined
		? { code, severity: 'error', message }
		: { code, severity: 'error', message, line }

const warning = (
	code: DiagnosticCode,
	message: string,
	line?: number,
): CompileDiagnostic =>
	line === undefined
		? { code, severity: 'warning', message }
		: { code, severity: 'warning', message, line }

const lineOf = (source: string, offset: number | undefined): number | undefined => {
	if (offset === undefined || offset < 0 || offset > source.length) return undefined
	let line = 1
	for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++
	return line
}

/* === Exported Functions === */

export const diagnostic = {
	/** `@for` over a reactive `List` — lands with milestone 3 (`reconcile()`). */
	reactiveForNotSupported: (source: string, offset?: number, iterable?: string) =>
		warning(
			'TSRX001',
			`@for over a reactive List${iterable ? ` (${iterable})` : ''} is milestone 3 of ADR 0023 (template extraction + reconcile()); the sanctioned milestone-2 subset covers @for over server data only. File skipped.`,
			lineOf(source, offset),
		),

	/** Loop variable used inside a reactive thunk — the hoist-first rule. */
	loopVariableInReactiveThunk: (
		source: string,
		offset: number | undefined,
		names: string[],
	) =>
		error(
			'TSRX002',
			`Reactive expressions must not reference @for variables directly (${names.map(n => `\`${n}\``).join(', ')}). Hoist the derived value into a const first (e.g. \`const pid = panelId(tab.id)\`) so the client can rebind it to a server-rendered attribute.`,
			lineOf(source, offset),
		),

	/** Hoisted const referenced reactively but never rendered as a bare attribute. */
	constNotRebindable: (
		source: string,
		offset: number | undefined,
		name: string,
		element: string,
	) =>
		error(
			'TSRX003',
			`Hoisted const \`${name}\` is referenced by a reactive expression but never rendered as a bare attribute of <${element}>, so the client cannot rebind it. Render it (e.g. \`aria-controls={${name}}\` or a \`data-\` attribute) or stop referencing it reactively.`,
			lineOf(source, offset),
		),

	/** Signal the client cannot seed from the server-rendered DOM. */
	signalNotHarvestable: (source: string, offset: number | undefined, name: string) =>
		error(
			'TSRX004',
			`Signal \`${name}\` is never rendered into the DOM, so the client cannot harvest its initial value (ADR 0003: DOM is the truth at load time). Render it — &{${name}} as a child or an attribute thunk — or remove it.`,
			lineOf(source, offset),
		),

	/** Anything outside the sanctioned milestone-2 construct set. */
	unsupported: (source: string, offset: number | undefined, what: string) =>
		error(
			'TSRX005',
			`${what} is outside the sanctioned milestone-2 subset of ADR 0023. Supported: text/attribute/class reactive bindings, event attributes, refs, @for over server data, hoisted-const rebinding, harvest rules.`,
			lineOf(source, offset),
		),

	/** Attribute shape the classifier does not accept. */
	invalidAttribute: (source: string, offset: number | undefined, what: string) =>
		error('TSRX006', what, lineOf(source, offset)),

	/** Element the generated client cannot address deterministically. */
	unaddressableElement: (source: string, offset: number | undefined, what: string) =>
		error('TSRX007', what, lineOf(source, offset)),

	/** Source-level structure violations. */
	invalidSource: (what: string) => error('TSRX008', what, undefined),

	/** Invalid `export const config` declaration (ADR 0023 sub-design 8). */
	invalidConfig: (source: string, offset: number | undefined, what: string) =>
		error('TSRX009', what, lineOf(source, offset)),

	/** Recompute a diagnostic's line from a node offset (keeps messages stable). */
	withLine: (d: CompileDiagnostic, source: string, offset: number | undefined) => ({
		...d,
		line: lineOf(source, offset),
	}),
}
