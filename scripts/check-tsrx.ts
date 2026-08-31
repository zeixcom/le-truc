#!/usr/bin/env bun

/**
 * `check:tsrx` (LT-011, ADR 0023 sub-design 6 amendment, stage 1; server
 * coverage added by LT-019).
 *
 * Compiles the whole `.tsrx` corpus, runs `tsc --noEmit` against the
 * generated client modules (the same emit-then-check already exercised in
 * `server/tests/tsrx/client.golden.test.ts`), and remaps every diagnostic's
 * `generated-file:line:col` back onto its `.tsrx` source location using the
 * span table each component's client emitter records. TS diagnostics only
 * ever arise in CODE positions (setup, thunks, handlers) — every code
 * position lowers into the client module, so the span table only needs to
 * cover those, never template markup (which lowers into the server half and
 * is never type-checked) — UNTIL component composition (ADR 0023 sub-design
 * 10): a composed call is a real typed function call between two generated
 * SERVER modules (`render<Name>({ … })`), so a missing/mistyped server arg
 * or `children` argument (LT-018) is a tsc diagnostic that only ever shows up
 * there. Generated server modules are therefore type-checked too, through
 * their own span table (recorded by `emit-server.ts` since LT-011, unused for
 * this purpose until now).
 *
 * This is the CLI-first half of LT-011: zero editor tooling, just `bun run
 * check:tsrx` reporting type errors at their authored `.tsrx` location.
 * Stage 2 (optional, later, scheduled after the `examples/` wholesale
 * migration — LT-014) reuses this same span table in a `@volar/language-core`
 * plugin for in-editor diagnostics.
 */

import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Glob } from 'bun'
import { compileTsrxCorpus } from '../server/effects/tsrx'
import {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
	type SourceSpan,
} from '../server/tsrx/spans'

const ROOT = resolve(import.meta.dir, '..')

/** `path(line,col): error TSxxxx: message` — tsc's `--pretty false` format. */
const DIAGNOSTIC_LINE =
	/^(?<file>.+?)\((?<line>\d+),(?<col>\d+)\): (?<severity>error|warning) (?<code>TS\d+): (?<message>.*)$/

const files = []
const glob = new Glob('examples/**/*.tsrx')
for (const rel of glob.scanSync({ cwd: ROOT, onlyFiles: true })) {
	const path = join(ROOT, rel)
	const stat = statSync(path)
	files.push({
		path,
		filename: rel,
		content: readFileSync(path, 'utf8'),
		hash: '',
		lastModified: stat.mtimeMs,
		size: stat.size,
		exists: true,
	})
}
if (files.length === 0) {
	console.error('❌ No .tsrx sources found under examples/')
	process.exit(1)
}

const spanInfos = await compileTsrxCorpus(files)
if (spanInfos.length === 0) {
	console.error('❌ No .tsrx source compiled — nothing to check')
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

const proc = Bun.spawn(
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
const [stdout, stderr, exitCode] = await Promise.all([
	new Response(proc.stdout).text(),
	new Response(proc.stderr).text(),
	proc.exited,
])

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

process.exit(exitCode)
