#!/usr/bin/env bun

/**
 * `check:corpus` (LT-011, ADR 0023 sub-design 6 amendment, stage 1; server
 * coverage added by LT-019; both authored surfaces since ADR 0032 s6).
 *
 * Compiles the whole corpus — `.tsx` and `.tsrx` sources alike, each through
 * its own front end — runs `tsc --noEmit` against the generated client AND
 * server modules (the emit-then-check already exercised in
 * `server/tests/compiler/client.golden.test.ts`), and remaps every
 * diagnostic's `generated-file:line:col` back onto its authored source
 * location through the span table each emitter records.
 *
 * Code positions (setup, thunks, handlers) lower into the client module and
 * are span-mapped there. The server module is checked too: a composed call
 * is a real typed function call between two generated server modules
 * (`render<Name>({ … })`, ADR 0023 sub-design 10), so a missing or mistyped
 * server arg or `children` argument (LT-018) only shows up there; and every
 * text position renders through a typed sink on both halves (`text`/`textOf`
 * on the server, `bindText` on the client, ADR 0046 s6, LT-428), so an object
 * or a boolean in a text position reports at its authored child.
 *
 * This is the CLI half: zero editor tooling, just `bun run check:corpus`
 * reporting type errors at their authored location. A `@volar/language-core`
 * plugin reusing the same span table for in-editor diagnostics is a later,
 * optional stage.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
	formatCensus,
	tierCensus,
	translationCensus,
} from '../server/compiler/census'
import type { ComponentRegistry } from '../server/compiler/registry'
import {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
	type SourceSpan,
} from '../server/compiler/spans'
import { compileCorpus } from '../server/corpus-compile'
import {
	collectCorpusSources,
	loadCorpusConfig,
} from '../server/corpus-sources'
import { collectI18n } from '../server/effects/i18n'
import { io } from '../server/runtimes'

// The configuration this run compiles under (LT-255): a consumer's
// `le-truc.config.json`, or — as in this repo — the defaults, which are this
// repo's own paths.
const config = loadCorpusConfig()
const ROOT = config.root
const GENERATED_DIR = config.outDir

/** `path(line,col): error TSxxxx: message` — tsc's `--pretty false` format. */
const DIAGNOSTIC_LINE =
	/^(?<file>.+?)\((?<line>\d+),(?<col>\d+)\): (?<severity>error|warning) (?<code>TS\d+): (?<message>.*)$/

// Dual corpus (ADR 0032 sub-design 6, LT-202): both authored surfaces feed
// the same runner; the front end is chosen per file by extension. Which files
// those are is the configured glob list's answer, not this script's.
const files = collectCorpusSources(config)
if (files.length === 0) {
	console.error(
		`❌ No component sources matched ${config.sources.join(', ')} under ${ROOT}`,
	)
	process.exit(1)
}

// Count what the corpus runner reports (LT-168): the runner owns the warning
// format and prints each warning once per compilation pass, so the baseline
// is captured here and deduped across the passes instead of remembered. The
// wave-4 regression signal's first number must be a counted figure — the
// summary line below is what a reconciliation reads.
const warningLines: string[] = []
const realWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
	const text = args.map(String).join(' ')
	if (text.startsWith('⚠️')) warningLines.push(text)
	realWarn(...args)
}
let spanInfos
try {
	spanInfos = await compileCorpus(files, config)
} finally {
	console.warn = realWarn
}
if (spanInfos.length === 0) {
	console.error('❌ No component source compiled — nothing to check')
	process.exit(1)
}

type ResolvedSpanInfo = {
	source: string
	modulePath: string
	spans: SourceSpan[]
}

const byGeneratedPath = new Map<string, ResolvedSpanInfo>()
for (const info of spanInfos) {
	byGeneratedPath.set(info.clientModulePath, {
		source: info.source,
		modulePath: info.clientModulePath,
		spans: info.spans,
	})
	byGeneratedPath.set(info.serverModulePath, {
		source: info.source,
		modulePath: info.serverModulePath,
		spans: info.serverSpans,
	})
}

const { exitCode, stdout, stderr } = await io.spawn(
	[
		'bunx',
		'tsc',
		'--ignoreConfig',
		'--noEmit',
		'--pretty',
		'false',
		'--strict',
		'--target',
		'esnext',
		'--module',
		'esnext',
		'--moduleResolution',
		'bundler',
		'--lib',
		'esnext,dom',
		'--skipLibCheck',
		'--types',
		'node',
		...spanInfos.map(info => info.clientModulePath),
		...spanInfos.map(info => info.serverModulePath),
	],
	{ stdout: 'pipe', stderr: 'pipe', cwd: ROOT },
)

if (stderr.trim()) console.error(stderr.trim())

let remapped = 0
let unmapped = 0
for (const line of stdout.split('\n')) {
	if (!line.trim()) continue
	const match = DIAGNOSTIC_LINE.exec(line)
	if (!match?.groups) {
		console.log(line)
		continue
	}
	const {
		file,
		line: lineStr,
		col: colStr,
		severity,
		code,
		message,
	} = match.groups
	const info = byGeneratedPath.get(resolve(ROOT, file as string))
	if (!info) {
		console.log(line)
		unmapped++
		continue
	}
	const generatedText = readFileSync(info.modulePath, 'utf8')
	const generatedOffset = fileLineColToOffset(
		generatedText,
		Number(lineStr),
		Number(colStr),
	)
	const span = findSpanForGeneratedOffset(info.spans, generatedOffset)
	if (!span) {
		console.log(
			`${info.source}: (unmapped — no source span covers this generated position; ${severity} ${code}: ${message})`,
		)
		unmapped++
		continue
	}
	const sourceText = readFileSync(join(ROOT, info.source), 'utf8')
	const sourceOffset =
		span.sourceStart + (generatedOffset - span.generatedStart)
	const { line: srcLine, col: srcCol } = fileOffsetToLineCol(
		sourceText,
		sourceOffset,
	)
	console.log(
		`${info.source}(${srcLine},${srcCol}): ${severity} ${code}: ${message}`,
	)
	remapped++
}

if (remapped > 0 || unmapped > 0)
	console.log(
		`\n${remapped} diagnostic(s) mapped to source, ${unmapped} unmapped.`,
	)

// The standing corpus compile warnings, counted (LT-168). Printed even at
// zero — an absent line is indistinguishable from an uncounted one, and
// zero is the gate-wave target state.
const uniqueWarnings = new Set(warningLines)
console.log(
	`\nCompile-warning baseline: ${uniqueWarnings.size} unique standing ` +
		`warning(s) (${warningLines.length} lines across the two compilation ` +
		"passes) — the wave-4 regression signal's first number. Read this " +
		'count; do not tail-read the ⚠️ lines.',
)

// The tier census (ADR 0029 sub-design 6, LT-165 step 6): a build-report
// record, NOT a warning — its own section below, never merged into the
// counted baseline above. Read from the registry the compile just wrote;
// the compose-read fixpoint in compileCorpus runs BEFORE registry.json
// is written, so the census records post-contamination tiers (the form-
// combobox ruling). This census is expected to grow; its regression story
// is build cost, and it is pinned corpus-wide by tier-corpus.test.ts.
const registry = JSON.parse(
	readFileSync(join(GENERATED_DIR, 'registry.json'), 'utf8'),
) as ComponentRegistry
// Signal locations name the authored file, project-relative (the registry's
// `source` convention); the census prints each one's line.
const authoredText = (file: string): string | undefined => {
	try {
		return readFileSync(join(ROOT, file), 'utf8')
	} catch {
		return undefined
	}
}
console.log(
	`\n${formatCensus(tierCensus(Object.values(registry), authoredText))}`,
)
const i18nGaps = await collectI18n(
	Object.values(registry),
	undefined,
	config.i18nDir,
)

// The translation census (ADR 0030 sub-design 5, LT-173 step 4): the same
// channel and the same reasoning as the tier census above — a missing
// translation is the translator's work, not author-fixable, so it is a
// census record and never a compile warning. Zero locales ⇒ zero entries.
console.log(
	`\n${formatCensus(translationCensus(i18nGaps.gaps, i18nGaps.locales))}`,
)

process.exit(exitCode)
