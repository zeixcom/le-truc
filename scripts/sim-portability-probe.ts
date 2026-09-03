/**
 * Server-Simulation portability probe (ADR 0027, LT-151).
 *
 * Replaces `server/generated/sim-colorgraph-spike.ts`, which imported jsdom
 * from an absolute `/private/tmp` path and lived in a directory the golden
 * tests write into (the LT-140 race), so it ran on exactly one machine.
 *
 * This half is deliberately runtime-neutral — no Bun APIs, no bare
 * extensionless imports — so the same file runs under `bun`, `node` and `deno`.
 * `sim-portability-check.ts` (Bun) prepares the job and diffs the runs.
 *
 *   bun  scripts/sim-portability-probe.ts <job.json>
 *   node scripts/sim-portability-probe.ts <job.json>
 *   deno run -A scripts/sim-portability-probe.ts <job.json>
 *
 * The job file carries a PREBUILT client bundle, because the generated client
 * modules use Bun-style extensionless relative imports and a self-referencing
 * `@zeix/le-truc` specifier — a compiler-side fact, not a driver-side one. What
 * this probe answers is whether the DRIVER behaves identically once the module
 * graph is resolvable.
 */

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createSimulationRealm } from '../server/tsrx/sim/index.ts'

type ProbeJob = {
	/** Custom element name of the component under probe. */
	component: string
	/** The SSR'd markup, as `emit-server` produced it. */
	markup: string
	/** Absolute path to a portable ESM bundle of the generated client module. */
	clientBundle: string
	/** Optional element paths to report resolved values for, as a fidelity check. */
	probes?: Array<{ label: string; selector: string; attribute?: string }>
}

const jobPath = process.argv[2]
if (!jobPath) {
	console.error('usage: sim-portability-probe <job.json>')
	process.exit(1)
}

const job = JSON.parse(readFileSync(jobPath, 'utf8')) as ProbeJob
const realm = createSimulationRealm()

// Phase 1 — resolution. Awaiting here is legitimate (ADR 0027 sub-design 9).
await realm.load(() => import(pathToFileURL(job.clientBundle).href))

// Phase 2 — the synchronous instantiate→serialize window.
const html = realm.render({ markup: job.markup, component: job.component })

// Diagnostic-only, after the boundary: did anything keep mutating?
await realm.checkDeferredActivation(job.component, html)

const values: Record<string, string | null> = {}
for (const probe of job.probes ?? []) {
	const element = realm.document.querySelector(probe.selector)
	values[probe.label] =
		element === null
			? null
			: probe.attribute
				? element.getAttribute(probe.attribute)
				: element.textContent
}

console.log(
	JSON.stringify(
		{
			runtime: realm.runtime,
			definitions: realm.definitions.map(entry => entry.name).sort(),
			html,
			values,
			diagnostics: realm.diagnostics.map(({ kind, component, message }) => ({
				kind,
				component,
				message,
			})),
		},
		null,
		2,
	),
)

realm.dispose()
