#!/usr/bin/env bun

/**
 * CEM Manifest Verifier
 *
 * Guards `build:cem` against the silent-failure mode where the Le Truc
 * analyzer plugin fails to load (e.g. ERR_MODULE_NOT_FOUND) but `cem analyze`
 * still exits 0 and writes a manifest full of garbage declarations. Without the
 * plugin, the default analyzer falls back to naming declarations after the
 * internal `Truc` class internals (`name: "Truc"`, `name: "J"`,
 * `name: "anonymous_N"`) with empty members — a broken manifest that looks valid.
 *
 * The plugin always synthesises a PascalCase `name` from the tag name
 * (`basic-counter` → `BasicCounter`). Asserting every declaration name is
 * PascalCase is therefore a reliable signal that the plugin loaded and ran.
 *
 * Usage:
 *   bun run verify:cem            # verify custom-elements.json in repo root
 *   bun run build:cem             # `cem analyze && bun run verify:cem`
 */

import { existsSync, readFileSync } from 'node:fs'

const MANIFEST_PATH = 'custom-elements.json'
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]+$/

interface Declaration {
	name?: string
	tagName?: string
	customElement?: boolean
}

interface Manifest {
	modules?: Array<{ path?: string; declarations?: Declaration[] }>
}

function fail(message: string): never {
	console.error(`❌ ${message}`)
	process.exit(1)
}

function main() {
	if (!existsSync(MANIFEST_PATH)) {
		fail(
			`${MANIFEST_PATH} not found — run \`bun run build:cem\` (cem analyze) first.`,
		)
	}

	let manifest: Manifest
	try {
		manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
	} catch (error) {
		fail(
			`${MANIFEST_PATH} is not valid JSON: ${error instanceof Error ? error.message : error}`,
		)
	}

	// Module paths must be package-root-relative (CEM schema). Absolute paths
	// mean the machine that generated the manifest leaked its filesystem layout
	// into the published artifact (locally: /Users/…; in CI: /home/runner/…).
	// Fixed in @zeix/cem-plugin-le-truc 0.2.1 (packageLinkPhase relativization).
	const absolutePaths = (manifest.modules ?? [])
		.map(m => m.path ?? '')
		.filter(p => p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p))
	if (absolutePaths.length > 0) {
		fail(
			`${MANIFEST_PATH} has ${absolutePaths.length} module(s) with absolute paths (must be package-root-relative), e.g.:\n` +
				`  • ${absolutePaths[0]}\n` +
				'Update @zeix/cem-plugin-le-truc to ^0.2.1 and rerun `bun run build:cem`.',
		)
	}

	const declarations: Declaration[] = (manifest.modules ?? []).flatMap(
		m => m.declarations ?? [],
	)
	const customElements = declarations.filter(d => d.customElement)

	if (customElements.length === 0) {
		fail(
			`${MANIFEST_PATH} contains no custom-element declarations — the @zeix/cem-plugin-le-truc plugin likely failed to load.`,
		)
	}

	// Known-garbage names emitted by the default analyzer when the plugin is
	// absent: the internal class is named `Truc`, the minified bundle leaks `J`,
	// and unresolvable declarations become `anonymous_N`.
	const GARBAGE_NAMES = new Set(['Truc', 'J'])

	// The migrated .tsrx corpus is read from gitignored generated clients
	// (ADR 0023, LT-006). If `cem analyze` ran against a stale or empty
	// server/generated/tsrx/, the corpus tags silently vanish from the
	// manifest — this guard turns that into a build failure with the fix.
	const REQUIRED_TAGS = ['basic-counter', 'module-tabgroup', 'form-textbox']
	const present = new Set(customElements.map(d => d.tagName))
	const missing = REQUIRED_TAGS.filter(tag => !present.has(tag))
	if (missing.length > 0) {
		fail(
			`${MANIFEST_PATH} is missing the migrated corpus tag(s) ${missing.map(t => `<${t}>`).join(', ')} — the tsrx compile probably did not run. Use \`bun run build:cem\` (it compiles the corpus before analyzing).`,
		)
	}

	const bad: string[] = []
	for (const decl of customElements) {
		const name = decl.name ?? ''
		if (GARBAGE_NAMES.has(name) || name.startsWith('anonymous')) {
			bad.push(
				`  • ${name || '(empty)'} <${decl.tagName ?? '?'}> — garbage/anonymous name (plugin did not run)`,
			)
		} else if (!PASCAL_CASE.test(name)) {
			bad.push(
				`  • ${name || '(empty)'} <${decl.tagName ?? '?'}> — not PascalCase`,
			)
		}
	}

	if (bad.length > 0) {
		console.error(
			`❌ ${MANIFEST_PATH} has ${bad.length} declaration(s) with invalid names.\n` +
				'This means the @zeix/cem-plugin-le-truc plugin did not load — the manifest is broken.\n\n' +
				bad.join('\n') +
				'\n\nCheck for ERR_MODULE_NOT_FOUND in the `cem analyze` output above.',
		)
		process.exit(1)
	}

	console.log(
		`✅ ${MANIFEST_PATH} verified: ${customElements.length} custom-element declaration(s), all PascalCase.`,
	)
}

main()
