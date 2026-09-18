/**
 * The document-level page renderer (LT-194, ADR 0030 sub-design 3's
 * page-position walk rung).
 *
 * The build never server-rendered component occurrences INTO pages: demo
 * previews and authored markup rode into the served bytes verbatim and the
 * client upgraded them. That left the ambient-`lang` walk a client-only
 * mechanism — `<section lang="cy">` wrapping arbitrary occurrences resolved
 * per occurrence at connect, so the SERVED bytes could never answer "what
 * locale does this occurrence render in" (no `Intl` fold, no `truc:case`
 * pruning, no catalog words, no materialized root `lang` for a positional
 * occurrence).
 *
 * This pass runs over assembled page HTML and replaces an occurrence with
 * the component's own server render when ALL of these hold:
 *
 * - the component is **Folded-tier and declares the reserved `i18n`
 *   parameter** — its server bytes actually depend on the locale (folded
 *   catalog words, `truc:case` pruning, the materialized root `lang`).
 *   Simulated-tier occurrences stay authored: the simulation realm cannot
 *   run per watch rebuild (ADR 0027 sub-design 10). A `lang`-arg component
 *   WITHOUT `i18n` (basic-number) computes its locale-dependent value
 *   client-side, so rendering it would only empty authored text.
 * - the generated module exports `argsFromAttrs` (emit-server.ts emits it
 *   exactly when the component is statically renderable from attributes).
 * - the occurrence's effective locale resolves at BUILD time: the own
 *   `lang` attribute, else the nearest positional `[lang]` ancestor, else
 *   the page tree's locale. In the single-copy fragment trees (examples/)
 *   there is no page locale, so a baseless occurrence stays authored — the
 *   ADR's "the walk serves client-authored markup" clause, unchanged.
 *
 * Locale stays a build-time constant per rendered occurrence: the page
 * locale is fixed by the per-locale page loop (LT-174) before this pass,
 * and the positional resolution is plain tree structure, so the `Intl`
 * fold, the pruning and the root-attribute render all hold per render call.
 * No render cache (LT-193 posture) — the counts are page occurrences of
 * five components, not the corpus.
 *
 * Byte discipline: parse5 reads source offsets and the pass splices the
 * ORIGINAL string right-to-left, so every byte outside a replaced
 * occurrence — including the authored markup of every non-qualifying
 * component — survives verbatim.
 */

import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type DefaultTreeAdapterMap, parseFragment } from 'parse5'
import { composeHostAttrs } from '../compiler/compose-attrs'
import type { ComponentRegistry, RegistryEntry } from '../compiler/registry'
import { GENERATED_DIR } from './tsrx'

/* === Types === */

type P5Node = DefaultTreeAdapterMap['node']
type P5Element = DefaultTreeAdapterMap['element']

/** One generated `.server.ts` module, as the renderer consumes it. */
export type PageRenderModule = {
	argsFromAttrs?: (
		attrs: Record<string, string | null>,
	) => Record<string, unknown> | null
	render?: (args: Record<string, unknown>) => string
	[name: string]: unknown
}

export type RenderedOccurrence = {
	tag: string
	/** The locale the occurrence rendered at. */
	locale: string
}

export type SkippedOccurrence = {
	tag: string
	reason: 'no-module-export' | 'no-resolvable-locale' | 'unrenderable-args'
}

export type PageOccurrencesResult = {
	html: string
	/** Occurrences replaced by server renders, in source order. */
	rendered: RenderedOccurrence[]
	/** Qualifying occurrences left authored, with the reason. */
	skipped: SkippedOccurrence[]
}

export type RenderPageOccurrencesOptions = {
	/** Defaults to the registry the pipeline wrote (`generatedDir/registry.json`). */
	registry?: ComponentRegistry
	/** Defaults to `server/generated/tsrx/`. */
	generatedDir?: string
	/**
	 * The page tree's locale. `null`/`undefined` for the single-copy fragment
	 * trees, where a baseless occurrence has no locale to resolve to and
	 * therefore stays authored.
	 */
	pageLocale?: string | null
	/** Seam for tests: resolves the generated server module for one tag. */
	resolveModule?: (tag: string) => Promise<PageRenderModule | null>
}

/* === Internal Functions === */

const isElement = (node: P5Node): node is P5Element =>
	!node.nodeName.startsWith('#')

const childNodesOf = (node: P5Node): P5Node[] => {
	if (node.nodeName === 'template') {
		const content = (node as DefaultTreeAdapterMap['template']).content
		return content ? content.childNodes : []
	}
	return (node as { childNodes?: P5Node[] }).childNodes ?? []
}

const attrValue = (el: P5Element, name: string): string | null =>
	el.attrs.find(a => a.name === name)?.value ?? null

/**
 * The occurrence's effective locale by ADR 0030 sub-design 3's precedence:
 * the own `lang` attribute, else the nearest positional `[lang]` ancestor.
 * Null when neither exists — the page-locale rung is the caller's
 * `pageLocale`, deliberately not consulted here (the single-copy trees pass
 * none, and a `null` result is what leaves the occurrence authored).
 */
const resolveOccurrenceLocale = (el: P5Element): string | null => {
	const own = attrValue(el, 'lang')
	if (own) return own
	let current: P5Node | null = el.parentNode ?? null
	while (current) {
		if (isElement(current)) {
			const inherited = attrValue(current, 'lang')
			if (inherited) return inherited
		}
		current = (current as { parentNode?: P5Node | null }).parentNode ?? null
	}
	return null
}

/** Registry entries the walk's jurisdiction covers, keyed by tag. */
const qualifyingEntries = (
	registry: ComponentRegistry,
): Map<string, RegistryEntry> => {
	const entries = new Map<string, RegistryEntry>()
	for (const entry of Object.values(registry) as RegistryEntry[]) {
		// Only components whose SERVER bytes the locale determines — the
		// reserved-record declarers (folded catalog words, `truc:case`
		// pruning, the materialized root `lang`). A `lang`-arg component
		// without `i18n` (basic-number) computes its locale-dependent value
		// CLIENT-side, so a server render would only EMPTY its authored
		// text; and Simulated-tier occurrences stay authored regardless —
		// the realm cannot run per watch rebuild (ADR 0027 sub-design 10).
		if (entry.tier !== 'folded') continue
		if (entry.declaresI18n) entries.set(entry.tag, entry)
	}
	return entries
}

/**
 * Generated-module loader with mtime cache-busting: a watch rebuild
 * rewrites the generated files in place, and a bare `import()` of the same
 * path would serve the process's first copy forever. Keying the cache by
 * the file's current mtime makes each rebuild a fresh module. The generated
 * `i18n` module rides the same mechanism when loaded directly, though a
 * server module's *own* `./i18n` import stays cached per process — a
 * catalog-only change may need a dev-server restart to be seen.
 */
const moduleCache = new Map<string, Promise<unknown>>()

const loadGeneratedModule = async (
	generatedDir: string,
	file: string,
): Promise<unknown> => {
	const path = join(generatedDir, file)
	let mtime: number
	try {
		mtime = (await stat(path)).mtimeMs
	} catch {
		throw new Error(
			`page-render: generated module ${file} not found — the TSRX compile must run before the page renderer (build.ts orders this).`,
		)
	}
	const cacheKey = `${path}?mtime=${mtime}`
	let pending = moduleCache.get(cacheKey)
	if (!pending) {
		pending = import(`${pathToFileURL(path).href}?mtime=${mtime}`)
		moduleCache.set(cacheKey, pending)
	}
	return pending
}

/* === Exported Functions === */

/**
 * Replace every qualifying component occurrence in `html` with its server
 * render at the occurrence's resolved locale. Everything else — including
 * the bytes around and inside non-qualifying elements — survives verbatim.
 */
export const renderPageOccurrences = async (
	html: string,
	{
		registry,
		generatedDir = GENERATED_DIR,
		pageLocale = null,
		resolveModule,
	}: RenderPageOccurrencesOptions = {},
): Promise<PageOccurrencesResult> => {
	const entries: ComponentRegistry =
		registry ??
		((await Bun.file(
			join(generatedDir, 'registry.json'),
		).json()) as ComponentRegistry)
	const qualified = qualifyingEntries(entries)
	if (qualified.size === 0) return { html, rendered: [], skipped: [] }

	let i18nRecord:
		| ((tag: string, lang?: string) => Record<string, unknown>)
		| null = null
	const getI18nRecord = async () => {
		if (i18nRecord === null) {
			const mod = (await (resolveModule
				? resolveModule('i18n')
				: loadGeneratedModule(generatedDir, 'i18n.ts'))) as {
				i18nRecord?: (tag: string, lang?: string) => Record<string, unknown>
			}
			if (typeof mod.i18nRecord !== 'function')
				throw new Error(
					"page-render: the generated i18n module does not export i18nRecord — ADR 0030 sub-design 2 is the renderer's record supplier.",
				)
			i18nRecord = mod.i18nRecord
		}
		return i18nRecord
	}

	const loadModule = async (tag: string): Promise<PageRenderModule | null> =>
		resolveModule
			? resolveModule(tag)
			: ((await loadGeneratedModule(
					generatedDir,
					`${tag}.server.ts`,
				)) as PageRenderModule)

	const rendered: RenderedOccurrence[] = []
	const skipped: SkippedOccurrence[] = []
	const replacements: { start: number; end: number; html: string }[] = []

	const renderOccurrence = async (
		el: P5Element,
		entry: RegistryEntry,
	): Promise<void> => {
		const tag = entry.tag
		const location = el.sourceCodeLocation
		if (!location) return
		const mod = await loadModule(tag)
		const argsFromAttrs = mod?.argsFromAttrs
		const renderFn = mod?.[`render${entry.name}`]
		if (typeof argsFromAttrs !== 'function' || typeof renderFn !== 'function') {
			skipped.push({ tag, reason: 'no-module-export' })
			return
		}
		const ownLang = attrValue(el, 'lang')
		const positionalLang = ownLang ? null : resolveOccurrenceLocale(el)
		const locale = ownLang ?? positionalLang ?? pageLocale
		if (!locale) {
			skipped.push({ tag, reason: 'no-resolvable-locale' })
			return
		}
		const attrs: Record<string, string | null> = {}
		for (const a of el.attrs) attrs[a.name] = a.value
		// LT-090 alignment: `class`/`id` address the HOST element — they
		// splice onto the rendered root below and never ride the forwarded
		// args, exactly what a compose site does (it filters them from the
		// child's forwarded args for the same reason). A component whose
		// `id = name` default derives internal wiring keeps deriving it from
		// `name`, compose render and page render alike.
		const argAttrs = { ...attrs }
		delete argAttrs['class']
		delete argAttrs['id']
		const args = argsFromAttrs(argAttrs)
		if (args === null) {
			skipped.push({ tag, reason: 'unrenderable-args' })
			return
		}
		if (entry.langArgDefault !== null) args['lang'] = locale
		if (entry.declaresI18n)
			args['i18n'] = { ...(await getI18nRecord())(tag, locale) }
		let output = (renderFn as (a: Record<string, unknown>) => string)(args)
		// Page-occurrence `class`/`id` address the host element exactly like
		// LT-090 compose-site discriminators do — spliced onto the rendered
		// root so the client's selectors keep working.
		const hostAttrs: Record<string, string | null> = {}
		if (attrs['class'] != null) hostAttrs['class'] = attrs['class']
		if (attrs['id'] != null) hostAttrs['id'] = attrs['id']
		if (Object.keys(hostAttrs).length > 0)
			output = composeHostAttrs(output, tag, hostAttrs)
		replacements.push({
			start: location.startOffset,
			end: location.endOffset,
			html: output,
		})
		rendered.push({ tag, locale })
	}

	const walk = async (node: P5Node): Promise<void> => {
		for (const child of childNodesOf(node)) {
			if (!isElement(child)) continue
			const entry = qualified.get(child.tagName)
			// An occurrence replaces its subtree — a qualifying descendant of a
			// qualifying ancestor is part of the ancestor's rendered output.
			if (entry) await renderOccurrence(child, entry)
			else await walk(child)
		}
	}
	await walk(parseFragment(html, { sourceCodeLocationInfo: true }))

	let result = html
	for (let i = replacements.length - 1; i >= 0; i--) {
		const { start, end, html: replacement } = replacements[i]!
		result = result.slice(0, start) + replacement + result.slice(end)
	}
	return { html: result, rendered, skipped }
}
