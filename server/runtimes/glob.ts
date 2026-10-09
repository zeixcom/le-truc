/**
 * The shared glob machinery (LT-267) — moved into the compiler package at
 * LT-480, where the semantics are owned (see `server/compiler/fs.ts`, the
 * package's file-system seam). This re-export keeps the runtime seam's
 * import graph stable: `bun.ts` and `node.ts` keep one translator, so a
 * consumer's corpus cannot match one file set under Bun and another under
 * Node.
 */

export { globToRegExp, matchGlob, scanGlobSync } from '../compiler/fs'
