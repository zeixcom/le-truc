/**
 * LT-465 probe sheets and DOM. Every declaration is an assertion: each rule
 * sets one non-inherited property to a value naming the rule.
 */
export const P_SHEET = `
:host { background-color: rgb(6, 0, 0); }
.x { border-top-color: rgb(1, 0, 0); }
.wrap .x { border-right-color: rgb(2, 0, 0); }
:host .x { border-bottom-color: rgb(3, 0, 0); }
:host(.on) .x { border-left-color: rgb(4, 0, 0); }
pre, code { outline-color: rgb(5, 0, 0); }
`
/** Shape (c): the parent styles its children from `:global` (the codeblock precedent). */
export const P_GLOBAL = `:global { p-par .x { column-rule-color: rgb(7, 0, 0); } }`
export const C_SHEET = `
.x, span { text-decoration-color: rgb(0, 1, 0); }
code { column-rule-color: rgb(0, 2, 0); }
`
export const B_SHEET = `.x { background-color: rgb(0, 0, 1); }`
/** Page rules, before the component CSS: (0,1,1) beats `.x`; (0,1,0) loses to `.wrap .x`. */
export const PAGE = `
p.x, span.x, i.x { border-top-color: rgb(9, 9, 1); }
.x { border-right-color: rgb(9, 9, 2); }
`

export const P_BOUNDARIES = ['c-child', 'b-btn', 'p-par']

/**
 * A (p-par, .on) composes c-child, passing children: a span, a composed
 * b-btn and a self-composed A′ that passes its own children. c-child's
 * template is `<pre><code>{children}</code></pre><span class="x">`.
 * A page-rendered c-child (no compiled owner) closes the page.
 */
export const html = (mark: boolean, wrap: boolean): string => {
	const region = (owner: string, inner: string, codeId: string) =>
		wrap
			? `<code id="${codeId}"><div ${mark ? `data-children="${owner}" ` : ''}style="display: contents">${inner}</div></code>`
			: `<code id="${codeId}"${mark ? ` data-children="${owner}"` : ''}>${inner}</code>`
	return `
<p-par id="A" class="on"><div class="wrap">
  <p class="x" id="own">own</p>
  <c-child id="C"><pre id="pre">${region(
		'p-par',
		`<span class="x" id="kid">kid</span>
     <b-btn><i class="x" id="btnint">btn</i></b-btn>
     <p-par id="A2"><p class="x" id="own2">own2</p>
       <c-child><pre>${region('p-par', '<span class="x" id="kid2">kid2</span>', 'code2')}</pre></c-child>
     </p-par>`,
		'code',
	)}</pre><span class="x" id="childint">child internal</span></c-child>
</div></p-par>
<c-child id="Ctop"><pre><code id="codetop"><span class="x" id="pagekid">page-authored</span></code></pre></c-child>`
}

export const PROBED = [
	'A',
	'own',
	'kid',
	'btnint',
	'own2',
	'kid2',
	'childint',
	'pre',
	'code',
	'pagekid',
] as const

/** Which rule set each property, by the value it carries. */
export const RULES: Record<string, [string, string][]> = {
	'border-top-color': [
		['P .x', 'rgb(1, 0, 0)'],
		['page>P', 'rgb(9, 9, 1)'],
	],
	'border-right-color': [
		['P .wrap .x', 'rgb(2, 0, 0)'],
		['page<P', 'rgb(9, 9, 2)'],
	],
	'border-bottom-color': [['P :host .x', 'rgb(3, 0, 0)']],
	'border-left-color': [['P :host(.on) .x', 'rgb(4, 0, 0)']],
	'outline-color': [['P pre,code', 'rgb(5, 0, 0)']],
	'background-color': [
		['P :host', 'rgb(6, 0, 0)'],
		['B .x', 'rgb(0, 0, 1)'],
	],
	'column-rule-color': [
		['P :global', 'rgb(7, 0, 0)'],
		['C code', 'rgb(0, 2, 0)'],
	],
	'text-decoration-color': [['C .x', 'rgb(0, 1, 0)']],
}
