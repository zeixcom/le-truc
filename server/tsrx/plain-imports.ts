/**
 * Import-placement inference for plain (non-`.tsrx`) imports (LT-034, ADR
 * 0024 sub-design 14). `config.ts`'s `parseComposeImports` only recognizes
 * `ImportDeclaration`s resolving to sibling `.tsrx` files; every other
 * top-level import used to be silently dropped from generated output. This
 * module collects those plain imports and places each one into whichever
 * generated module(s) actually reference its bindings — inferred from usage,
 * the same free-identifier analysis the compiler already runs for setup
 * consts (`CLIENT_ONLY_PRIMITIVES`, the `clientSetup` gate) — no new
 * annotation syntax.
 */

import { posix } from 'node:path'
import type { TsrxNode } from '@tsrx/core'
import {
	asArray,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	text,
} from './ast-utils'
import type {
	AttributeIR,
	ComponentIR,
	ExtractContext,
	TemplateNode,
} from './compiler'
import { diagnostic } from './diagnostics'

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

/** Free identifiers minus JS/DOM globals — the names that could be imports. */
const dependenciesOf = (node: TsrxNode): Set<string> => {
	const free = freeIdentifiers(node)
	for (const global of JS_GLOBALS) free.delete(global)
	return free
}

/**
 * Every top-level `ImportDeclaration` whose specifier does NOT resolve to a
 * `.tsrx` compose target (`config.ts`'s `parseComposeImports` already claims
 * those). Side-effect-only imports (`import 'culori/css'`) have no bindings
 * to trace usage from. A relative specifier (`./`, `../`) is rewritten to
 * stay valid from the generated modules' flat output directory — it was
 * authored relative to the `.tsrx` source's own location, which is almost
 * never where the compiled module ends up.
 */
export const parsePlainImports = (
	ctx: ExtractContext,
	ast: TsrxNode,
	filename: string,
): PlainImportIR[] => {
	const result: PlainImportIR[] = []
	const dir = posix.dirname(filename)
	for (const stmt of asArray(ast.body)) {
		if (stmt.type !== 'ImportDeclaration') continue
		const specifierNode = stmt.source
		const specifier =
			isNode(specifierNode) &&
			specifierNode.type === 'Literal' &&
			typeof specifierNode.value === 'string'
				? specifierNode.value
				: null
		if (!specifier || specifier.endsWith('.tsrx')) continue
		const localNames: string[] = []
		for (const spec of asArray(stmt.specifiers)) {
			const local = identifierName(spec.local)
			if (local) localNames.push(local)
		}
		let importText = text(ctx.source, stmt)
		if (specifier.startsWith('.')) {
			const resolved = posix
				.normalize(posix.join(dir, specifier))
				.replace(/\.ts$/, '')
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

/** Every attribute anywhere in the template, paired with its owning kind. */
const walkAttrs = function* (node: TemplateNode): Generator<AttributeIR> {
	if (node.kind === 'element') {
		for (const attr of node.attrs) yield attr
		for (const child of node.children) yield* walkAttrs(child)
		return
	}
	if (node.kind === 'if') {
		for (const child of node.then) yield* walkAttrs(child)
		for (const child of node.alternate) yield* walkAttrs(child)
		return
	}
	if (node.kind === 'switch') {
		for (const arm of node.cases)
			for (const child of arm.children) yield* walkAttrs(child)
		return
	}
	if (node.kind === 'try') {
		for (const child of node.children) yield* walkAttrs(child)
		for (const child of node.catchChildren) yield* walkAttrs(child)
		for (const child of node.pendingChildren ?? []) yield* walkAttrs(child)
		return
	}
	if (node.kind === 'compose') {
		for (const child of node.children) yield* walkAttrs(child)
		return
	}
}

/** Every server-known-position expression node anywhere in the template. */
const walkServerExprs = function* (node: TemplateNode): Generator<TsrxNode> {
	if (node.kind === 'expr' && !node.lazy) yield node.expr
	if (node.kind === 'if') {
		yield node.test
		for (const child of node.then) yield* walkServerExprs(child)
		for (const child of node.alternate) yield* walkServerExprs(child)
		return
	}
	if (node.kind === 'switch') {
		yield node.discriminant
		for (const arm of node.cases)
			for (const child of arm.children) yield* walkServerExprs(child)
		return
	}
	if (node.kind === 'try') {
		for (const child of node.children) yield* walkServerExprs(child)
		for (const child of node.catchChildren) yield* walkServerExprs(child)
		for (const child of node.pendingChildren ?? [])
			yield* walkServerExprs(child)
		return
	}
	if (node.kind === 'compose') {
		for (const attr of node.attrs)
			if (attr.kind === 'arg' && attr.node) yield attr.node
		for (const child of node.children) yield* walkServerExprs(child)
		return
	}
	if (node.kind === 'element')
		for (const child of node.children) yield* walkServerExprs(child)
}

/** Every client-always expression node anywhere in the template. */
const walkClientExprs = function* (node: TemplateNode): Generator<TsrxNode> {
	if (node.kind === 'expr' && node.lazy) yield node.expr
	if (node.kind === 'client-stmt') yield node.node
	for (const attr of walkAttrs(node)) {
		if (attr.kind === 'reactive') yield attr.thunk
		else if (attr.kind === 'style-map' || attr.kind === 'class-map')
			yield attr.object
		else if (attr.kind === 'event') yield attr.handler
		else if (attr.kind === 'html' && attr.reactive) yield attr.node
	}
	if (node.kind === 'element')
		for (const child of node.children) yield* walkClientExprs(child)
	else if (node.kind === 'if') {
		for (const child of node.then) yield* walkClientExprs(child)
		for (const child of node.alternate) yield* walkClientExprs(child)
	} else if (node.kind === 'switch') {
		for (const arm of node.cases)
			for (const child of arm.children) yield* walkClientExprs(child)
	} else if (node.kind === 'try') {
		for (const child of node.children) yield* walkClientExprs(child)
		for (const child of node.catchChildren) yield* walkClientExprs(child)
		for (const child of node.pendingChildren ?? [])
			yield* walkClientExprs(child)
	} else if (node.kind === 'compose') {
		for (const child of node.children) yield* walkClientExprs(child)
	}
}

/**
 * Server-conditional reactive-family thunks (`reactive`/`style-map`/
 * `class-map`) — mirrors `emit-server.ts`'s own `dependenciesOf(...)
 * .isSubsetOf(component.serverKnown)` gate exactly, so a plain import used
 * only inside a thunk that DOES get server-rendered still lands server-side.
 */
const walkServerRenderedThunks = function* (
	node: TemplateNode,
	serverKnown: ReadonlySet<string>,
): Generator<TsrxNode> {
	for (const attr of walkAttrs(node)) {
		if (
			attr.kind === 'reactive' &&
			dependenciesOf(attr.thunk).isSubsetOf(serverKnown)
		)
			yield attr.thunk
		else if (
			(attr.kind === 'style-map' || attr.kind === 'class-map') &&
			dependenciesOf(attr.object).isSubsetOf(serverKnown)
		)
			yield attr.object
	}
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
	for (const exprNode of walkClientExprs(component.root))
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

	const serverNames = new Set<string>()

	// component.setup is emitted verbatim into the SERVER module
	// unconditionally (ADR 0024 sub-design 12).
	for (const stmt of component.setup)
		for (const n of dependenciesOf(stmt.node)) serverNames.add(n)
	for (const exprNode of walkServerExprs(component.root))
		for (const n of dependenciesOf(exprNode)) serverNames.add(n)
	for (const exprNode of walkServerRenderedThunks(
		component.root,
		component.serverKnown,
	))
		for (const n of dependenciesOf(exprNode)) serverNames.add(n)

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
