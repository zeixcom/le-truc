/**
 * The authored-surface vocabulary (LT-233; ADR 0032 sub-design 6 — the two
 * surfaces render identically AND diagnose identically).
 *
 * Every diagnostic fragment that names an authored spelling lives here, one
 * table per surface, side by side: a key added for one surface is a type
 * error until the other spells it too. Shared machinery — the front-end
 * driver (`front-end.ts`), `lower-shared.ts`, the post-lowering tail and
 * the analysis passes — reads the table for the surface it is compiling
 * (`ctx.surface` / `component.surface`) and never spells a directive
 * itself. Messages emitted only by one surface's grammar-specific code (the
 * `.tsrx` key clause, the `.tsx` switch IIFE) stay inline there: they have
 * no twin to drift from.
 *
 * `server/tests/compiler/tsx/diagnostic-parity.test.ts` pins the contract:
 * the same invalid component gets the same code and the same message on
 * both surfaces, modulo exactly these fragments, and a `.tsx` message
 * never names a `.tsrx` directive.
 */

/** The two authored surfaces (closed set, ADR 0032 s6). */
export type Surface = 'tsrx' | 'tsx'

export type SurfaceWording = {
	/* --- the component function (driver) --- */
	/** No component function found — the message after `${filename}: `. */
	noComponent: string
	/** The output is neither a root element nor a fragment. */
	outputShape: string
	/** Where the template output sits, as a noun phrase. */
	outputLabel: string

	/* --- composed elements and element tags --- */
	/** A lazy child inside a composed element's content. */
	lazyChild: string
	/** Control flow inside a composed element's content. */
	controlFlow: string
	/** Where a composed element is illegal (the non-child-list context). */
	composedPosition: string
	/** The conditional spelling that picks between two static tags (LTC053). */
	conditionalTag: string

	/* --- conditions --- */
	ifCondition: string
	switchDiscriminant: string

	/* --- conditionals (`@if` / ternary and `&&`) --- */
	/** The construct, after "this"/"the same". */
	if: string
	/** Several of them, as a fix-it ("split into …"). */
	separateIfs: string
	/** The first and second branch, after "the". */
	thenBranch: string
	elseBranch: string
	/** One branch, after "one"/"the". */
	ifBranch: string
	/** Branches in general, sentence-initial or after "inside". */
	ifBranches: string
	/** The one-branch form, after "inside". */
	singleBranchIf: string
	/** The one-branch form as a fix-it ("or use …"). */
	singleBranchIfFix: string
	/** The two-branch form, after "inside". */
	ifWithElse: string

	/* --- switch --- */
	switchArms: string
	/** The arms of a switch, sentence-initial. */
	caseArms: string
	/** A switch with no arms. */
	switchNoArms: string

	/* --- error and async boundaries --- */
	tryBody: string
	pendingArm: string
	catchArm: string
	/** The boundary construct, as a noun phrase. */
	boundary: string
	/** Boundaries in general, sentence-initial. */
	boundaries: string

	/* --- loops --- */
	/** The loop spelling in "reactive-list …", "… body", "… over". */
	loop: string
	/** A loop as a sentence subject. */
	aLoop: string
	/** Statements other than consts inside a server-data loop body. */
	loopBodyStatements: string
	/** The names a reactive-list loop can bind (the reserved-name check). */
	loopBindings: string
	/** A reactive-list loop's empty arm. */
	emptyArm: string
	/** The empty arm as a fix-it. */
	emptyArmFix: string
	/** Control flow inside a reactive-list body. */
	listControlFlow: string
	/**
	 * How a handler acts on its item, appended after a sentence — empty on
	 * `.tsx`, which has no key binding.
	 */
	listItemHandlerFix: string
	/** A loop inside a conditional/switch branch (LT-301). */
	loopInBranch: (branch: 'if' | 'switch') => { inside: string; outOf: string }
}

const TSRX: SurfaceWording = {
	noComponent: 'no exported component function with an @{ } container found.',
	outputShape:
		"the @{ } container's output must be a single root element, or a fragment (element + <style>).",
	outputLabel: 'the @{ } output',

	lazyChild: 'A lazy child (&{expr})',
	controlFlow: 'A control-flow directive (@if/@switch/@try)',
	composedPosition: '@for output',
	conditionalTag: '@if (level === 2) { <h2>…</h2> } @else { <h3>…</h3> }',

	ifCondition: '@if condition',
	switchDiscriminant: '@switch discriminant',

	if: '@if',
	separateIfs: 'separate @if blocks',
	thenBranch: '@if branch',
	elseBranch: '@else branch',
	ifBranch: '@if branch',
	ifBranches: '@if branches',
	singleBranchIf: 'a single-branch @if',
	singleBranchIfFix: 'a single-branch @if (no @else)',
	ifWithElse: 'an @if with @else',

	switchArms: '@switch arms',
	caseArms: '@case/@default arms',
	switchNoArms: '@switch must contain at least one @case or @default arm',

	tryBody: '@try body',
	pendingArm: '@pending arm',
	catchArm: '@catch arm',
	boundary: '`@try`/`@catch`/`@pending` boundary',
	boundaries: '@try blocks',

	loop: '@for',
	aLoop: 'A `@for` loop',
	loopBodyStatements:
		'Statements other than const declarations inside @for bodies',
	loopBindings: 'Loop variable or key binding',
	emptyArm: '`@empty` arm',
	emptyArmFix: "the loop's own `@empty` arm",
	listControlFlow: 'Control-flow directives (@if/@switch/@try)',
	listItemHandlerFix:
		' Act on the item through the key binding instead (`@for (const item of items; key k)`, then `items.remove(k)`).',
	loopInBranch: branch => ({
		inside: `an \`@${branch}\` branch`,
		outOf: 'the branch',
	}),
}

const TSX: SurfaceWording = {
	noComponent:
		'no exported component function found (one per file, setup statements then a single `return <jsx/>`).',
	outputShape:
		'the return value must be a single root element, or a fragment (element + <style>).',
	outputLabel: 'the template return',

	lazyChild: 'A lazy child expression',
	controlFlow: 'A control-flow expression (ternary/map/switch/truc:try)',
	composedPosition: 'map output',
	conditionalTag: '{level === 2 ? <h2>…</h2> : <h3>…</h3>}',

	ifCondition: 'if condition',
	switchDiscriminant: 'switch discriminant',

	if: 'conditional',
	separateIfs: 'separate conditionals',
	thenBranch: 'first conditional arm',
	elseBranch: 'second conditional arm',
	ifBranch: 'conditional arm',
	ifBranches: 'conditional arms',
	singleBranchIf: 'a single-arm conditional',
	singleBranchIfFix: 'a single-arm `{cond && <el/>}`',
	ifWithElse: 'a two-arm conditional',

	switchArms: 'switch arms',
	caseArms: 'switch arms',
	switchNoArms: 'switch must contain at least one case or default arm',

	tryBody: '`<truc:try>` content',
	pendingArm: '`pending` arm',
	catchArm: '`catch` arm',
	boundary: '`<truc:try>` boundary',
	boundaries: '`<truc:try>` boundaries',

	loop: 'map',
	aLoop: 'A `.map()` loop',
	loopBodyStatements:
		'Statements other than const declarations inside map bodies (statements belong in setup; branches render via ternaries)',
	loopBindings: 'Loop variable',
	emptyArm: 'empty-state arm',
	emptyArmFix:
		'the empty-state idiom (`{items.length === 0 ? <empty/> : items.map(…)}`)',
	listControlFlow: 'Control-flow expressions',
	listItemHandlerFix: '',
	loopInBranch: branch =>
		branch === 'if'
			? { inside: 'a conditional arm', outOf: 'the conditional' }
			: { inside: 'a `switch` case', outOf: 'the switch' },
}

/** Each surface's vocabulary, keyed by the surface tag. */
export const SURFACE_WORDING: Readonly<Record<Surface, SurfaceWording>> = {
	tsrx: TSRX,
	tsx: TSX,
}

/**
 * The vocabulary for whatever the context is compiling. A `ComponentIR`
 * from a third-party front end may carry no surface (the field is optional
 * contract IR) — it is worded as `.tsx`, the JavaScript-expression
 * spelling and the published package's only bundled surface.
 */
export const wordingOf = (at: { surface?: Surface }): SurfaceWording =>
	SURFACE_WORDING[at.surface ?? 'tsx']
