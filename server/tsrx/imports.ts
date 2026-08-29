/**
 * Source-import collection and placement (LT-044, regrouping move M6 of
 * LE_TRUC_COMPILER.md §7): the ONE module owning "what does this source
 * import, and where does each import land". Three concerns, previously
 * split across `config.ts` (compose-import resolution) and
 * `plain-imports.ts` (plain-import placement):
 *
 * 1. `parseComposeImports` — named imports of sibling `.tsrx` modules
 *    (ADR 0023 sub-design 10), the composable targets.
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
 * Browser-pure by construction (ADR 0025 sub-design 6): specifier
 * resolution uses the small pure-string POSIX helpers below, NOT
 * `node:path` — the compiler must stay loadable in a browser bundle.
 */

import type { TsrxNode } from '@tsrx/core'
import {
	asArray,
	CONTEXT_NAMES,
	FACTORY_CONTEXT_MEMBERS,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	text,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import { dependenciesOf, isServerEvaluable } from './evaluability'
import type { ComponentIR, ExtractContext, TemplateNode } from './ir'
import { collectAttrs, walkTemplate } from './walk'

/* === Pure-string POSIX path helpers (no node:path — browser purity) === */

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
 * Named imports of other `.tsrx` modules (ADR 0023 sub-design 10): local
 * binding name → import specifier resolved to a repo-relative path.
 * `filename` is itself repo-relative, so the specifier resolves against its
 * directory. Only `.tsrx` specifiers compose — anything else (a `.ts`
 * component, a library import) is not a composable import.
 */
export const parseComposeImports = (
	ast: TsrxNode,
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
		if (!specifier || !specifier.endsWith('.tsrx')) continue
		const resolved = normalize(join(dir, specifier))
		for (const spec of asArray(stmt.specifiers)) {
			if (spec.type !== 'ImportSpecifier') continue
			const local = identifierName(spec.local)
			if (local) imports.set(local, resolved)
		}
	}
	return imports
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
}

/**
 * Every named VALUE import from `'@zeix/le-truc'` — the author's declaration
 * of which real package exports the source uses (ADR 0024 sub-design 16).
 * NOT a plain import (`parsePlainImports` still excludes this specifier
 * below): placement is per-name against the runtime-harness filter
 * (`placeLeTrucImports`), not the verbatim re-emission plain imports get.
 */
export const parseLeTrucImports = (ast: TsrxNode): LeTrucImport[] => {
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
		for (const spec of asArray(stmt.specifiers)) {
			if (spec.type !== 'ImportSpecifier') continue
			const name = identifierName(spec.local)
			if (name) names.push(name)
		}
		if (names.length > 0)
			result.push({
				names,
				start: typeof stmt.start === 'number' ? stmt.start : 0,
			})
	}
	return result
}

/**
 * Exports of the server runtime harness (`server/tsrx/runtime.ts`,
 * ADR 0023 sub-design 2): the names a generated SERVER module binds from the
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
	'esc',
	'attr',
	'cls',
	'styleAttr',
	'sanitizeHtml',
	'configureHtmlSanitizer',
	'items',
	'entries',
])

/**
 * Place each authored `'@zeix/le-truc'` import into the generated modules,
 * per name (ADR 0024 sub-design 16): a name lands in the CLIENT module when
 * a client-emitted position uses it (the real package IS the client
 * implementation), and in the SERVER module only when used there AND the
 * runtime harness cannot provide it — the harness keeps providing its
 * plain-value shims for signal constructors, parsers, `defineMethod`, so the
 * authored line is filtered per name rather than re-emitted verbatim. A
 * statement no name uses anywhere warns via TSRX014, same as plain imports.
 */
export const placeLeTrucImports = (
	ctx: ExtractContext,
	component: SetupLikeComponent,
	leTrucImports: LeTrucImport[],
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
	// A FactoryContext member inside an authored '@zeix/le-truc' import is
	// TSRX037 (compiler.ts) — never re-emit one: it is not a package export
	// and would break the generated module's imports.
	const contextVocabulary = new Set<string>([
		...FACTORY_CONTEXT_MEMBERS,
		...CONTEXT_NAMES,
	])
	for (const imp of leTrucImports) {
		// A FactoryContext member inside an authored '@zeix/le-truc' import is
		// TSRX037 (compiler.ts) — excluded here so it is neither placed nor
		// double-reported as an unused import.
		const names = imp.names.filter(n => !contextVocabulary.has(n))
		if (names.length === 0) continue
		const usedServer = names.filter(n => serverUsage.has(n))
		const usedClient = names.filter(n => clientUsage.has(n))
		if (usedServer.length === 0 && usedClient.length === 0) {
			ctx.diagnostics.push(
				diagnostic.unusedPlainImport(ctx.source, imp.start, names),
			)
			continue
		}
		const serverSide = usedServer.filter(n => !RUNTIME_HARNESS_EXPORTS.has(n))
		if (serverSide.length > 0) {
			for (const n of serverSide) serverNames.add(n)
			server.push(`import { ${serverSide.join(', ')} } from '@zeix/le-truc'`)
		}
		if (usedClient.length > 0) {
			for (const n of usedClient) clientNames.add(n)
			client.push(`import { ${usedClient.join(', ')} } from '@zeix/le-truc'`)
		}
	}
	return { server, client, serverNames, clientNames }
}

/* === Plain imports (from plain-imports.ts) === */

/**
 * Every generated module lives flat in `server/generated/tsrx/`, regardless
 * of the source `.tsrx` file's own nesting under `examples/` (same flattening
 * `effects/tsrx.ts`'s `handwrittenExampleModules()` and compose imports
 * already rely on) — so a relative plain-import specifier, resolved to a
 * repo-relative path, always needs this fixed prefix back to the repo root.
 */
const GENERATED_DIR_DEPTH_PREFIX = '../../../'

/** One plain top-level import, not yet placed into server/client output. */
export type PlainImportIR = {
	/** Verbatim import statement source text. */
	text: string
	/** Local binding names introduced (empty for a side-effect-only import). */
	localNames: string[]
	/** `import 'specifier'` with no bindings at all — can't be usage-traced. */
	sideEffectOnly: boolean
	start: number
}

/**
 * Every top-level `ImportDeclaration` whose specifier does NOT resolve to a
 * `.tsrx` compose target (`parseComposeImports` above already claims
 * those) and is not `'@zeix/le-truc'` (`parseLeTrucImports` above claims
 * that specifier — its placement is per-name against the runtime-harness
 * filter, not the verbatim re-emission plain imports get). Side-effect-only imports (`import 'culori/css'`)
 * have no bindings to trace usage from. A relative specifier (`./`, `../`)
 * is rewritten to stay valid from the generated modules' flat output
 * directory — it was authored relative to the `.tsrx` source's own
 * location, which is almost never where the compiled module ends up.
 */
export const parsePlainImports = (
	ctx: ExtractContext,
	ast: TsrxNode,
	filename: string,
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
			specifier === '@zeix/le-truc'
		)
			continue
		const localNames: string[] = []
		for (const spec of asArray(stmt.specifiers)) {
			const local = identifierName(spec.local)
			if (local) localNames.push(local)
		}
		let importText = text(ctx.source, stmt)
		if (specifier.startsWith('.') && isNode(specifierNode)) {
			const resolved = normalize(join(dir, specifier)).replace(/\.ts$/, '')
			const rewritten = `${GENERATED_DIR_DEPTH_PREFIX}${resolved}`
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
const serverExprNodes = (root: TemplateNode): TsrxNode[] => {
	const out: TsrxNode[] = []
	walkTemplate(root, node => {
		if (node.kind === 'expr' && !node.lazy) out.push(node.expr)
		else if (node.kind === 'if') out.push(node.test)
		else if (node.kind === 'switch') out.push(node.discriminant)
		else if (node.kind === 'compose')
			for (const attr of node.attrs)
				if (attr.kind === 'arg' && attr.node) out.push(attr.node)
	})
	for (const attr of collectAttrs(root))
		if (attr.kind === 'server') out.push(attr.node)
	return out
}

/** Every client-always expression node anywhere in the template. */
const clientExprNodes = (root: TemplateNode): TsrxNode[] => {
	const out: TsrxNode[] = []
	walkTemplate(root, node => {
		if (node.kind === 'expr' && node.lazy) out.push(node.expr)
		else if (node.kind === 'client-stmt') out.push(node.node)
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
): TsrxNode[] => {
	const out: TsrxNode[] = []
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
	'root' | 'setup' | 'plainSetup' | 'clientSetup' | 'signals' | 'serverKnown'
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
 * thunks. Shared by `placePlainImports` and `placeLeTrucImports`.
 */
const serverUsageNames = (
	component: SetupLikeComponent,
): ReadonlySet<string> => {
	const serverNames = new Set<string>()
	for (const stmt of component.setup)
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
 * TSRX014 warning (not dropped silently) for an import with no detectable
 * usage anywhere the compiler looks.
 */
export const placePlainImports = (
	ctx: ExtractContext,
	component: SetupLikeComponent,
	plainImports: PlainImportIR[],
): {
	server: string[]
	client: string[]
	serverLocalNames: ReadonlySet<string>
} => {
	if (plainImports.length === 0)
		return { server: [], client: [], serverLocalNames: new Set() }

	const serverNames = serverUsageNames(component)
	const clientNames = computeClientNeededNames(component)

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
		const usedServer = imp.localNames.some(n => serverNames.has(n))
		const usedClient = imp.localNames.some(n => clientNames.has(n))
		if (usedServer) {
			server.push(imp.text)
			for (const n of imp.localNames) serverLocalNames.add(n)
		}
		if (usedClient) client.push(imp.text)
		if (!usedServer && !usedClient)
			ctx.diagnostics.push(
				diagnostic.unusedPlainImport(ctx.source, imp.start, imp.localNames),
			)
	}
	return { server, client, serverLocalNames }
}
