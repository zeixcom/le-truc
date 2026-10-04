#!/usr/bin/env bun

/**
 * `check:baseline` (LT-305) — fail when shipped code needs a feature newer
 * than the runtime major's pinned Baseline year (REQUIREMENTS § Browser
 * support). Tier 1, build channel: a CI failure, no runtime half.
 *
 * Scans the runtime (`index.ts`, `src/`), the bundled `@zeix/cause-effect`
 * source, and what the compiler emits for the corpus under the default
 * `cssTargets`: the generated client modules and the scoped stylesheets.
 * Only the compiler's own output is held to the pin there. Code the author
 * wrote — a client span the emitter copied from the source, a CSS feature
 * the authored sheet already uses — is the author's own baseline
 * (REQUIREMENTS § Browser support) and is counted, not judged.
 *
 * Then checks that `leTruc.baseline` in package.json moved only with a major
 * version, against the latest release tag reachable from HEAD.
 *
 * Scanner and allowlist: scripts/lib/baseline.ts.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Glob } from 'bun'
import { DEFAULT_CSS_TARGETS } from '../server/compiler/emit-paths'
import { compileCorpus } from '../server/corpus-compile'
import {
	collectCorpusSources,
	loadCorpusConfig,
} from '../server/corpus-sources'
import {
	BASELINE_ALLOWLIST,
	checkPin,
	evaluateBaseline,
	type Finding,
	flattenNesting,
	readPin,
	scanCss,
	scanCssFile,
	scanTypeScript,
} from './lib/baseline'

const root = join(import.meta.dir, '..')
const rel = (path: string) => relative(root, path)

const collect = (pattern: string, cwd: string): string[] =>
	[...new Glob(pattern).scanSync({ cwd, absolute: true })]
		.filter(path => !/(^|\/)tests?\//.test(relative(cwd, path)))
		.sort()

const problems: string[] = []

/* === Pin === */

const pin = readPin(
	JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')),
)
let reference: ReturnType<typeof readPin> | undefined
try {
	const git = (...args: string[]) =>
		execFileSync('git', ['-C', root, ...args], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim()
	const tag = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*')
	reference = readPin(JSON.parse(git('show', `${tag}:package.json`)))
} catch {
	problems.push(
		'No release tag (v*) is reachable from HEAD, so the baseline pin cannot be compared with the last release. Fetch the tags (in CI: actions/checkout with fetch-depth: 0).',
	)
}
problems.push(...checkPin(pin, reference))

/* === Compile the corpus under the default cssTargets === */

// Its own output directory, so a configured `cssTargets` never decides what
// this check sees, and the build's own artifacts stay untouched.
const config = loadCorpusConfig()
const compiled = await compileCorpus(collectCorpusSources(config), {
	...config,
	cssTargets: DEFAULT_CSS_TARGETS,
	outDir: join(root, 'server/generated/baseline'),
})
if (compiled.length === 0)
	problems.push(
		'The corpus compiled no component, so the compiler output went unchecked. Fix the corpus compile first (bun run build:corpus).',
	)

/* === Scan === */

const causeEffect = join(root, 'node_modules/@zeix/cause-effect')
const libraryFiles = [
	join(root, 'index.ts'),
	...collect('src/**/*.ts', root),
	join(causeEffect, 'index.ts'),
	...collect('src/**/*.ts', causeEffect),
]
const clientFiles = compiled.map(info => info.clientModulePath)
const scanned = scanTypeScript([...libraryFiles, ...clientFiles], {
	root,
	paths: { '@zeix/le-truc': ['./index.ts'] },
})

// A client finding inside a span the emitter copied from the source is the
// author's code.
const spansOf = new Map(
	compiled.map(info => [info.clientModulePath, info.spans]),
)
const authored: Finding[] = []
const judged: Finding[] = []
for (const finding of scanned) {
	const file = finding.at.slice(0, finding.at.indexOf(':'))
	const spans = spansOf.get(file)
	const isAuthored = spans?.some(
		span =>
			finding.offset >= span.generatedStart &&
			finding.offset < span.generatedStart + span.length,
	)
	;(isAuthored ? authored : judged).push({ ...finding, at: rel(finding.at) })
}

// An emitted CSS feature the authored sheet already uses is the author's.
for (const info of compiled) {
	const authoredKeys = new Set(
		info.authoredCss.trim()
			? scanCss(flattenNesting(info.authoredCss), info.source).map(f => f.key)
			: [],
	)
	for (const finding of scanCssFile(info.cssPath, rel(info.cssPath)))
		(authoredKeys.has(finding.key) ? authored : judged).push(finding)
}

/* === Judge === */

const year = pin.baseline
if (typeof year === 'number') {
	const report = evaluateBaseline(judged, year)
	for (const v of report.violations)
		problems.push(
			`${v.at} uses ${v.key}, Baseline since ${v.since} — newer than the pinned Baseline ${year}. Use an older feature, or guard the use and allowlist ${v.key} by name with its reason in BASELINE_ALLOWLIST (scripts/lib/baseline.ts).`,
		)
	for (const key of report.stale)
		problems.push(
			`BASELINE_ALLOWLIST entry ${key} is stale: shipped code no longer uses it, or it is within Baseline ${year} now. Remove it from scripts/lib/baseline.ts.`,
		)
	for (const [key, uses] of report.allowed)
		console.log(
			`  allowlisted ${key} (${uses.length} use(s)): ${BASELINE_ALLOWLIST[key]}`,
		)
	const authorNewer = new Set(
		evaluateBaseline(authored, year, {}).violations.map(v => v.key),
	)
	if (authorNewer.size)
		console.log(
			`  author code beyond Baseline ${year}, the author's own baseline: ${[...authorNewer].sort().join(', ')}`,
		)
}

console.log(
	`🔎 Baseline ${String(year)}: ${judged.length} feature use(s) judged across ${libraryFiles.length} library module(s) and ${compiled.length} compiled component(s); ${authored.length} in author code` +
		(reference ? `; pin checked against v${reference.version}` : ''),
)
if (problems.length) {
	for (const problem of problems) console.error(`❌ ${problem}`)
	process.exit(1)
}
console.log('✅ Shipped code stays within the pinned baseline.')
