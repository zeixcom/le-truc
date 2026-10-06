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
 * `.tsx` switch IIFE) stay inline there: they have
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
	/** The output is not a root element. */
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

	/* --- the stylesheet --- */
	/** The stylesheet's authored spelling, as a fix-it noun phrase (LTC078). */
	stylesheetForm: string

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
	/** One arm that renders nothing, as a sentence subject. */
	caseWithoutOutput: string
	/** A switch with no arms, as a sentence subject. */
	switchNoArms: string
	/** One switch arm's test keyword, as in "a … value". */
	caseLabel: string

	/* --- reactive conditions (ADR 0037) --- */
	/** A condition that reads a signal, as a sentence subject. */
	reactiveConditional: string

	/* --- error and async boundaries --- */
	tryBody: string
	pendingArm: string
	catchArm: string
	/** The boundary construct, as a noun phrase. */
	boundary: string
	/** An async boundary (one with a pending arm), as a sentence subject. */
	asyncBoundary: string

	/* --- loops --- */
	/** The loop spelling in "reactive-list …", "… body", "… over". */
	loop: string
	/** A loop as a sentence subject. */
	aLoop: string
	/** A statement other than a const inside a server-data loop body. */
	loopBodyStatements: string
	/** The names a reactive-list loop can bind (the reserved-name check). */
	loopBindings: string
	/** A reactive-list key binding that is not a bare identifier, as a sentence subject. */
	keyBindingShape: string
	/** The key binding spelled as a bare identifier, for the fix-it. */
	keyBindingExample: string
	/** A reactive-list loop's empty arm. */
	emptyArm: string
	/** The empty arm as a fix-it. */
	emptyArmFix: string
	/** A loop inside a conditional/switch branch (LT-301). */
	loopInBranch: (branch: 'if' | 'switch') => { inside: string; outOf: string }
}

const TSRX: SurfaceWording = {
	noComponent: 'no exported component function with an @{ } container found.',
	outputShape:
		"the @{ } container's output must be a single root element (the component's custom-element tag).",
	outputLabel: 'the @{ } output',

	lazyChild: 'A lazy child (`{expr}`)',
	controlFlow: 'A control-flow directive (`@if`, `@switch` or `@try`)',
	composedPosition: "a `@for` loop's output root",
	conditionalTag: '@if (level === 2) { <h2>…</h2> } @else { <h3>…</h3> }',

	stylesheetForm: 'plain text in the `<style>` body',

	ifCondition: 'An `@if` condition',
	switchDiscriminant: 'A `@switch` discriminant',

	if: '`@if`',
	separateIfs: 'separate `@if` blocks',
	thenBranch: '`@if` branch',
	elseBranch: '`@else` branch',
	ifBranch: '`@if` branch',
	ifBranches: '`@if` branches',
	singleBranchIf: 'a single-branch `@if`',
	singleBranchIfFix: 'a single-branch `@if` (no `@else`)',
	ifWithElse: 'an `@if` with `@else`',

	switchArms: '`@switch` arms',
	caseWithoutOutput: 'A `@case` or `@default` arm with no output element',
	switchNoArms: 'A `@switch` with no `@case` or `@default` arm',
	caseLabel: '`@case`',

	reactiveConditional: 'An `@if` or `@switch` that reads a signal',

	tryBody: '`@try` body',
	pendingArm: '`@pending` arm',
	catchArm: '`@catch` arm',
	boundary: '`@try`/`@catch`/`@pending` boundary',
	asyncBoundary: 'An async `@try` boundary (one with `@pending`)',

	loop: '`@for`',
	aLoop: 'A `@for` loop',
	loopBodyStatements:
		'A statement other than a `const` declaration in a `@for` body',
	loopBindings: 'A loop variable or key binding',
	keyBindingShape:
		'A reactive-list `@for` key clause that is not a bare identifier',
	keyBindingExample: '`key k`',
	emptyArm: '`@empty` arm',
	emptyArmFix: "the loop's own `@empty` arm",
	loopInBranch: branch => ({
		inside: `an \`@${branch}\` branch`,
		outOf: 'the branch',
	}),
}

const TSX: SurfaceWording = {
	noComponent:
		'no exported component function found (one per file, setup statements then a single `return <jsx/>`).',
	outputShape:
		"the return value must be a single root element (the component's custom-element tag).",
	outputLabel: 'the template return',

	lazyChild: 'A lazy child expression',
	controlFlow:
		'A control-flow expression (a ternary, `.map()`, `switch` or `<truc:try>`)',
	composedPosition: "a `.map()` loop's output root",
	conditionalTag: '{level === 2 ? <h2>…</h2> : <h3>…</h3>}',

	stylesheetForm:
		'a `css`-tagged template literal, ``<style>{css`…`}</style>``, with `css` imported from `@zeix/le-truc-compiler/macros`',

	ifCondition: 'A conditional test',
	switchDiscriminant: 'A `switch` discriminant',

	if: 'conditional',
	separateIfs: 'separate conditionals',
	thenBranch: 'truthy branch',
	elseBranch: 'falsy branch',
	ifBranch: 'conditional branch',
	ifBranches: 'conditional branches',
	singleBranchIf: 'a single-branch conditional',
	singleBranchIfFix: 'a single-branch `{cond && <el/>}`',
	ifWithElse: 'a ternary',

	switchArms: '`switch` cases',
	caseWithoutOutput: 'A `switch` case with no output element',
	switchNoArms: 'A `switch` with no `case` or `default` clause',
	caseLabel: '`case`',

	reactiveConditional: 'A conditional or `switch` that reads a signal',

	tryBody: '`<truc:try>` content',
	pendingArm: '`pending` arm',
	catchArm: '`catch` arm',
	boundary: '`<truc:try>` boundary',
	asyncBoundary: 'An async `<truc:try>` boundary (one with `pending`)',

	loop: '`.map()`',
	aLoop: 'A `.map()` loop',
	loopBodyStatements:
		'A statement other than a `const` declaration in a `.map()` body',
	loopBindings: 'A loop variable or key binding',
	keyBindingShape:
		'A reactive-list `.map()` key parameter that is not a bare identifier',
	keyBindingExample: '`(item, k)`',
	emptyArm: 'empty-state arm',
	emptyArmFix:
		'the empty-state idiom (`{items.length === 0 ? <empty/> : items.map(…)}`)',
	loopInBranch: branch =>
		branch === 'if'
			? { inside: 'a conditional branch', outOf: 'the conditional' }
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
