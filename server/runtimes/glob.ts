/**
 * The shared glob machinery (LT-267).
 *
 * One translator for both runtime implementations: if Bun.Glob and a Node
 * walk disagreed on what `examples/**\/*.tsx` means, a consumer's corpus
 * would silently differ per runtime. The supported grammar is the one the
 * corpus configuration surface needs — `*` (within a segment), `?`,
 * `**\/` (zero or more directories), a trailing `**`, and literal text.
 * Braces and character classes are NOT part of this grammar; a pattern
 * using them matches those characters literally.
 *
 * Semantics are pinned against `Bun.Glob` (the scanner this replaces):
 * `*`/`?` never match `/` and never match a leading dot — a hidden file or
 * directory is only addressed by a pattern segment starting with one — and
 * `**\/` also matches zero directories (`**\/mocks/**` matches `mocks/x.html`).
 * Unlike Bun.Glob's matcher, which lets a bare `*` match a dotfile while its
 * scanner skips them, this one applies the dot rule to matching too: one
 * semantics for scan and match, so a watcher filter can never admit a file
 * the scanner would never yield. That includes a trailing `**`: its
 * remainder is dot-guarded segment by segment (`a/**` does not match
 * `a/.tmp`, `**` does not match `.hidden`).
 *
 * Explicit-dot segments scan the way `Bun.Glob` scans them (LT-277): a
 * pattern segment starting with `.` (`.env`, `.hidden/*.ts`, `**\/.rc`,
 * `.*`) addresses the dot entries it matches, under Bun and under the Node
 * walk alike.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/* === Internal Functions === */

/** One path segment: `*` → any-without-slash, `?` → one-not-slash, rest literal. */
const translateSegment = (segment: string): string => {
	let out = ''
	for (const char of segment) {
		if (char === '*') out += '[^/]*'
		else if (char === '?') out += '[^/]'
		// Escape every regex metacharacter — the grammar has no others.
		else out += char.replace(/[\\^$.+()|[\]{}]/g, '\\$&')
	}
	// A literal segment may address a dotfile; a wildcard one may not.
	return segment.startsWith('.') ? out : `(?!\\.)${out}`
}

/** Anchor a glob pattern to whole paths, `/`-separated. */
export const globToRegExp = (pattern: string): RegExp => {
	const segments = pattern.split('/')
	let rx = ''
	// True when the `/` before the next segment is already accounted for —
	// at the pattern's start, and after an interior `**` whose group ends
	// with its own slash.
	let noSeparatorNeeded = true
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i] as string
		if (segment === '**') {
			const isLast = i === segments.length - 1
			if (isLast) {
				// `a/**` keeps its slash (`a/…`); a bare `**` matches from the start.
				// The remainder has the interior `**`'s shape — zero or more
				// dot-guarded directories — plus one dot-guarded file, so a
				// trailing `**` never admits a hidden entry the walk skips.
				rx +=
					(noSeparatorNeeded || rx.length === 0 ? '' : '/') +
					'(?:(?![.])[^/]+/)*(?![.])[^/]+'
				noSeparatorNeeded = false
			} else {
				// `**\/` = the slash before it (owed by the previous segment, unless
				// `**` leads the pattern) + zero or more directories, each with its
				// own trailing slash — the zero case is what lets `a/**\/b` match `a/b`.
				// The directory segments carry the dot guard too: `**\/x.ts` must not
				// reach into a hidden directory the walk would never enter.
				rx +=
					noSeparatorNeeded || rx.length === 0
						? '(?:(?![.])[^/]+/)*'
						: '/(?:(?![.])[^/]+/)*'
				noSeparatorNeeded = true
			}
			continue
		}
		const translated = translateSegment(segment)
		rx += noSeparatorNeeded || rx.length === 0 ? translated : `/${translated}`
		noSeparatorNeeded = false
	}
	return new RegExp(`^${rx}$`)
}

/**
 * The explicit-dot segments of a pattern, each as a whole-name matcher. A
 * dot entry is walked only when one of them matches its name — the walk's
 * mirror of Bun.Glob, which skips hidden entries unless a pattern segment
 * starting with `.` addresses them. Pruning only: the full-path regex still
 * decides every yielded file.
 */
const dotSegmentMatchers = (pattern: string): RegExp[] =>
	pattern
		.split('/')
		.filter(segment => segment.startsWith('.'))
		.map(segment => new RegExp(`^${translateSegment(segment)}$`))

/* === Exported Functions === */

/**
 * Full-path glob match with the shared semantics. Paths use `/` separators.
 */
export const matchGlob = (pattern: string, path: string): boolean =>
	globToRegExp(pattern).test(path)

/**
 * Recursive file walk under `cwd`, filtered by `globToRegExp(pattern)`.
 * Sorted lexicographically so both implementations — and both runtimes —
 * hand the caller the same order for the same tree. Dot entries are skipped
 * during the walk unless an explicit-dot pattern segment matches their name,
 * mirroring `Bun.Glob`.
 */
export const scanGlobSync = (pattern: string, cwd: string): string[] => {
	const regex = globToRegExp(pattern)
	const dotMatchers = dotSegmentMatchers(pattern)
	const matches: string[] = []
	const walk = (dir: string, prefix: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (
				entry.name.startsWith('.') &&
				!dotMatchers.some(matcher => matcher.test(entry.name))
			)
				continue
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name
			if (entry.isDirectory()) {
				walk(join(dir, entry.name), rel)
				continue
			}
			if (entry.isFile() && regex.test(rel)) matches.push(rel)
		}
	}
	walk(cwd, '')
	return matches.sort()
}
