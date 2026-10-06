/**
 * The key alias (ADR 0047 s1, LT-453): a host-level list seeded from server
 * args and never rendered by its own `map` is read in a reactive list's
 * item setup through `const t = list.byKey(k)`, where the item of the
 * loop's list is its key. This module finds the reads syntactically; the
 * harvest pass (`analysis/list-harvest.ts`) proves the four conditions and
 * the server emitter (`emit-server.ts`) records the witness.
 */

import type { AstNode } from './ast-node'
import { asArray, identifierName, nodeType, walkNodes } from './ast-utils'
import { dependenciesOf } from './evaluability'
import type {
	ComponentIR,
	DeclaredSignalIR,
	ItemSetupStmt,
	ReconcileForIR,
} from './ir'

/* === Types === */

/**
 * One `list.byKey(…)` read in a reactive list's item setup. `alias` is the
 * declared const name when the statement is the alias form exactly —
 * `const t = list.byKey(arg)`, a non-null assertion allowed — else null:
 * the read is conditional, nested in an expression, or in a non-const
 * statement.
 */
export type ByKeyRead = {
	loop: ReconcileForIR
	stmt: ItemSetupStmt
	call: AstNode
	alias: string | null
	/** The `byKey` argument. */
	arg: AstNode | null
}

/* === Internal Functions === */

/** `list.byKey(…)` → the call's argument list, else null. */
const byKeyArgsOf = (node: unknown, list: string): AstNode[] | null => {
	if (nodeType(node) !== 'CallExpression') return null
	const callee = (node as AstNode).callee as AstNode | undefined
	return nodeType(callee) === 'MemberExpression' &&
		!callee?.computed &&
		identifierName(callee?.object) === list &&
		identifierName(callee?.property) === 'byKey'
		? asArray((node as AstNode).arguments)
		: null
}

/* === Exported Functions === */

/**
 * Whether an arg-seeded list harvests per field (ADR 0046 s7): a
 * `harvest()` seed, or an item type that is not a primitive. A `string`
 * (or untyped) item keeps the whole-item read of its bare `{item}` hole.
 */
export const harvestsPerField = (signal: DeclaredSignalIR): boolean =>
	signal.harvest?.kind === 'list' ||
	signal.listItem?.shape.kind === 'fields' ||
	signal.listItem?.shape.kind === 'opaque'

/**
 * Whether `signal` is a list the key alias may harvest: a host-level
 * `createList` whose seed reads server args and nothing else, and which no
 * reactive list renders through its own `map`.
 */
export const isAliasHarvestable = (
	component: ComponentIR,
	signal: DeclaredSignalIR,
): boolean => {
	if (signal.constructor !== 'createList' || !signal.init) return false
	const free = [...dependenciesOf(signal.init)]
	return (
		free.length > 0 &&
		free.every(name => component.paramNames.includes(name)) &&
		![...component.fors.values()].some(
			loop => loop.kind === 'reconcile' && loop.listSignal === signal.name,
		)
	)
}

/** Every `list.byKey(…)` read in any reactive list's item setup, in source order. */
export const byKeyReadsOf = (
	component: ComponentIR,
	list: string,
): ByKeyRead[] => {
	const reads: ByKeyRead[] = []
	for (const loop of component.fors.values()) {
		if (loop.kind !== 'reconcile') continue
		for (const stmt of loop.setup) {
			let init = stmt.node
			if (nodeType(init) === 'TSNonNullExpression')
				init = init.expression as AstNode
			const exact = stmt.kind === 'const' && byKeyArgsOf(init, list) !== null
			walkNodes(stmt.node, node => {
				const args = byKeyArgsOf(node, list)
				if (!args) return
				reads.push({
					loop,
					stmt,
					call: node,
					alias: exact && node === init ? stmt.name : null,
					arg: args.length === 1 ? (args[0] ?? null) : null,
				})
			})
		}
	}
	return reads.sort(
		(a, b) => (a.call.start as number) - (b.call.start as number),
	)
}

/**
 * The alias scope the witness records (ADR 0047 s2): the loop holding the
 * first exact alias of `list`, or null. The harvest pass has refused every
 * other shape before a module is emitted.
 */
export const aliasScopeOf = (
	component: ComponentIR,
	list: string,
): ReconcileForIR | null =>
	byKeyReadsOf(component, list).find(read => read.alias !== null)?.loop ?? null
