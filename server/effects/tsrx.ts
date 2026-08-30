/**
 * TSRX compiler build effect (ADR 0023 milestone 1, LT-001).
 *
 * Watches every `.tsrx` source under `examples/`, compiles each through the inlined
 * compiler, and writes the generated artifacts (server render module,
 * generated client module, verbatim tag-scoped CSS) plus the component
 * registry into the gitignored `server/generated/tsrx/` directory. Nothing
 * consumes the artifacts yet — the docs/examples migration is the follow-on
 * once ADR 0023 is accepted — so this effect's job today is keeping the
 * compiler exercised against the corpus on every docs build.
 *
 * Severity policy: milestone gates (warnings, e.g. TSRX001 reactive `@for`)
 * skip the file with a logged notice; errors fail the build run.
 */

import { mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { componentTsrx, type FileInfo } from '../file-signals'
import { getFilePath, writeFileSafe } from '../io'
import { compileComponent } from '../tsrx'
import { type RegistryEntry, registryJson } from '../tsrx/registry'
import type { SourceSpan } from '../tsrx/spans'
import { createBuildEffect } from './build-effect'

/**
 * One compiled component's generated-module span tables (LT-011, `check:tsrx`;
 * server coverage added by LT-019 — composition is the first construct that
 * makes server modules import each other's real types).
 */
export type CompiledSpanInfo = {
	tag: string
	/** `.tsrx` source path, relative to the repo root. */
	source: string
	/** Generated client module path on disk, absolute. */
	clientModulePath: string
	spans: SourceSpan[]
	/** Generated server module path on disk, absolute. */
	serverModulePath: string
	serverSpans: SourceSpan[]
}

/* === Internal Functions === */

const GENERATED_DIR = join(import.meta.dir, '..', 'generated', 'tsrx')
const ROOT = join(import.meta.dir, '..', '..')

/**
 * Custom element tags of the hand-written example components, mapped to
 * their source paths (relative to the generated dir). Registry-aware
 * attribute dispatch needs the tags too: a reactive attribute on ANY example
 * custom element the docs pages load alongside (e.g. `basic-button` inside
 * module-list) lowers to `pass()`, exactly as for migrated .tsrx tags — and
 * the generated client imports the module for its `declare global` entry.
 */
export const handwrittenExampleModules = (): Map<string, string> => {
	const modules = new Map<string, string>()
	const glob = new Bun.Glob('examples/**\/*.ts')
	for (const rel of glob.scanSync({ cwd: ROOT })) {
		const tag = (rel.split('/').pop() ?? '').replace(/\.ts$/, '')
		// Component files are named for their tag (dashed); helpers (main.ts,
		// copyToClipboard.ts) and tests carry no dash or a dot suffix.
		if (!/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$/.test(tag)) continue
		// Specifiers are relative to the generated dir (server/generated/tsrx)
		// and extensionless (bundler-style resolution, TS5097-safe).
		modules.set(tag, `../../../${rel.replace(/\.ts$/, '')}`)
	}
	return modules
}

/**
 * Compile the whole corpus (exported for the standalone `scripts/build-tsrx.ts`
 * runner — `build:cem` needs the generated clients on disk before `cem
 * analyze` reads them).
 */
export const compileTsrxCorpus = async (
	files: FileInfo[],
): Promise<CompiledSpanInfo[]> => {
	await mkdir(GENERATED_DIR, { recursive: true })

	// Registry-aware dispatch needs every compilable tag up front: first
	// pass collects tags (warnings already skip their files), second pass
	// compiles against the full registry. The same first pass also builds
	// the compose registry (ADR 0023 sub-design 10) — a composed element's
	// import specifier resolves to another file's own repo-relative path,
	// so every file's entry is keyed by that path for the second pass to
	// look up regardless of compile order (composition is not order-dependent
	// the way registry-tag `pass()` dispatch is).
	const childImports = handwrittenExampleModules()
	const registry = new Set<string>(childImports.keys())
	const compilable = new Map<string, string>()
	const compiledTags = new Set<string>()
	const composeRegistry = new Map<string, RegistryEntry>()
	for (const file of files) {
		const rel = relative(join(import.meta.dir, '..', '..'), file.path)
		// Pass 1 must see the hand-written tags too (`registry` starts seeded
		// from `childImports`, LT-020 fix): a raw-tag `pass={{ }}` target
		// (e.g. `basic-button`) is otherwise flagged "not registry-known" in
		// THIS pass even though it always was, silently dropping the whole
		// file before pass 2 ever gets a chance to compile it for real.
		const { component, diagnostics } = compileComponent(
			file.content,
			rel,
			registry,
		)
		for (const d of diagnostics) {
			const label = `[${d.code}] ${d.line ? `line ${d.line}: ` : ''}${d.message}`
			if (d.severity === 'error') console.error(`❌ ${rel} — ${label}`)
			else console.warn(`⚠️ ${rel} — ${label}`)
		}
		if (component) {
			registry.add(component.entry.tag)
			compiledTags.add(component.entry.tag)
			compilable.set(rel, file.content)
			composeRegistry.set(rel, component.entry)
		}
	}
	// Migrated tags import their generated clients (side-effect: the tag-map
	// augmentation and the runtime registration arrive together). A tag in a
	// dual state — .tsrx compiled AND its hand-written twin still on disk —
	// keeps the TWIN's module: the twin is what main.ts registers, and a
	// generated client importing the other half would double-define the tag
	// in the bundle.
	for (const tag of compiledTags)
		if (!childImports.has(tag)) childImports.set(tag, `./${tag}.client`)

	const entries: RegistryEntry[] = []
	const spanInfos: CompiledSpanInfo[] = []
	for (const [rel, content] of compilable) {
		const { component, diagnostics } = compileComponent(
			content,
			rel,
			registry,
			childImports,
			composeRegistry,
		)
		for (const d of diagnostics) {
			const label = `[${d.code}] ${d.line ? `line ${d.line}: ` : ''}${d.message}`
			if (d.severity === 'error') console.error(`❌ ${rel} — ${label}`)
			else console.warn(`⚠️ ${rel} — ${label}`)
		}
		if (!component) continue
		const { entry } = component
		const clientModulePath = getFilePath(GENERATED_DIR, entry.clientModule)
		const serverModulePath = getFilePath(GENERATED_DIR, entry.serverModule)
		await writeFileSafe(serverModulePath, component.serverCode)
		await writeFileSafe(clientModulePath, component.clientCode)
		await writeFileSafe(getFilePath(GENERATED_DIR, entry.css), component.css)
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

	await writeFileSafe(
		getFilePath(GENERATED_DIR, 'registry.json'),
		registryJson(entries),
	)
	console.log(`📝 TSRX compilation completed (${entries.length} component(s))`)
	return spanInfos
}

/* === Exported Effect === */

export const tsrxEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'TSRX compiler',
		[componentTsrx.sources],
		async ([files]) => {
			console.log('🔄 Compiling TSRX components...')
			await compileTsrxCorpus(files)
		},
		onRebuild,
	)
