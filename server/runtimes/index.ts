/**
 * The runtime seam's selection point (LT-267).
 *
 * Both implementations are imported statically and only one is answered —
 * neither touches its runtime-specific API at module scope, so importing
 * this module is safe under Bun, Node and Deno alike. Everything on the
 * repo build's IO path goes through `io`; the compiler package's own
 * corpus pass goes through its own seam (`server/compiler/fs.ts`,
 * LT-480) instead. The only Bun.* left outside this directory is the
 * HTTP dev server (serve.ts / dev.ts), which is repo tooling, not the
 * published build path.
 */

import { io as bunIO } from './bun'
import { io as nodeIO } from './node'
import type { RuntimeIO } from './types'

const io: RuntimeIO = typeof Bun !== 'undefined' ? bunIO : nodeIO

export type {
	GlobScanOptions,
	RuntimeIO,
	SpawnOptions,
	SpawnResult,
} from './types'
export { io }
