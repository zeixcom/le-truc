/**
 * The corpus compile — the compiler package's ONE entry point (D-32, owner
 * ruling 2026-10-06; moved from `server/corpus-compile.ts` at LT-480).
 *
 * `compileCorpus(config)` is what an installing project calls: it scans the
 * configured sources, runs both corpus passes, writes every artifact — the
 * generated modules and stylesheets, `registry.json` (the public
 * projection), `registry.internal.json` (the compile's own record),
 * `tsrx-imports.d.ts` and the `i18n` module — to `config.outDir`, and
 * returns the diagnostics and a summary. The artifacts are files, not
 * return values; compile errors are RETURNED, never thrown — a caller that
 * fails its build on them says so itself (this repo's thin wrapper in
 * `server/corpus-compile.ts` does). Configuration errors still throw
 * (LT-273): they happen before any component is parsed.
 *
 * The two-pass compile, the severity policy and the artifact layout are
 * LT-255/LT-202 heritage, unchanged by the move. Since LT-283 (ADR 0039) a
 * corpus folder may carry a variant set — one authored source per surface,
 * one base name, one directory: every member compiles, the set's CSS must
 * be byte-identical (LTC051), and only the selected surface's artifacts are
 * written under the canonical names.
 *
 * Everything here runs without the repo's reactive build system — no file
 * signals, no watchers, no effect bookkeeping — over the package's own
 * file-system seam (`fs.ts`) only: importing `compileCorpus` must not drag
 * a repo-shaped watch pipeline with it. The docs build's reactive wrapper
 * stays behind in `server/effects/compile.ts`, and the in-repo shorthand
 * callers live in `server/corpus-compile.ts`.
 *
 * The per-file front ends stay internal (`compileComponentTsx` left the
 * public contract with this move): a component's artifacts depend on other
 * components — compose legality, tier contamination over the compose graph,
 * variant sets — so a per-file entry point would hand every consumer that
 * orchestration to rebuild, and one that skips the contamination fixpoint
 * ships wrong tiers without an error. `compileCorpusFiles` is the internal
 * files-accepting form the repo's wrapper and the tests drive (a test
 * compiles in-memory file lists so it never races the build, LT-140).
 */

import { dirname, join, relative } from 'node:path'
import { formatCensus, translationCensus } from './census'
import {
	type CorpusConfig,
	emitPathsFor,
	type VariantSurface,
	validateVariantOverrides,
} from './corpus-config'
import {
	type CorpusFile,
	collectCorpusSources,
	collectSiblingModules,
} from './corpus-scan'
import type { CompileDiagnostic } from './diagnostics'
import { diagnostic, lineOf, wholeFile } from './diagnostics'
import type { EmitPaths } from './emit-paths'
import { compileComponent } from './frontend/tsrx'
import { compileComponentTsx } from './frontend/tsx'
import { removeFile, scanGlobSync, writeTextFile } from './fs'
import { collectI18n, writeI18nModule, writeI18nReport } from './i18n-catalog'
import type { InternalRegistryEntry } from './registry'
import { internalRegistryJson, registryJson } from './registry'
import type { SourceSpan } from './spans'
import type { EvaluationTier } from './tier'
import { contaminateComposeReads } from './tier'
import {
	TSRX_IMPORTS_FILE,
	type TsrxImportSource,
	type TsrxTagMapEntry,
	tsrxImportTypings,
} from './tsrx-imports'

/* === Types === */

/**
 * One compiled component's generated-module span tables (LT-011,
 * `check:corpus`; server coverage added by LT-019 — composition is the
 * first construct that makes server modules import each other's real
 * types). Internal: `check:corpus` remaps tsc diagnostics through it.
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
	/** Emitted stylesheet path on disk, absolute. */
	cssPath: string
	/**
	 * The stylesheet as authored, before scoping and lowering — what the
	 * baseline guard (LT-305) subtracts to see what the compiler added.
	 */
	authoredCss: string
}

/** What the corpus run counted, by the channel that prints it. */
export type CorpusSummary = {
	/** Served components the run wrote artifacts for. */
	components: number
	/** Diagnostics by severity: errors refused their files; warnings did not. */
	errors: number
	warnings: number
	/**
	 * Post-contamination tier census, one count per tier including zeroes —
	 * a component drifting Folded → Simulated is a build-cost regression,
	 * and the census is where it shows (ADR 0029 s6).
	 */
	tiers: Record<EvaluationTier, number>
	/** Locales the translation census walked (zero for an untranslated corpus). */
	locales: number
	/** Translation gaps the census recorded (missing, stale, orphaned, …). */
	translationGaps: number
}

/** The published half of a corpus run: what `compileCorpus` returns. */
export type CorpusResult = {
	/** Every diagnostic both passes reported, warnings and errors alike. */
	diagnostics: readonly CompileDiagnostic[]
	summary: CorpusSummary
}

/**
 * The compile's own view of a run: the published half plus the internal
 * records the repo's passes read — the full registry entries and the span
 * tables. Never published (D-32); the artifacts carry them instead.
 */
export type InternalCorpusResult = CorpusResult & {
	/** Post-contamination entries, one per served tag — the `registry.internal.json` record. */
	entries: readonly InternalRegistryEntry[]
	/** Error labels, preformatted for the runner that fails its build on them. */
	errors: ReadonlyArray<{ file: string; label: string }>
	spanInfos: readonly CompiledSpanInfo[]
}

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
	composeRegistry?: ReadonlyMap<string, InternalRegistryEntry>,
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
		present = scanGlobSync('**/*', variantsDir)
	} catch {
		return
	}
	for (const file of present) {
		if (keep.has(file)) continue
		await removeFile(join(variantsDir, file))
		console.log(`🧹 Pruned stale variants/${file}`)
	}
}

/* === Exported Functions === */

/**
 * The corpus pass over caller-supplied files — the internal form the repo's
 * shorthand wrapper (`server/corpus-compile.ts`), the docs build's effect
 * and the tests drive when the file list is already in hand (watch signals,
 * in-memory fixtures). See {@link compileCorpus} for the published form.
 */
export const compileCorpusFiles = async (
	files: readonly CorpusFile[],
	config: CorpusConfig,
): Promise<InternalCorpusResult> => {
	const { outDir, root } = config
	const emitPaths = emitPathsFor(config)

	// Registry-aware dispatch needs every compilable tag up front: first
	// pass collects tags (warnings already skip their files), second pass
	// compiles against the full registry. The same first pass also builds
	// the compose registry (ADR 0024 sub-design 10) — a composed element's
	// import specifier resolves to another file's own repo-relative path,
	// so every file's entry is keyed by that path for the second pass to
	// look up regardless of compile order (composition is not order-dependent
	// the way registry-tag `pass()` dispatch is).
	const childImports = collectSiblingModules(config)
	const registry = new Set<string>(childImports.keys())
	const compilable = new Map<string, string>()
	const compiledTags = new Set<string>()
	const composeRegistry = new Map<string, InternalRegistryEntry>()
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
	// Errors are RETURNED (see header): the caller decides whether they
	// fail its build. A file that errors in pass 1 and survives to pass 2
	// is reported by its pass-2 verdict (last write wins per file).
	const diagnostics: CompileDiagnostic[] = []
	const errorLabels = new Map<string, string>()
	// Authored text by project-relative path: the terminal view prints a
	// location's start as a line, and corpus-level rules locate whole files
	// (ADR 0044 s1–s2).
	const contentOf = new Map(
		files.map(file => [relative(root, file.path), file.content]),
	)
	const locationOf = (rel: string) => wholeFile(rel, contentOf.get(rel) ?? '')
	const lineLabel = (d: CompileDiagnostic): string => {
		const content = contentOf.get(d.location.file)
		if (
			content === undefined ||
			(d.location.start === 0 && d.location.end === content.length)
		)
			return ''
		const line = lineOf(content, d.location.start)
		return line === undefined ? '' : `line ${line}: `
	}
	const report = (rel: string, fileDiagnostics: CompileDiagnostic[]) => {
		for (const d of fileDiagnostics) {
			const label = `[${d.code}] ${lineLabel(d)}${d.message}`
			if (d.severity === 'error') {
				console.error(`❌ ${rel} — ${label}`)
				errorLabels.set(rel, label)
			} else console.warn(`⚠️ ${rel} — ${label}`)
			diagnostics.push(d)
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
			report(rel, [
				diagnostic.duplicateTag(
					tag,
					sources,
					locationOf(rel),
					sources.filter(other => other !== rel).map(locationOf),
				),
			])
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
		const { component, diagnostics: fileDiagnostics } = compileCorpusFile(
			file.content,
			rel,
			discoveryRegistry,
			emitPaths,
		)
		report(rel, fileDiagnostics)
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

	const entries: InternalRegistryEntry[] = []
	const spanInfos: CompiledSpanInfo[] = []
	// Every variants/ client THIS run writes (LT-296): the directory is
	// owned by the compile, so anything else in it is pruned below.
	const variantClients = new Set<string>()
	// Every compiled `.tsrx` source, by tag (LT-312): `tsrx-imports.d.ts`
	// types each through its tag's SERVED server module, so a variant set's
	// unserved `.tsrx` member is listed too — one contract per tag.
	const tsrxSources = new Map<string, string[]>()
	// Served tags whose host is form-associated (LT-325): the tag-map entry's
	// host type, which the registry does not record.
	const formAssociatedTags = new Set<string>()
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
			const { component, diagnostics: fileDiagnostics } = compileCorpusFile(
				content,
				rel,
				registry,
				emitPaths,
				childImports,
				composeRegistry,
			)
			report(rel, fileDiagnostics)
			if (component && rel.endsWith('.tsrx'))
				tsrxSources.set(tag, [...(tsrxSources.get(tag) ?? []), rel])
			return { rel, component }
		})
		// CSS parity across a set's compiled members (ADR 0039, ADR 0033
		// s10): the AUTHORED sheets must be byte-identical. The emission adds
		// nothing of its own to a sheet (no derived boundaries), so identical
		// sheets emit identical CSS. Skipped when a member failed — its own
		// error already fails the build run.
		if (results.length > 1) {
			const compiled = results.filter(r => r.component)
			const head = compiled[0]
			if (head?.component && compiled.length > 1) {
				const headCss = head.component.authoredCss
				const drifted = compiled.filter(
					r => r.component && r.component.authoredCss !== headCss,
				)
				if (drifted.length > 0) {
					const sources = [head.rel, ...drifted.map(r => r.rel)]
					for (const rel of sources)
						report(rel, [
							diagnostic.variantCssDrift(
								tag,
								sources,
								locationOf(rel),
								sources.filter(other => other !== rel).map(locationOf),
							),
						])
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
				await writeTextFile(join(outDir, 'variants', variantFile), clientCode)
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
			const clientModulePath = join(outDir, entry.clientModule)
			const serverModulePath = join(outDir, entry.serverModule)
			await writeTextFile(serverModulePath, component.serverCode)
			await writeTextFile(clientModulePath, component.clientCode)
			const cssPath = join(outDir, entry.css)
			await writeTextFile(cssPath, component.css)
			entries.push(entry)
			if (component.formAssociated) formAssociatedTags.add(entry.tag)
			spanInfos.push({
				tag: entry.tag,
				source: rel,
				clientModulePath,
				spans: component.clientSpans,
				serverModulePath,
				serverSpans: component.serverSpans,
				cssPath,
				authoredCss: component.authoredCss,
			})
			console.log(`✅ Compiled ${entry.tag} from ${rel}`)
		}
	}

	// Prune variants/ of every client this run did not write (LT-296): a
	// dissolved set (a member deleted), a flipped `variantOverrides`, a set
	// dropped by LTC051, or a member that stopped compiling would otherwise
	// leave a stale client the component test route's `?surface=` serves
	// with 200 instead of 404.
	await pruneVariantClients(join(outDir, 'variants'), variantClients)

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

	// The registry pair (D-32): `registry.json` is the published schema —
	// the public projection only; `registry.internal.json` is the compile's
	// own record, read by the repo's build passes and the census scripts.
	await writeTextFile(join(outDir, 'registry.json'), registryJson(entries))
	await writeTextFile(
		join(outDir, 'registry.internal.json'),
		internalRegistryJson(entries),
	)
	// Only a tag whose served artifacts were written has a server module to
	// type through; a set dropped by LTC051 lists nothing.
	const typings: TsrxImportSource[] = entries.flatMap(entry =>
		(tsrxSources.get(entry.tag) ?? []).map(source => ({
			source,
			name: entry.name,
			serverModule: entry.serverModule,
			passProps: Object.entries(entry.exposedProps)
				.filter(([, kind]) => kind === 'slot')
				.map(([prop]) => prop),
		})),
	)
	// Tag-map entries only for a tag SERVED from `.tsrx` (LT-325): a served
	// `.tsx` source is visible to tsc and carries its own entry.
	const tagMap: TsrxTagMapEntry[] = entries
		.filter(entry => entry.source.endsWith('.tsrx'))
		.map(entry => ({
			tag: entry.tag,
			clientModule: entry.clientModule,
			propsType: entry.propsType,
			formAssociated: formAssociatedTags.has(entry.tag),
		}))
	await writeTextFile(
		join(outDir, TSRX_IMPORTS_FILE),
		tsrxImportTypings(typings, tagMap),
	)
	// ADR 0030 sub-designs 4+5 (LT-173): the catalog pipeline's corpus half.
	// The generated i18n module folds every component's inline sources and
	// the committed per-locale overrides into `i18nRecord(tag, lang?)`; the
	// report artifact is gitignored; the census count rides the summary.
	// The build writes NO tracked file — missing keys land in the census,
	// and `i18n:sync` is the person-run writer for the catalogs.
	const i18nCollection = await collectI18n(entries, undefined, config.i18nDir)
	await writeI18nModule(
		outDir,
		i18nCollection,
		config.runtimeImport,
		config.locales,
	)
	await writeI18nReport(outDir, i18nCollection, config.locales)
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
	const tiers: Record<EvaluationTier, number> = {
		folded: 0,
		simulated: 0,
		static: 0,
	}
	for (const entry of entries) tiers[entry.tier]++
	return {
		diagnostics,
		summary: {
			components: entries.length,
			errors: diagnostics.filter(d => d.severity === 'error').length,
			warnings: diagnostics.filter(d => d.severity === 'warning').length,
			tiers,
			locales: i18nCollection.locales.length,
			translationGaps: i18nCollection.gaps.length,
		},
		entries,
		errors: [...errorLabels].map(([file, label]) => ({ file, label })),
		spanInfos,
	}
}

/**
 * The published corpus entry point (D-32): scan the configured sources,
 * compile the corpus, write every artifact to `config.outDir`, and return
 * the diagnostics and the summary. A corpus the configured globs cannot
 * see is a thrown configuration error — "it compiled, but nothing is where
 * I asked" is the worst first-install failure (LT-273's rule) and zero
 * sources is its exact shape.
 */
export const compileCorpus = async (
	config: CorpusConfig,
): Promise<CorpusResult> => {
	const files = await collectCorpusSources(config)
	if (files.length === 0)
		throw new Error(
			`No component sources matched ${config.sources.join(', ')} under ${config.root}`,
		)
	const { diagnostics, summary } = await compileCorpusFiles(files, config)
	return { diagnostics, summary }
}
