/**
 * Test-server port selection (LT-415), shared by `playwright.config.ts` and
 * `scripts/test-variants.ts`. Runs under both Node (Playwright) and Bun, so
 * it imports nothing from `server/`.
 *
 * A test run never trusts whatever listens on 3000: it reuses a running
 * server only when `/api/status` names this checkout's root and the surface
 * the run expects, and otherwise starts its own on a free port.
 */

import { realpathSync } from 'node:fs'
import { type AddressInfo, createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The interactive default of `serve.ts`/`dev.ts`. */
export const INTERACTIVE_PORT = 3000

/** This checkout's root, resolved the way `/api/status` reports it. */
export const CHECKOUT_ROOT = realpathSync(
	join(dirname(fileURLToPath(import.meta.url)), '..'),
)

/** A port the OS reports free right now. */
export const freePort = (): Promise<number> =>
	new Promise((resolve, reject) => {
		const probe = createServer()
		probe.unref()
		probe.on('error', reject)
		probe.listen(0, () => {
			const { port } = probe.address() as AddressInfo
			probe.close(() => resolve(port))
		})
	})

/**
 * Whether the server on `port` is this checkout's docs server serving
 * `surface` (`'default'`: no `TEST_SURFACE` override). False for no server,
 * a foreign server, another worktree or another surface.
 */
export const servesThisCheckout = async (
	port: number,
	surface = 'default',
): Promise<boolean> => {
	try {
		const res = await fetch(`http://localhost:${port}/api/status`, {
			signal: AbortSignal.timeout(1000),
		})
		if (!res.ok) return false
		const body = (await res.json()) as { root?: unknown; surface?: unknown }
		return body.root === CHECKOUT_ROOT && body.surface === surface
	} catch {
		return false
	}
}
