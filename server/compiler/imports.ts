/**
 * Source-import collection and placement (LT-044, regrouping move M6 of
 * LE_TRUC_COMPILER.md §7): the ONE module owning "what does this source
 * import, and where does each import land". Three concerns, previously
 * split across `config.ts` (compose-import resolution) and
 * `plain-imports.ts` (plain-import placement):
 *
 * 1. `parseComposeImports` — named imports of sibling `.tsrx` modules
 *    (ADR 0024 sub-design 10), the composable targets.
 * 2. `parseLeTrucImports`/`placeLeTrucImports` — authored
 *    `import { … } from '@zeix/le-truc'` statements: real package exports
 *    (ADR 0024 sub-design 16), placed per name against the runtime-harness
 *    filter rather than re-emitted verbatim.
 * 3. `parsePlainImports` — every OTHER top-level import, with relative
 *    specifiers rewritten for the flat generated directory (LT-034, ADR
 *    0024 sub-design 14).
 * 4. `placePlainImports`/`computeClientNeededNames` — placement of each
 *    plain import into whichever generated module(s) actually reference
 *    its bindings, inferred from usage — the same free-identifier analysis
 *    the compiler already runs for setup consts — no new annotation syntax.
 *
 * Specifier resolution uses the small pure-string POSIX helpers below:
 * module specifiers are `/`-separated on every host, so path math over them
 * must not follow the platform separator the way `node:path`'s default
 * export does on Windows.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	freeIdentifiers,
	identifierName,
	isNode,
	text,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import { DEFAULT_EMIT_PATHS } from './emit-paths'
import { dependenciesOf, isServerEvaluable } from './evaluability'
import type { ExtractContext } from './extract-context'
import type { ComponentIR, TemplateNode } from './ir'
import { onServer } from './setup-extraction'
import {
	CONTEXT_NAMES,
	FACTORY_CONTEXT_MEMBERS,
	JS_GLOBALS,
} from './vocabulary'
import { collectAttrs, walkTemplate } from './walk'

/* === Pure-string POSIX path helpers (specifiers are `/`-separated on every host) === */

/** `dir/file.tsrx` → `dir`; `file.tsrx` → `.`; `/file.tsrx` → `/`. */
const dirname = (p: string): string => {
	const idx = p.lastIndexOf('/')
	return idx === -1 ? '.' : idx === 0 ? '/' : p.slice(0, idx)
}

/** `join('dir', './sibling.tsrx')` → `dir/./sibling.tsrx` (normalize after). */
const join = (dir: string, rel: string): string =>
	dir === '.' ? rel : `${dir}/${rel}`

/** Lexical `.`/`..` segment resolution, matching `posix.normalize`. */
const normalize = (p: string): string => {
	const absolute = p.startsWith('/')
	const out: string[] = []
	for (const part of p.split('/')) {
		if (part === '' || part === '.') continue
		if (part === '..') {
			if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
			else if (!absolute) out.push('..')
			continue
		}
		out.push(part)
	}
	return (absolute ? '/' : '') + out.join('/')
}

/* === Compose imports (from config.ts) === */

/**
 * Named imports of other component modules (ADR 0024 sub-design 10, dual
 * surface per ADR 0032 sub-design 6): local binding name → import specifier
 * resolved to a repo-relative path. `filename` is itself repo-relative, so
 * the specifier resolves against its directory. Both authored extensions
 * compose — `.tsrx` and `.tsx` (cross-surface composition included; the
 * corpus's compose registry is keyed by resolved path, so either surface
 * can import the other) — anything else (a `.ts` component, a library
 * import) is not a composable import.
 */
export const parseComposeImports = (
	ast: AstNode,
	filename: string,
): Map<string, string> => {
	const imports = new Map<string, string>()
	const dir = dirname(filename)
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		const specifierNode = stmt.source
		const specifier =
			isNode(specifierNode) &&
			specifierNode.type === 'Literal' &&
			typeof specifierNode.value === 'string'
				? specifierNode.value
				: null
		if (
			!specifier ||
			(!specifier.endsWith('.tsrx') && !specifier.endsWith('.tsx'))
		)
			continue
		const resolved = normalize(join(dir, specifier))
		for (const spec of asArray(stmt.specifiers)) {
			if (spec.type !== 'ImportSpecifier') continue
			const local = identifierName(spec.local)
			if (local) imports.set(local, resolved)
		}
	}
	return imports
}

/* === Compile-time markers (ADR 0034 s1, LT-442) === */

/** The module an authored source imports its compile-time markers from. */
export const MACROS_SPECIFIER = '@zeix/le-truc-compiler/macros'

/** Every export of `MACROS_SPECIFIER` (`server/compiler/macros.ts`). */
export const MARKER_NAMES = ['css'] as const

export type MarkerName = (typeof MARKER_NAMES)[number]

const isMarkerName = (name: string | null): name is MarkerName =>
	(MARKER_NAMES as readonly (string | null)[]).includes(name)

/** The string value of an import declaration's specifier, if it has one. */
const specifierOf = (stmt: AstNode): string | null => {
	const node = stmt.source
	return isNode(node) &&
		node.type === 'Literal' &&
		typeof node.value === 'string'
		? node.value
		: null
}

/**
 * The name an import specifier imports (`css` in `{ css as style }`), or
 * null for a default or namespace import.
 */
const importedNameOf = (spec: AstNode): string | null => {
	if (spec.type !== 'ImportSpecifier') return null
	const imported = spec.imported
	if (!isNode(imported)) return null
	return imported.type === 'Literal' && typeof imported.value === 'string'
		? imported.value
		: identifierName(imported)
}

/** A value specifier that imports a marker from `MACROS_SPECIFIER`. */
const isMarkerSpecifier = (stmt: AstNode, spec: AstNode): boolean =>
	specifierOf(stmt) === MACROS_SPECIFIER &&
	(stmt as { importKind?: unknown }).importKind !== 'type' &&
	(spec as { importKind?: unknown }).importKind !== 'type' &&
	isMarkerName(importedNameOf(spec))

/**
 * The source's marker bindings: local name → the marker it imports. The
 * compiler recognizes a marker by binding, never by bare name
 * (`import { css as style }` binds `style`; a `css` that is not this import
 * binds nothing). Both front ends read this table through `markerOf`.
 */
export const parseMarkerImports = (ast: AstNode): Map<string, MarkerName> => {
	const markers = new Map<string, MarkerName>()
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		for (const spec of asArray(stmt.specifiers)) {
			if (!isMarkerSpecifier(stmt, spec)) continue
			const local = identifierName(spec.local)
			const name = importedNameOf(spec)
			if (local && isMarkerName(name)) markers.set(local, name)
		}
	}
	return markers
}

/**
 * Drop the marker bindings a component-scope declaration shadows: a
 * parameter or setup declaration of the same local name is what a read in
 * the template resolves to, so it is not the marker.
 */
export const shadowMarkers = (
	ctx: ExtractContext,
	declared: ReadonlySet<string>,
): void => {
	if (ctx.markers.size === 0) return
	const markers = new Map(ctx.markers)
	for (const name of declared) markers.delete(name)
	ctx.markers = markers
}

/** The marker an identifier node resolves to, or null when it is none. */
export const markerOf = (
	ctx: ExtractContext,
	node: unknown,
): MarkerName | null => {
	const name = identifierName(node)
	return name ? (ctx.markers.get(name) ?? null) : null
}

/**
 * An import declaration's text with its marker specifiers removed, or null
 * when every specifier is a marker — a marker import never reaches a
 * generated module (ADR 0034 s1). A declaration with no marker specifier
 * returns its text unchanged.
 */
const withoutMarkers = (source: string, stmt: AstNode): string | null => {
	const specs = asArray(stmt.specifiers)
	const kept = specs.filter(spec => !isMarkerSpecifier(stmt, spec))
	if (kept.length === specs.length) return text(source, stmt)
	if (kept.length === 0) return null
	const parts: string[] = []
	const named: string[] = []
	for (const spec of kept) {
		if (spec.type === 'ImportSpecifier') named.push(text(source, spec))
		else parts.push(text(source, spec))
	}
	if (named.length > 0) parts.push(`{ ${named.join(', ')} }`)
	const kind =
		(stmt as { importKind?: unknown }).importKind === 'type' ? 'type ' : ''
	return `import ${kind}${parts.join(', ')} from ${text(source, stmt.source as AstNode)}`
}

/* === `@zeix/le-truc` authored imports (ADR 0024 sub-design 16, LT-082) === */

/**
 * One `import { … } from '@zeix/le-truc'` statement in an authored source:
 * every VALUE name it binds (type-only statements are skipped — they were
 * dropped from generated output before sub-design 16 and stay dropped).
 */
export type LeTrucImport = {
	names: string[]
	start: number
	end: number
	/** Each name's import specifier, for a diagnostic's range (LT-371). */
	specifiers: Map<string, AstNode>
}

/**
 * Every named VALUE import from `'@zeix/le-truc'` — the author's declaration
 * of which real package exports the source uses (ADR 0024 sub-design 16).
 * NOT a plain import (`parsePlainImports` still excludes this specifier
 * below): placement is per-name against the runtime-harness filter
 * (`placeLeTrucImports`), not the verbatim re-emission plain imports get.
 */
export const parseLeTrucImports = (ast: AstNode): LeTrucImport[] => {
	const result: LeTrucImport[] = []
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		if ((stmt as { importKind?: unknown }).importKind === 'type') continue
		const specifierNode = stmt.source
		const specifier =
			isNode(specifierNode) &&
			specifierNode.type === 'Literal' &&
			typeof specifierNode.value === 'string'
				? specifierNode.value
				: null
		if (specifier !== '@zeix/le-truc') continue
		const names: string[] = []
		const specifiers = new Map<string, AstNode>()
		for (const spec of asArray(stmt.specifiers)) {
			if (spec.type !== 'ImportSpecifier') continue
			const name = identifierName(spec.local)
			if (name) {
				names.push(name)
				specifiers.set(name, spec)
			}
		}
		if (names.length > 0)
			result.push({
				names,
				start: typeof stmt.start === 'number' ? stmt.start : 0,
				end: typeof stmt.end === 'number' ? stmt.end : 0,
				specifiers,
			})
	}
	return result
}

/**
 * Exports of the server runtime harness (`server/compiler/runtime.ts`,
 * ADR 0024 sub-design 2): the names a generated SERVER module binds from the
 * harness import `emit-server.ts` synthesizes. An authored
 * `'@zeix/le-truc'` import must not re-bind any of them server-side — two
 * import statements can't share a local name, and the harness's plain-value
 * shims are what server evaluation semantically requires.
 */
const RUNTIME_HARNESS_EXPORTS: ReadonlySet<string> = new Set<string>([
	'createCell',
	'createList',
	'createStore',
	'createState',
	'deriveCell',
	'deriveList',
	'deriveStore',
	'createMemo',
	'createSensor',
	'isPending',
	'expose',
	'defineMethod',
	'asString',
	'asInteger',
	'asNumber',
	'asBoolean',
	'asEnum',
	'asClampedInteger',
	'asJSON',
	'attrValue',
	'esc',
	'text',
	'textOf',
	'attr',
	'cls',
	'styleAttr',
	'sanitizeHtml',
	'configureHtmlSanitizer',
	'items',
	'entries',
])

/**
 * `emit-server.ts`'s `argsFromAttrs` emission (LT-194) re-emits Parser
 * expressions outside `expose()`, so it needs to know which of a parsed
 * expression's free identifiers are harness-provided (importable) and which
 * resolve through the existing stubs/imports instead.
 */
export { RUNTIME_HARNESS_EXPORTS }

/**
 * The span from the first to the last of `names`' specifiers in `imp` —
 * what an unused-import report covers (LT-371); the whole declaration when
 * a specifier carries no position.
 */
const specifierSpan = (
	imp: LeTrucImport,
	names: readonly string[],
): { start: number; end: number } => {
	let start = Number.POSITIVE_INFINITY
	let end = Number.NEGATIVE_INFINITY
	for (const name of names) {
		const spec = imp.specifiers.get(name)
		if (typeof spec?.start !== 'number' || typeof spec.end !== 'number')
			return imp
		start = Math.min(start, spec.start)
		end = Math.max(end, spec.end)
	}
	return Number.isFinite(start) ? { start, end } : imp
}

/**
 * `imp.names` split into maximal runs of adjacent specifiers that `skip`
 * does not hold — so an unused-import range never covers a context name
 * LTC037 reports on its own (`{ createTask, host, createCell }` is two
 * runs, LT-371).
 */
const runsWithout = (
	imp: LeTrucImport,
	skip: ReadonlySet<string>,
): string[][] => {
	const runs: string[][] = []
	let run: string[] = []
	for (const name of imp.names) {
		if (skip.has(name)) {
			if (run.length > 0) runs.push(run)
			run = []
		} else run.push(name)
	}
	if (run.length > 0) runs.push(run)
	return runs
}

/**
 * Place each authored `'@zeix/le-truc'` import into the generated modules,
 * per name (ADR 0024 sub-design 16): a name lands in the CLIENT module when
 * a client-emitted position uses it (the real package IS the client
 * implementation), and in the SERVER module only when used there AND the
 * runtime harness cannot provide it — the harness keeps providing its
 * plain-value shims for signal constructors, parsers, `defineMethod`, so the
 * authored line is filtered per name rather than re-emitted verbatim. A
 * statement no name uses anywhere warns via LTC014, same as plain imports.
 */
export const placeLeTrucImports = (
	ctx: ExtractContext,
	component: SetupLikeComponent,
	leTrucImports: LeTrucImport[],
	/**
	 * Verbatim texts each generated module re-emits (type declarations, the
	 * params slice, the setup statements): a le-truc name whose only
	 * surviving uses there are TYPE positions places as `type X` — the
	 * usage walks count value reads only (LT-423 fixture).
	 */
	typeTexts: { server: readonly string[]; client: readonly string[] } = {
		server: [],
		client: [],
	},
): {
	server: string[]
	client: string[]
	serverNames: ReadonlySet<string>
	clientNames: ReadonlySet<string>
} => {
	const server: string[] = []
	const client: string[] = []
	const serverNames = new Set<string>()
	const clientNames = new Set<string>()
	if (leTrucImports.length === 0)
		return { server, client, serverNames, clientNames }

	const serverUsage = serverUsageNames(component)
	const clientUsage = computeClientNeededNames(component)
	const typeNamesIn = (texts: readonly string[]): ReadonlySet<string> =>
		new Set(
			texts.flatMap(
				t =>
					t
						.replace(/\/\*[\s\S]*?\*\//g, '')
						.replace(/\/\/.*$/gm, '')
						.match(/[A-Za-z_$][\w$]*/g) ?? [],
			),
		)
	const serverTypeNames = typeNamesIn(typeTexts.server)
	const clientTypeNames = typeNamesIn(typeTexts.client)
	// A FactoryContext member inside an authored '@zeix/le-truc' import is
	// LTC037 (compiler.ts) — never re-emit one: it is not a package export
	// and would break the generated module's imports.
	const contextVocabulary = new Set<string>([
		...FACTORY_CONTEXT_MEMBERS,
		...CONTEXT_NAMES,
	])
	for (const imp of leTrucImports) {
		// A FactoryContext member inside an authored '@zeix/le-truc' import is
		// LTC037 (compiler.ts) — excluded here so it is neither placed nor
		// double-reported as an unused import.
		const names = imp.names.filter(n => !contextVocabulary.has(n))
		if (names.length === 0) continue
		const usedServer = names.filter(n => serverUsage.has(n))
		const usedClient = names.filter(n => clientUsage.has(n))
		// Type-only survivors: unused as values, named in the module's own
		// verbatim texts. Placed as `type X` so a type-only export stays one
		// (LT-423 fixture: `MutableStore<T>` in a verbatim signal
		// declaration — the usage walks count value reads only).
		const typeServer = names.filter(
			n => !serverUsage.has(n) && serverTypeNames.has(n),
		)
		const typeClient = names.filter(
			n => !clientUsage.has(n) && clientTypeNames.has(n),
		)
		if (
			usedServer.length === 0 &&
			usedClient.length === 0 &&
			typeServer.length === 0 &&
			typeClient.length === 0
		) {
			// One report per run of adjacent names, so no range covers a
			// context name between them (LT-371).
			for (const run of runsWithout(imp, contextVocabulary))
				ctx.diagnostics.push(
					diagnostic.unusedPlainImport(
						ctx.source,
						specifierSpan(imp, run),
						run,
					),
				)
			continue
		}
		const serverSide = [
			...usedServer.filter(n => !RUNTIME_HARNESS_EXPORTS.has(n)),
			...typeServer.map(n => `type ${n}`),
		]
		if (serverSide.length > 0) {
			for (const n of [...usedServer, ...typeServer]) serverNames.add(n)
			server.push(`import { ${serverSide.join(', ')} } from '@zeix/le-truc'`)
		}
		const clientSide = [...usedClient, ...typeClient.map(n => `type ${n}`)]
		if (clientSide.length > 0) {
			for (const n of [...usedClient, ...typeClient]) clientNames.add(n)
			client.push(`import { ${clientSide.join(', ')} } from '@zeix/le-truc'`)
		}
	}
	return { server, client, serverNames, clientNames }
}

/* === Plain imports (from plain-imports.ts) === */

/** One plain top-level import, not yet placed into server/client output. */
export type PlainImportIR = {
	/** Verbatim import statement source text. */
	text: string
	/** Local binding names introduced (empty for a side-effect-only import). */
	localNames: string[]
	/** `import 'specifier'` with no bindings at all — can't be usage-traced. */
	sideEffectOnly: boolean
	start: number
	end: number
}

/**
 * Every top-level `ImportDeclaration` whose specifier does NOT resolve to a
 * composable target — `.tsrx` OR `.tsx` (`parseComposeImports` above claims
 * both; the dual-extension filter is the production shape LT-183's spike
 * worked around by local-name overlap; LT-183 spike findings fact 7,
 * `adr/archive/0032-spike-findings.md`) — and is not
 * `'@zeix/le-truc'` (`parseLeTrucImports` above claims that specifier — its
 * placement is per-name against the runtime-harness filter, not the
 * verbatim re-emission plain imports get). Side-effect-only imports
 * (`import 'culori/css'`) have no bindings to trace usage from. A relative
 * specifier (`./`, `../`) is rewritten to stay valid from the generated
 * modules' flat output directory — it was authored relative to the source
 * file's own location, which is almost never where the compiled module ends
 * up.
 *
 * `outDirPrefix` is that rewrite's prefix back to the project root — `../`
 * once per segment of the CONFIGURED output root (LT-255,
 * `corpus-config.ts`). It was a hard-coded `'../../../'` until the output
 * root became a consumer's choice; the default still is, so an unconfigured
 * call emits exactly what it emitted before.
 */
export const parsePlainImports = (
	ctx: ExtractContext,
	ast: AstNode,
	filename: string,
	outDirPrefix: string = DEFAULT_EMIT_PATHS.outDirPrefix,
): PlainImportIR[] => {
	const result: PlainImportIR[] = []
	const dir = dirname(filename)
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		const specifierNode = stmt.source
		const specifier =
			isNode(specifierNode) &&
			specifierNode.type === 'Literal' &&
			typeof specifierNode.value === 'string'
				? specifierNode.value
				: null
		if (
			!specifier ||
			specifier.endsWith('.tsrx') ||
			specifier.endsWith('.tsx') ||
			specifier === '@zeix/le-truc'
		)
			continue
		// A marker specifier never reaches a generated module (ADR 0034 s1):
		// the declaration drops whole when every specifier is a marker.
		const stripped = withoutMarkers(ctx.source, stmt)
		if (stripped === null) continue
		const localNames: string[] = []
		for (const spec of asArray(stmt.specifiers)) {
			if (isMarkerSpecifier(stmt, spec)) continue
			const local = identifierName(spec.local)
			if (local) localNames.push(local)
		}
		let importText = stripped
		if (specifier.startsWith('.') && isNode(specifierNode)) {
			const resolved = normalize(join(dir, specifier)).replace(/\.ts$/, '')
			const rewritten = `${outDirPrefix}${resolved}`
			importText = importText.replace(
				text(ctx.source, specifierNode),
				JSON.stringify(rewritten),
			)
		}
		result.push({
			text: importText,
			localNames,
			sideEffectOnly: localNames.length === 0,
			start: typeof stmt.start === 'number' ? stmt.start : 0,
			end: typeof stmt.end === 'number' ? stmt.end : 0,
		})
	}
	return result
}

/**
 * Every server-known-position expression node anywhere in the template
 * (LT-042: rebuilt on `walkTemplate` — traversal encoded once in walk.ts;
 * the collected NAME SET is unchanged, which is all `placePlainImports`
 * consumes). Includes `'server'`-kind attributes (the classifier's fallback
 * for any non-arrow `{…}` expression, e.g. `data-foo={helper(count)}`) —
 * they are spliced verbatim and unconditionally into the SERVER module by
 * emit-server.ts, no scope/dependency gate exists there, unlike `reactive`/
 * `style-map`/`class-map`. They belong in this always-server-rendered
 * bucket, not the scope-gated `serverRenderedThunkNodes` one (LT-037,
 * found reviewing LT-034: a plain import used only inside a `'server'`-kind
 * attribute was invisible to `placePlainImports`, mis-diagnosed as unused,
 * and dropped from the server module even though the generated code
 * referenced it).
 */
const serverExprNodes = (root: TemplateNode): AstNode[] => {
	const out: AstNode[] = []
	walkTemplate(root, node => {
		if (node.kind === 'expr' && node.reactivity === 'server')
			out.push(node.expr)
		else if (node.kind === 'conditional' && node.mode === 'server') {
			out.push(node.test)
			for (const arm of node.arms) if (arm.test) out.push(arm.test)
		} else if (node.kind === 'compose')
			for (const attr of node.attrs)
				if (attr.kind === 'arg' && attr.node) out.push(attr.node)
	})
	for (const attr of collectAttrs(root))
		if (attr.kind === 'server') out.push(attr.node)
	return out
}

/** Every client-always expression node anywhere in the template. */
const clientExprNodes = (root: TemplateNode): AstNode[] => {
	const out: AstNode[] = []
	walkTemplate(root, node => {
		if (node.kind === 'expr' && node.reactivity === 'reactive')
			out.push(node.expr)
		else if (node.kind === 'client-stmt') out.push(node.node)
		// A reactive conditional's test is its client arm-key thunk (ADR 0037).
		else if (node.kind === 'conditional' && node.mode === 'reactive')
			out.push(node.test)
		// `pass={{ }}` on a composed element (LT-088): `collectAttrs` only
		// covers `kind: 'element'` attrs (`ComposeAttrIR` is a different
		// vocabulary, walk.ts's own doc comment on `collectAttrs` used to
		// flag this as a known gap) — a plain-setup-const/plain-import
		// referenced ONLY inside a compose `pass` thunk (`truc:pass={{ value:
		// () => toDisplay(...) }}`) needs the exact same client-need tracing
		// raw-element `pass` gets below, or it silently never gets emitted.
		else if (node.kind === 'compose')
			for (const attr of node.attrs)
				if (attr.kind === 'pass')
					for (const entry of attr.entries) {
						out.push(entry.thunk)
						if (entry.setThunk) out.push(entry.setThunk)
					}
	})
	for (const attr of collectAttrs(root)) {
		if (attr.kind === 'reactive') out.push(attr.thunk)
		else if (attr.kind === 'style-map' || attr.kind === 'class-map')
			out.push(attr.object)
		else if (attr.kind === 'event') out.push(attr.handler)
		else if (attr.kind === 'html' && attr.reactive) out.push(attr.node)
		else if (attr.kind === 'pass')
			for (const entry of attr.entries) {
				out.push(entry.thunk)
				if (entry.setThunk) out.push(entry.setThunk)
			}
	}
	return out
}

/**
 * Server-conditional reactive-family thunks (`reactive`/`style-map`/
 * `class-map`) — gated by the same `isServerEvaluable` rule emit-server.ts
 * applies (evaluability.ts, LT-043), so a plain import used only inside a
 * thunk that DOES get server-rendered still lands server-side.
 */
const serverRenderedThunkNodes = (
	root: TemplateNode,
	serverKnown: ReadonlySet<string>,
): AstNode[] => {
	const out: AstNode[] = []
	// A reactive conditional's test folds its initial winner server-side.
	walkTemplate(root, node => {
		if (
			node.kind === 'conditional' &&
			node.mode === 'reactive' &&
			isServerEvaluable(node.test, serverKnown)
		)
			out.push(node.test)
	})
	for (const attr of collectAttrs(root)) {
		if (attr.kind === 'reactive' && isServerEvaluable(attr.thunk, serverKnown))
			out.push(attr.thunk)
		else if (
			(attr.kind === 'style-map' || attr.kind === 'class-map') &&
			isServerEvaluable(attr.object, serverKnown)
		)
			out.push(attr.object)
		else if (
			attr.kind === 'html' &&
			attr.reactive &&
			isServerEvaluable(attr.node, serverKnown)
		)
			out.push(attr.node)
	}
	return out
}

type SetupLikeComponent = Pick<
	ComponentIR,
	| 'root'
	| 'setup'
	| 'plainSetup'
	| 'clientSetup'
	| 'itemSetup'
	| 'signals'
	| 'serverKnown'
>

/**
 * Every name required in the CLIENT module: free names of every always-
 * client-emitted position (reactive/style-map/class-map/event attribute
 * thunks, lazy `&{}` children, `client-stmt` side effects, `clientSetup`
 * statements, signal declarations — signals are always harvested
 * client-side), `expose()` (also always both), plus a fixpoint over
 * `plainSetup`: a plain const pulled in by any of those (or by another
 * plain const already pulled in) contributes its own free names too. A
 * plain const referenced ONLY from a server-only position (e.g. an `@if`
 * condition) is correctly excluded — it would be a "Cannot find name"
 * client-side otherwise (found migrating `form-textbox.tsrx`'s `@if
 * (validatable)`, alongside LT-034).
 */
export const computeClientNeededNames = (
	component: SetupLikeComponent,
): ReadonlySet<string> => {
	const needed = new Set<string>()
	for (const exprNode of clientExprNodes(component.root))
		for (const n of dependenciesOf(exprNode)) needed.add(n)
	for (const stmt of component.clientSetup)
		for (const n of dependenciesOf(stmt.node)) needed.add(n)
	// Every item setup statement is client-emitted, in `bindItem` (ADR
	// 0046 s5) — a ref through its selector alone.
	for (const stmt of component.itemSetup)
		if (stmt.kind !== 'ref')
			for (const n of dependenciesOf(stmt.node)) needed.add(n)
	// Every `setup` entry that ISN'T a plain const (signals, `expose()`) is
	// always client-emitted too — `plainSetup` is `setup`'s only conditional
	// subset (same object references, so `Set` membership by name is enough
	// to tell them apart).
	const plainSetupNames = new Set(
		component.plainSetup.map(s => s.name).filter((n): n is string => !!n),
	)
	for (const stmt of component.setup)
		if (!stmt.name || !plainSetupNames.has(stmt.name))
			for (const n of dependenciesOf(stmt.node)) needed.add(n)
	let changed = true
	while (changed) {
		changed = false
		for (const stmt of component.plainSetup) {
			if (!stmt.name || !needed.has(stmt.name)) continue
			for (const n of dependenciesOf(stmt.node))
				if (!needed.has(n)) {
					needed.add(n)
					changed = true
				}
		}
	}
	return needed
}

/**
 * Every name a server-evaluated position uses: setup statements (emitted
 * verbatim into the server module unconditionally, ADR 0024 sub-design 12),
 * always-server template expressions, and server-conditional reactive-family
 * thunks. Shared by `placePlainImports` and `placeLeTrucImports`; exported
 * since LT-165 step 5 for the rendered-client-only-const check (`LTC046`),
 * which asks the complementary question — did a setup const the harness
 * cannot evaluate reach one of these positions?
 */
export const serverUsageNames = (
	component: SetupLikeComponent,
): ReadonlySet<string> => {
	const serverNames = new Set<string>()
	for (const stmt of component.setup)
		for (const n of dependenciesOf(stmt.node)) serverNames.add(n)
	// The item setup the server's loop declares (ADR 0046 s5).
	for (const stmt of component.itemSetup)
		if (onServer(stmt))
			for (const n of dependenciesOf(stmt.node)) serverNames.add(n)
	for (const exprNode of serverExprNodes(component.root))
		for (const n of dependenciesOf(exprNode)) serverNames.add(n)
	for (const exprNode of serverRenderedThunkNodes(
		component.root,
		component.serverKnown,
	))
		for (const n of dependenciesOf(exprNode)) serverNames.add(n)
	return serverNames
}

/**
 * Place each plain import into the generated server module, client module,
 * or both — inferred from where its bindings are actually used. Pushes a
 * LTC014 warning (not dropped silently) for an import with no detectable
 * usage anywhere the compiler looks.
 */
export const placePlainImports = (
	ctx: ExtractContext,
	component: SetupLikeComponent,
	plainImports: PlainImportIR[],
	/**
	 * Declaration texts each generated module carries verbatim (type
	 * aliases, `declare global`, the server's parameter types). A name they
	 * reference is a use in that module — but only an `import type`
	 * statement is credited from them, since it is erased at build time and
	 * can carry no side effect into a module that would not otherwise load it.
	 */
	typeTexts: { server: readonly string[]; client: readonly string[] } = {
		server: [],
		client: [],
	},
): {
	server: string[]
	client: string[]
	serverLocalNames: ReadonlySet<string>
} => {
	if (plainImports.length === 0)
		return { server: [], client: [], serverLocalNames: new Set() }

	const serverNames = serverUsageNames(component)
	const clientNames = computeClientNeededNames(component)
	const typeNamesIn = (texts: readonly string[]): ReadonlySet<string> =>
		new Set(
			texts.flatMap(
				t =>
					t
						.replace(/\/\*[\s\S]*?\*\//g, '')
						.replace(/\/\/.*$/gm, '')
						.match(/[A-Za-z_$][\w$]*/g) ?? [],
			),
		)
	const serverTypeNames = typeNamesIn(typeTexts.server)
	const clientTypeNames = typeNamesIn(typeTexts.client)

	const server: string[] = []
	const client: string[] = []
	const serverLocalNames = new Set<string>()
	for (const imp of plainImports) {
		if (imp.sideEffectOnly) {
			// No bound name to trace usage from — a missing side-effect import
			// is a silent runtime bug, not a compile error, so default to the
			// safe choice: include it everywhere rather than guess.
			server.push(imp.text)
			client.push(imp.text)
			continue
		}
		const typeOnly = /^import\s+type\b/.test(imp.text)
		const usedServer = imp.localNames.some(
			n => serverNames.has(n) || (typeOnly && serverTypeNames.has(n)),
		)
		const usedClient = imp.localNames.some(
			n => clientNames.has(n) || (typeOnly && clientTypeNames.has(n)),
		)
		if (usedServer) {
			server.push(imp.text)
			for (const n of imp.localNames) serverLocalNames.add(n)
		}
		if (usedClient) client.push(imp.text)
		if (!usedServer && !usedClient)
			ctx.diagnostics.push(
				diagnostic.unusedPlainImport(ctx.source, imp, imp.localNames),
			)
	}
	return { server, client, serverLocalNames }
}
