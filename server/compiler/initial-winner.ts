/**
 * The initial winner of every conditional (ADR 0043 s4, LT-274): which arm
 * a conditional renders at render time, kept on the `conditional` node apart
 * from its client thunk so a template target can emit it as a backend
 * conditional.
 *
 * The test is rewritten into the portable hole grammar (ADR 0043 s1) by
 * substituting each signal read for its initializer and each `host.<prop>`
 * read for the server expression that seeds the prop — the same truths the
 * value harness folds with (`evaluability.ts`). What the rewrite leaves:
 *
 * - no free name at all → `constant`, evaluated here, at compile time
 *   (`createCell(false)`, a `requestContext` fallback literal);
 * - only server args and loop bindings → `select`, the portable `when`
 *   expressions over them;
 * - anything else the harness can still evaluate → `fold`;
 * - nothing any server phase can evaluate (a ref, a client-only primitive)
 *   → `constant: null`: no live arm renders, and the client renders the
 *   arm at connect (ADR 0037 s5 — the compiler does not guess).
 *
 * SSG emission reads the same truths through `emit-server.ts`'s
 * `serverTestExpr`: `emitReactiveConditional` renders `initial.constant`'s
 * arm live and folds a `fold` winner per render — so this module and the
 * server module must agree on what is foldable, and do: both ask
 * `evaluability.ts` (`foldableHostProps` membership, `hostSeedExpr`'s
 * seeds). The one deliberate divergence is representability, not truth:
 * the portable hole grammar (ADR 0043 s1) admits no calls, so a
 * Parser-backed prop's seed — `asInteger()(attrValue(count))` — leaves the
 * rewrite (`winnerOf` answers `fold`) while the server module folds it, the
 * parser factory resolving through the harness import.
 */

import type { AstNode } from './ast-node'
import { isNode, text } from './ast-utils'
import {
	foldableHostProps,
	foldableRefGuards,
	foldableRenderScope,
	hostDerivedFold,
	isServerEvaluable,
} from './evaluability'
import type {
	ArmTemplate,
	AttributeIR,
	ComponentIR,
	InitialWinner,
	TemplateNode,
} from './ir'
import { type ConditionalNode, childNodes } from './walk'

/* === Types === */

/** A rewritten expression: its portable text and the names it still reads. */
type Portable = { text: string; free: ReadonlySet<string> }

type PortableScope = {
	component: ComponentIR
	/** Server args plus the loop bindings in scope. */
	holes: ReadonlySet<string>
	/** Host props whose server truth is known (`foldableHostProps`). */
	hostProps: ReadonlySet<string>
}

/* === Internal Functions === */

const COMPARISONS = new Set(['===', '!==', '<', '<=', '>', '>='])
const LOGICAL = new Set(['&&', '||', '??'])
const TYPE_WRAPPERS = new Set([
	'TSAsExpression',
	'TSNonNullExpression',
	'TSSatisfiesExpression',
])

const union = (...sets: ReadonlySet<string>[]): ReadonlySet<string> =>
	new Set(sets.flatMap(set => [...set]))

/**
 * The server expression seeding `host.<prop>`, as an AST or an arg name —
 * the portable-rewrite twin of `evaluability.ts`'s `hostSeedExpr` (LT-386),
 * which owns the same account for the emitted module. A Parser-backed prop
 * refuses: its truth is the parser applied to the attribute's rendered
 * value, a call the portable grammar cannot represent — the conditional
 * folds through the value harness instead, whose spliced seed applies the
 * parser, so the winner is never the raw attribute's.
 */
const hostSeed = (
	scope: PortableScope,
	prop: string,
): AstNode | string | null => {
	if (!scope.hostProps.has(prop)) return null
	const decl = scope.component.exposeProps.get(prop)
	if (decl?.parser) return null
	// A plain-value initializer IS the prop's seed (`#initSignals` evaluates
	// it once; the attribute never seeds a plain-value prop), so it outranks
	// the same-named root attribute.
	if (decl?.initNode) return decl.initNode
	const rootAttr = scope.component.root.attrs.find(
		(a): a is Extract<AttributeIR, { kind: 'server' }> =>
			a.kind === 'server' && a.name === prop,
	)
	// Root attribute first, as `emit-server`'s host-derived fold splices it;
	// a harvested prop's truth is the same-named arg that renders its site.
	if (rootAttr) return rootAttr.node
	return scope.component.paramNames.includes(prop) ? prop : null
}

/**
 * `node` rewritten into the portable subset (ADR 0043 s1), or null when it
 * leaves it: a call other than a signal read, a computed or optional member,
 * an operator outside the subset, a name that is neither a hole nor
 * substitutable.
 */
const portable = (scope: PortableScope, node: unknown): Portable | null => {
	if (!isNode(node)) return null
	const { component } = scope
	const none: ReadonlySet<string> = new Set()
	switch (node.type) {
		case 'Literal':
			if ('regex' in node || 'bigint' in node) return null
			return { text: text(component.source, node), free: none }
		case 'Identifier': {
			const name = String(node.name)
			if (name === 'undefined') return { text: name, free: none }
			return scope.holes.has(name)
				? { text: name, free: new Set([name]) }
				: null
		}
		case 'MemberExpression': {
			if (node.computed || node.optional) return null
			const property = isNode(node.property) ? node.property : null
			if (property?.type !== 'Identifier') return null
			const name = String(property.name)
			const object = isNode(node.object) ? node.object : null
			if (object?.type === 'Identifier' && object.name === 'host') {
				const seed = hostSeed(scope, name)
				if (seed === null) return null
				if (typeof seed === 'string')
					return { text: seed, free: new Set([seed]) }
				const inner = portable(scope, seed)
				return inner && { text: `(${inner.text})`, free: inner.free }
			}
			const inner = portable(scope, object)
			return inner && { text: `${inner.text}.${name}`, free: inner.free }
		}
		case 'CallExpression': {
			// `signal.get()` — the signal's initial value, its initializer.
			const callee = isNode(node.callee) ? node.callee : null
			const args = Array.isArray(node.arguments) ? node.arguments : []
			if (
				node.optional ||
				args.length > 0 ||
				callee?.type !== 'MemberExpression' ||
				callee.computed ||
				!isNode(callee.property) ||
				callee.property.name !== 'get' ||
				!isNode(callee.object) ||
				callee.object.type !== 'Identifier'
			)
				return null
			const signal = component.signals.find(
				s => s.name === String((callee.object as AstNode).name),
			)
			const init =
				signal?.family === 'context'
					? signal.fallback
					: signal?.family === 'declared'
						? signal.init
						: null
			const inner = init ? portable(scope, init) : null
			return inner && { text: `(${inner.text})`, free: inner.free }
		}
		case 'UnaryExpression': {
			const argument = isNode(node.argument) ? node.argument : null
			if (node.operator === '!') {
				const inner = portable(scope, argument)
				return inner && { text: `!${inner.text}`, free: inner.free }
			}
			if (
				node.operator === '-' &&
				argument?.type === 'Literal' &&
				typeof argument.value === 'number'
			)
				return { text: `-${text(component.source, argument)}`, free: none }
			return null
		}
		case 'BinaryExpression':
		case 'LogicalExpression': {
			const operator = String(node.operator)
			const allowed = node.type === 'BinaryExpression' ? COMPARISONS : LOGICAL
			if (!allowed.has(operator)) return null
			const left = portable(scope, node.left)
			const right = portable(scope, node.right)
			if (!left || !right) return null
			return {
				text: `(${left.text} ${operator} ${right.text})`,
				free: union(left.free, right.free),
			}
		}
		case 'ConditionalExpression': {
			const test = portable(scope, node.test)
			const consequent = portable(scope, node.consequent)
			const alternate = portable(scope, node.alternate)
			if (!test || !consequent || !alternate) return null
			return {
				text: `(${test.text} ? ${consequent.text} : ${alternate.text})`,
				free: union(test.free, consequent.free, alternate.free),
			}
		}
		default:
			return TYPE_WRAPPERS.has(String(node.type))
				? portable(scope, node.expression)
				: null
	}
}

/** Evaluate a closed portable expression at compile time. */
const evaluate = (expression: string): { value: unknown } | null => {
	try {
		// Literals and operators only — `portable` admits no call, no name.
		return { value: new Function(`return (${expression})`)() }
	} catch {
		return null
	}
}

/** An arm's key, or null when it renders nothing. */
const keyOf = (arm: ArmTemplate | undefined): string | null =>
	arm && arm.children.length > 0 ? arm.key : null

/** The initial winner of one conditional under `scope`. */
const winnerOf = (
	scope: PortableScope,
	node: ConditionalNode,
	serverKnown: ReadonlySet<string>,
): InitialWinner => {
	const test = portable(scope, node.test)
	const caseArms = node.arms.filter(arm => arm.test !== null)
	const cases = caseArms.map(arm => portable(scope, arm.test))
	const otherwise =
		node.construct === 'if'
			? keyOf(node.arms[1])
			: keyOf(node.arms.find(arm => arm.test === null))
	if (test && cases.every(c => c !== null)) {
		const portableCases = cases as Portable[]
		if (test.free.size === 0 && portableCases.every(c => c.free.size === 0)) {
			const value = evaluate(test.text)
			if (value) {
				if (node.construct === 'if')
					return { constant: keyOf(node.arms[value.value ? 0 : 1]) }
				for (const [index, arm] of caseArms.entries()) {
					const caseValue = evaluate(portableCases[index]?.text ?? '')
					if (caseValue && caseValue.value === value.value)
						return { constant: keyOf(arm) }
				}
				return { constant: otherwise }
			}
		}
		if (node.construct === 'if')
			return {
				select: [{ when: test.text, key: keyOf(node.arms[0]) }],
				otherwise,
			}
		return {
			select: caseArms.map((arm, index) => ({
				when: `${test.text} === ${portableCases[index]?.text}`,
				key: keyOf(arm),
			})),
			otherwise,
		}
	}
	return node.mode === 'server' ||
		initialFold(scope.component, node, serverKnown)
		? { fold: true }
		: { constant: null }
}

/* === Exported Functions === */

/**
 * The server expression a reactive conditional's initial winner folds
 * through, or null when no server phase can evaluate the test: the test
 * itself when the value harness can evaluate it (signals are their initial
 * values there), else the test with each `host.<prop>` read spliced for the
 * server expression seeding it — the two routes every reactive site folds
 * through (`fold-inputs.ts`'s `folds`).
 */
export const initialFold = (
	component: ComponentIR,
	node: ConditionalNode,
	scope: ReadonlySet<string> = component.serverKnown,
): boolean =>
	isServerEvaluable(node.test, scope) ||
	hostDerivedFold(
		node.test,
		foldableHostProps(component),
		foldableRefGuards(component),
		new Set([...foldableRenderScope(component), ...scope]),
	) !== null

/**
 * Resolve `initial` on every conditional in `component` (assembly's last
 * step: the rewrite needs the root's attributes and every signal). Each
 * conditional sees the server args plus the bindings of the server-data
 * loops enclosing it, and folds over the reactive lists' items enclosing it.
 */
export const resolveInitialWinners = (component: ComponentIR): void => {
	const hostProps = foldableHostProps(component)
	const visit = (
		node: TemplateNode,
		holes: ReadonlySet<string>,
		serverKnown: ReadonlySet<string>,
	): void => {
		let innerHoles = holes
		let innerKnown = serverKnown
		const loop =
			node.kind === 'element'
				? [...component.fors.values()].find(f => f.output === node)
				: undefined
		if (loop?.kind === 'each') {
			const bound = [loop.itemName, ...(loop.indexName ? [loop.indexName] : [])]
			innerHoles = union(holes, new Set(bound))
			innerKnown = union(
				serverKnown,
				new Set([...bound, ...loop.hoisted.map(h => h.name)]),
			)
		}
		// A reactive list's item and key (LT-424): each live item renders
		// with them in scope, so a conditional over the item folds per item
		// in the harness. The item is a signal — `item.get()` is a call the
		// portable grammar does not admit, so it is no hole.
		if (loop?.kind === 'reconcile')
			innerKnown = union(
				serverKnown,
				new Set([loop.itemName, ...(loop.keyName ? [loop.keyName] : [])]),
			)
		if (node.kind === 'conditional')
			node.initial = winnerOf(
				{ component, holes: innerHoles, hostProps },
				node,
				innerKnown,
			)
		for (const child of childNodes(node)) visit(child, innerHoles, innerKnown)
	}
	visit(component.root, new Set(component.paramNames), component.serverKnown)
}
