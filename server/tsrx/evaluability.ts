/**
 * The single home of the server-known evaluability rule (LT-043,
 * regrouping move M4 of LE_TRUC_COMPILER.md §7): the predicate deciding
 * WHAT THE SERVER RENDERS. A reactive expression renders its initial value
 * server-side only when every name it reads — minus JS/DOM globals — is in
 * the render scope (args + setup consts + signals); otherwise it is omitted
 * and the client's first binding pass corrects it (DOM-is-truth, ADR
 * 0003/0024 s3). Before LT-043 this rule was restated in `analyze.ts`,
 * `emit-server.ts`, and `plain-imports.ts` — a divergence between the
 * copies would be a wrong COMPONENT, not a wrong error message; the server
 * goldens pin the render set byte-for-byte.
 */

import type { TsrxNode } from '@tsrx/core'
import { freeIdentifiers, JS_GLOBALS } from './ast-utils'

/**
 * Free identifiers excluding JS globals — the dependency set that matters
 * for evaluability. Note the analyzer additionally consults this set for
 * its CLIENT-portability checks (a thunk the factory can resolve) — same
 * helper, different scope vocabulary.
 */
export const dependenciesOf = (node: TsrxNode): Set<string> => {
	const free = freeIdentifiers(node)
	for (const global of JS_GLOBALS) free.delete(global)
	return free
}

/**
 * Whether `node` can be evaluated server-side under `scope`: every
 * non-global free name it reads is server-known. The one gate behind
 * reactive-attribute rendering, class/style maps, `html`, lazy children
 * (emit-server), server-rendered-thunk import placement (plain-imports),
 * and the root's initial class/style (LT-028/LT-032 exemptions).
 */
export const isServerEvaluable = (
	node: TsrxNode,
	scope: ReadonlySet<string>,
): boolean => dependenciesOf(node).isSubsetOf(scope)
