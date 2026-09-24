/**
 * The corpus compile (LT-267): the standalone orchestration `compileCorpus`,
 * deliberately NOT under `server/effects/`.
 *
 * Everything here runs without the reactive build system — no file signals,
 * no watchers, no effect bookkeeping — so a consumer (and the cross-runtime
 * portability check) can compile a corpus by importing this module alone.
 * The reactive half that watches the corpus and re-runs it stays behind in
 * `server/effects/compile.ts` as one thin wrapper. That split is the build
 * path's module-boundary form of the seam: importing `compileCorpus` must
 * not drag a repo-shaped watch pipeline with it.
 *
 * The two-pass compile, the severity policy and the artifact layout are
 * LT-255/LT-202 heritage, unchanged here. Since LT-283 (ADR 0039) a corpus
 * folder may carry a variant set — one authored source per surface, one
 * base name, one directory: every member compiles, the set's CSS must be
 * byte-identical (LTC051), and only the selected surface's artifacts are
 * written under the canonical names.
 *
 * Writes go through `writeFileSafe` (the runtime seam, LT-267) and the
 * configuration defaults to THIS repo's paths, so the docs build and the
 * runner scripts behave exactly as before.
 */

import { dirname, relative } from 'node:path'
import { formatCensus, translationCensus } from './compiler/census'
import {
	type CorpusConfig,
	emitPathsFor,
	resolveCorpusConfig,
	type VariantSurface,
	validateVariantOverrides,
} from './compiler/corpus-config'
import { diagnostic } from './compiler/diagnostics'
import type { EmitPaths } from './compiler/emit-paths'
import {
	type CompileDiagnostic,
	compileComponent,
} from './compiler/frontend/tsrx'
import { compileComponentTsx } from './compiler/frontend/tsx'
import { type RegistryEntry, registryJson } from './compiler/registry'
import type { SourceSpan } from './compiler/spans'
import { contaminateComposeReads } from './compiler/tier'
import { collectSiblingModules, REPO_ROOT } from './corpus-sources'
import { collectI18n, writeI18nModule, writeI18nReport } from './effects/i18n'
import type { FileInfo } from './file-signals'
import { getFilePath, writeFileSafe } from './io'
import { io } from './runtimes'

/**
 * One compiled component's generated-module span tables (LT-011, `check:corpus`;
 * server coverage added by LT-019 — composition is the first construct that
 * makes server modules import each other's real types).
 */
export type CompiledSpanInfo = {
	tag: string
	/** Authored source path, relative to the project root. */
	source: string
	/** Generated client module path on disk, absolute. */
	clientModulePath: string
	spans: SourceSpan[]
	/** Generated server module path on disk, absolute. */
	serverModulePath: string
	serverSpans: SourceSpan[]
}

/* === Exported Constants === */

/**
 * The configuration the in-repo pipeline runs under: the defaults, which ARE
 * this repo's paths. A consumer's own configuration is loaded from their
 * `le-truc.config.json` by `loadCorpusConfig` and handed to `compileCorpus`.
 */
export const REPO_CONFIG: CorpusConfig = resolveCorpusConfig(REPO_ROOT)

/**
 * Where the corpus compile writes its artifacts, including the registry the
 * tier census reads (`scripts/check-corpus.ts`). Exported for the scripts and
 * tests that address the same directory the pipeline defaults to.
 */
export const GENERATED_DIR = REPO_CONFIG.outDir

/**
 * Custom element tags of the hand-written example components, mapped to
 * their source paths (relative to the generated dir). Registry-aware
 * attribute dispatch needs the tags too: a reactive attribute on ANY example
 * custom element the docs pages load alongside (e.g. `basic-button` inside
 * module-list) lowers to `pass()`, exactly as for migrated .tsrx tags — and
 * the generated client imports the module for its `declare global` entry.
 *
 * LT-255 moved the glob and the back-to-the-root prefix into the
 * configuration (`collectSiblingModules`); this wrapper keeps the in-repo
 * name and behaviour.
 */
export const handwrittenExampleModules = (): Map<string, string> =>
	collectSiblingModules(REPO_CONFIG)

/* === Internal Functions === */

/**
 * The corpus covers BOTH authored surfaces (ADR 0032 sub-design 6, LT-202):
 * one registry, one generated directory, the front end chosen per file by
 * extension. A tag declared by two sources fails the compile naming both
 * files (LTC048, tier 1 Prevented) — unless the sources are a folder-local
 * variant set (ADR 0039, LT-283), which compiles every member and serves
 * the selected surface.
 */
const compileCorpusFile = (
	content: string,
	rel: string,
	registry: ReadonlySet<string>,
	emitPaths: EmitPaths,
	childImports?: ReadonlyMap<string, string>,
	composeRegistry?: ReadonlyMap<string, RegistryEntry>,
) =>
	rel.endsWith('.tsx')
		? compileComponentTsx(
				content,
				rel,
				registry,
				childImports,
				composeRegistry,
				emitPaths,
			)
		: compileComponent(
				content,
				rel,
				registry,
				childImports,
				composeRegistry,
				emitPaths,
			)

/** `basic-counter.tsrx`/`basic-counter.tsx` → `basic-counter`. */
const corpusTagOf = (filename: string): string =>
	(filename.split('/').pop() ?? '').replace(/\.(tsrx|tsx)$/, '')

/**
 * Re-anchor a generated client's relative specifiers one directory deeper,
 * for the unserved variant client written to `variants/` (LT-284): every
 * static `import`/`export … from` and dynamic `import()` whose specifier
 * starts with `./` or `../` climbs one more level — child imports
 * (`'./x.client'` → `'../x.client'`) and author imports already rewritten
 * with `outDirPrefix` (`'../../../lib/x'` → `'../../../../lib/x'`) alike.
 */
export const relocateClientSpecifiers = (code: string): string =>
	code.replace(
		/(\bimport\s*\(?\s*|\bfrom\s*)(['"])(\.\.?\/)/g,
		(_, lead: string, quote: string, dots: string) =>
			`${lead}${quote}${dots === './' ? '../' : '../../'}`,
	)

/** A `.tsx` path → `tsx`; a `.tsrx` path → `tsrx`. */
const surfaceOf = (rel: string): VariantSurface =>
	rel.endsWith('.tsx') ? 'tsx' : 'tsrx'

/**
 * A folder-local variant set (ADR 0039): every source in ONE directory, at
 * most one authored source per surface. The `.ts` twin never reaches the
 * scan (`DEFAULT_SIBLING_MODULES` glob) — it only seeds sibling-module tag
 * knowledge — so a set is the `.tsrx` and the `.tsx` spelling in practice;
 * the check stays generic over the compiled extensions.
 */
const isVariantSet = (sources: readonly string[]): boolean =>
	new Set(sources.map(dirname)).size === 1 &&
	new Set(sources.map(surfaceOf)).size === sources.length

/**
 * Delete every file under `variantsDir` not named in `keep` (LT-296). A
 * missing directory — no variant set has ever compiled here — is a no-op.
 */
const pruneVariantClients = async (
	variantsDir: string,
	keep: ReadonlySet<string>,
): Promise<void> => {
	let present: string[]
	try {
		present = io.scanGlob('**/*', { cwd: variantsDir })
	} catch {
		return
	}
	for (const file of present) {
		if (keep.has(file)) continue
		await io.removeFile(getFilePath(variantsDir, file))
		console.log(`🧹 Pruned stale variants/${file}`)
	}
}

/* === Exported Functions === */

/**
 * Compile the whole corpus (consumed by `scripts/build-corpus.ts`,
 * `scripts/check-corpus.ts`, `scripts/i18n-sync.ts` and the tests — the
 * build effect in `server/effects/compile.ts` wraps this same call).
 *
 * `target` is the CONFIGURATION the run compiles under — a consumer's, loaded
 * from their `le-truc.config.json` by `loadCorpusConfig`, or this repo's
 * defaults. Passing a bare path is the shorthand for "the repo's config, but
 * write here", which is what tests do so they never race the build (LT-140).
 * Since LT-255 that directory no longer has to sit at a particular depth: the
 * `../` prefix the emitted specifiers need is derived from it
 * (`emitPathsFor`).
 */
export const compileCorpus = async (
	files: FileInfo[],
	target: string | CorpusConfig = REPO_CONFIG,
): Promise<CompiledSpanInfo[]> => {
	const config: CorpusConfig =
		typeof target === 'string' ? { ...REPO_CONFIG, outDir: target } : target
	const { outDir, root } = config
	const emitPaths = emitPathsFor(config)

	// Registry-aware dispatch needs every compilable tag up front: first
	// pass collects tags (warnings already skip their files), second pass
	// compiles against the full registry. The same first pass also builds
	// the compose registry (ADR 0023 sub-design 10) — a composed element's
	// import specifier resolves to another file's own repo-relative path,
	// so every file's entry is keyed by that path for the second pass to
	// look up regardless of compile order (composition is not order-dependent
	// the way registry-tag `pass()` dispatch is).
	const childImports = collectSiblingModules(config)
	const registry = new Set<string>(childImports.keys())
	const compilable = new Map<string, string>()
	const compiledTags = new Set<string>()
	const composeRegistry = new Map<string, RegistryEntry>()
	// Pass 1 legality checks must not depend on visit order: a fully
	// migrated tag has no hand-written twin to seed `registry` with, so its
	// tag only enters the set when its OWN file is visited — a raw-tag
	// `pass={{ }}` target (module-list → basic-button) failed [LTC012] in
	// one glob order and passed in another, silently dropping the whole
	// file from pass 2 (CI regression 2026-08-30). Seed the discovery pass
	// with every corpus file's conventional tag instead; pass 2 still
	// validates against the authoritative registry built below, so a tag
	// whose file genuinely failed to compile never legitimizes a target.
	const discoveryRegistry = new Set<string>(registry)
	for (const file of files) {
		const base = corpusTagOf(file.filename)
		if (/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$/.test(base))
			discoveryRegistry.add(base)
	}
	// "Errors fail the build run" (see header): the runner throws AFTER the
	// artifacts are written, so build:cem fails at the compile step with the
	// real diagnostic instead of shipping a manifest missing the dropped
	// component. A file that errors in pass 1 and survives to pass 2 is
	// reported by its pass-2 verdict (last write wins per file).
	const errorLabels = new Map<string, string>()
	const report = (rel: string, diagnostics: CompileDiagnostic[]) => {
		for (const d of diagnostics) {
			const label = `[${d.code}] ${d.line ? `line ${d.line}: ` : ''}${d.message}`
			if (d.severity === 'error') {
				console.error(`❌ ${rel} — ${label}`)
				errorLabels.set(rel, label)
			} else console.warn(`⚠️ ${rel} — ${label}`)
		}
	}
	// Dual-surface duplicate detection (LTC048, narrowed by ADR 0039): a tag
	// two corpus files both declare is ambiguous at the registry level —
	// neither file can be compiled, because pass 2's registry would have
	// last-write-wins semantics for the generated module names, the tag map
	// augmentation, and every compose/pass resolution — UNLESS the sources
	// are a folder-local variant set, the legal multi-source shape: it
	// compiles every member below and serves the selected surface's
	// artifacts under the canonical names. Checked BEFORE pass 2, naming
	// every involved file (ADR 0032 sub-design 6; tier 1 Prevented —
	// statically decidable, no runtime half).
	const tagsBySource = new Map<string, string[]>()
	for (const file of files) {
		const rel = relative(root, file.path)
		const base = corpusTagOf(file.filename)
		if (!/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$/.test(base)) continue
		const decls = tagsBySource.get(base) ?? []
		decls.push(rel)
		tagsBySource.set(base, decls)
	}
	for (const [tag, sources] of tagsBySource) {
		if (sources.length < 2) continue
		if (isVariantSet(sources)) continue
		for (const rel of sources) {
			report(rel, [diagnostic.duplicateTag(tag, sources)])
			// Both files are dropped by never reaching pass 1: `report` put
			// them in `errorLabels`, which the pass-1 loop skips.
		}
	}
	// A `variantOverrides` entry naming no variant set is a configuration
	// error (LT-292): the sets are only known now, after the scan.
	validateVariantOverrides(config, tagsBySource)
	for (const file of files) {
		const rel = relative(root, file.path)
		if (errorLabels.has(rel)) continue
		// Pass 1 must see the hand-written tags too (`registry` starts seeded
		// from `childImports`, LT-020 fix): a raw-tag `pass={{ }}` target
		// (e.g. `basic-button`) is otherwise flagged "not registry-known" in
		// THIS pass even though it always was, silently dropping the whole
		// file before pass 2 ever gets a chance to compile it for real.
		const { component, diagnostics } = compileCorpusFile(
			file.content,
			rel,
			discoveryRegistry,
			emitPaths,
		)
		report(rel, diagnostics)
		if (component) {
			registry.add(component.entry.tag)
			compiledTags.add(component.entry.tag)
			compilable.set(rel, file.content)
			composeRegistry.set(rel, component.entry)
		}
	}
	// Runtime registration follows the SERVED surface (ADR 0039, LT-291): a
	// compiled tag's child import is always its generated client, whether or
	// not a hand-written `.ts` twin is still on disk. The twin is the
	// artifact of record and is never served — `examples/main.ts` imports
	// the generated client — so importing it would define the tag twice in
	// the bundle, or ship the unselected surface. Type visibility rides the
	// same import: every variant-set member declares its own
	// `HTMLElementTagNameMap` entry (ADR 0039 s4), so the served client
	// carries it for the parent's `first()`/`pass()` sites. Only a tag that
	// is not compiled at all keeps its hand-written module.
	for (const tag of compiledTags) childImports.set(tag, `./${tag}.client`)

	const entries: RegistryEntry[] = []
	const spanInfos: CompiledSpanInfo[] = []
	// Every variants/ client THIS run writes (LT-296): the directory is
	// owned by the compile, so anything else in it is pruned below.
	const variantClients = new Set<string>()
	// Group the compilable sources by tag — pass 1's visit order preserved —
	// so a variant set's members compile together (ADR 0039): every member
	// compiles clean or fails as today, the set's CSS must agree
	// byte-for-byte (LTC051), and only the SELECTED surface's artifacts are
	// written under the canonical names. Singleton tags — the whole corpus
	// today — take the same path as a one-member group.
	const membersByTag = new Map<string, { rel: string; content: string }[]>()
	for (const [rel, content] of compilable) {
		const tag = corpusTagOf(rel)
		const members = membersByTag.get(tag) ?? []
		members.push({ rel, content })
		membersByTag.set(tag, members)
	}
	for (const [tag, members] of membersByTag) {
		const results = members.map(({ rel, content }) => {
			const { component, diagnostics } = compileCorpusFile(
				content,
				rel,
				registry,
				emitPaths,
				childImports,
				composeRegistry,
			)
			report(rel, diagnostics)
			return { rel, component }
		})
		// CSS byte-identity across a set's compiled members (ADR 0039): the
		// served stylesheet is written for the WHOLE set, so a drift would
		// leave the unserved member's rendering unstyled. Skipped when a
		// member failed — its own error already fails the build run.
		if (results.length > 1) {
			const compiled = results.filter(r => r.component)
			const head = compiled[0]
			if (head?.component && compiled.length > 1) {
				const headCss = head.component.css
				const drifted = compiled.filter(
					r => r.component && r.component.css !== headCss,
				)
				if (drifted.length > 0) {
					const sources = [head.rel, ...drifted.map(r => r.rel)]
					for (const rel of sources)
						report(rel, [diagnostic.variantCssDrift(tag, sources)])
					// The set serves nothing — LTC048's all-dropped semantics.
					continue
				}
			}
		}
		// Serve the selected surface's artifacts under the canonical names
		// (ADR 0039): `.tsx` by default, overridden per tag by
		// `variantOverrides` and corpus-wide by `variantSurface`. Selection
		// applies WITHIN a set — a single-source tag is its own served
		// surface, whatever it is authored in. A member whose surface is
		// not selected still compiles (its CSS parity is asserted above)
		// but writes nothing — the registry write, the compose-contamination
		// fixpoint, the span tables, the i18n collection and the census all
		// see one entry per tag, and that entry's `source` names the
		// selected member.
		const want = config.variantOverrides[tag] ?? config.variantSurface
		const servedRel =
			results.length === 1
				? results[0]?.rel
				: results.find(r => r.component && surfaceOf(r.rel) === want)?.rel
		for (const { rel, component } of results) {
			if (!component) continue
			if (rel !== servedRel) {
				// The non-selected member's CLIENT is still written (LT-284,
				// ADR 0039 decision 2): the component test route serves it for
				// the per-surface spec matrix, under a per-surface name in
				// variants/ so no canonical consumer can mistake it — the CEM
				// globs are flat, the registry stays one entry per tag, and
				// server/CSS artifacts of the unserved member are not needed.
				// Emitted child imports are relative to the canonical
				// directory (`import './form-listbox.client'`), so they climb
				// one level out of variants/.
				const clientCode = relocateClientSpecifiers(component.clientCode)
				const variantFile = `${component.entry.tag}.${surfaceOf(rel)}.client.ts`
				await writeFileSafe(
					getFilePath(outDir, 'variants', variantFile),
					clientCode,
				)
				variantClients.add(variantFile)
				console.log(
					`· Compiled ${component.entry.tag} from ${rel} — variant set member, not served` +
						(servedRel
							? ` (client kept at variants/${component.entry.tag}.${surfaceOf(rel)}.client.ts)`
							: ` (selected surface "${want}" did not compile)`),
				)
				continue
			}
			const { entry } = component
			const clientModulePath = getFilePath(outDir, entry.clientModule)
			const serverModulePath = getFilePath(outDir, entry.serverModule)
			await writeFileSafe(serverModulePath, component.serverCode)
			await writeFileSafe(clientModulePath, component.clientCode)
			await writeFileSafe(getFilePath(outDir, entry.css), component.css)
			entries.push(entry)
			spanInfos.push({
				tag: entry.tag,
				source: rel,
				clientModulePath,
				spans: component.clientSpans,
				serverModulePath,
				serverSpans: component.serverSpans,
			})
			console.log(`✅ Compiled ${entry.tag} from ${rel}`)
		}
	}

	// Prune variants/ of every client this run did not write (LT-296): a
	// dissolved set (a member deleted), a flipped `variantOverrides`, a set
	// dropped by LTC051, or a member that stopped compiling would otherwise
	// leave a stale client the component test route's `?surface=` serves
	// with 200 instead of 404.
	await pruneVariantClients(getFilePath(outDir, 'variants'), variantClients)

	// ADR 0029 sub-design 3, LT-165: compose contamination is a FIXPOINT over
	// the whole corpus's compose-read graph, so it can only run here — the
	// first point where every component's own first-pass tier is known. A
	// component's tier can only move downward (towards the Simulated tier).
	const contaminated = contaminateComposeReads(
		new Map(
			entries.map(entry => [
				entry.tag,
				{ tag: entry.tag, tier: entry.tier, signals: entry.routingSignals },
			]),
		),
		tag => entries.find(entry => entry.tag === tag)?.composeReadTags ?? [],
	)
	for (const entry of entries) {
		const classification = contaminated.get(entry.tag)
		if (!classification) continue
		entry.tier = classification.tier
		entry.routingSignals = [...classification.signals]
	}

	await writeFileSafe(
		getFilePath(outDir, 'registry.json'),
		registryJson(entries),
	)
	// ADR 0030 sub-designs 4+5 (LT-173): the catalog pipeline's corpus half.
	// The generated i18n module folds every component's inline sources and
	// the committed per-locale overrides into `i18nRecord(tag, lang?)`; the
	// report artifact is gitignored; the census count rides the build
	// summary. The build writes NO tracked file — missing keys land in the
	// census, and `i18n:sync` is the person-run writer for the catalogs.
	const i18nCollection = await collectI18n(entries, undefined, config.i18nDir)
	await writeI18nModule(outDir, i18nCollection)
	await writeI18nReport(outDir, i18nCollection)
	const i18nCensus = translationCensus(
		i18nCollection.gaps,
		i18nCollection.locales,
	)
	console.log(
		`🌐 Translation census: ${i18nCensus.entries.length} gap(s) across ${i18nCollection.locales.length} locale(s)`,
	)
	if (i18nCensus.entries.length > 0) console.log(formatCensus(i18nCensus))
	console.log(
		`📝 Corpus compilation completed (${entries.length} component(s))`,
	)
	if (errorLabels.size > 0) {
		throw new Error(
			`Corpus compilation failed — ${errorLabels.size} file(s) with error-severity diagnostics (dropped from the generated output):\n` +
				[...errorLabels]
					.map(([rel, label]) => `  • ${rel} — ${label}`)
					.join('\n'),
		)
	}
	return spanInfos
}
