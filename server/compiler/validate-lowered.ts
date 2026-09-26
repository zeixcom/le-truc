/**
 * The post-lowering validation tail, shared by both front ends (LT-202,
 * ADR 0032 sub-design 6: the anti-drift half of the dual front-end
 * contract): every check that needs the lowered `root`, `config`, or the
 * extracted `expose()` argument. Front-end-neutral like the other
 * front-end stage modules: no parser values, only the loose `AstNode`
 * type.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	identifierName,
	MANAGED_FORM_MEMBERS,
	RESERVED_PROP_NAMES,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import { reportDuplicatedChannels } from './first-refs'
import { reportMessageCallSites } from './i18n'
import type { MessageArg } from './icu/parse'
import type { ConfigIR, ExtractContext, ForIR, TemplateNode } from './ir'
import type { SetupExtraction } from './setup-extraction'
import { wordingOf } from './surface'
import { walkTemplate } from './walk'

/** Native form-control tags whose own `name` would double-submit (LT-059). */
const NAMED_FORM_CONTROL_TAGS: ReadonlySet<string> = new Set([
	'input',
	'select',
	'textarea',
	'button',
])

/**
 * Report a `name` (static or bound) on a descendant `input`/`select`/
 * `textarea`/`button` inside a form-associated component's template
 * (LT-059, CHECKLIST §7): the inner control stays out of NATIVE form
 * submission only because it's unnamed — the host submits via
 * `setFormValue` instead. A named inner control submits the field TWICE:
 * once via `setFormValue`, once natively. The markup looks entirely
 * reasonable and the failure is server-side (a duplicate form field) and
 * invisible in the browser, so this is a compiler error, not a doc note.
 *
 * Walks the already-lowered template IR (post-lowering) directly —
 * `kind: 'element'` nodes only; composed children are the child's own
 * template, a boundary, same as `first-refs.ts`'s `collectMatchingElements`.
 * Only `static`/`server`/`reactive` attribute kinds represent a real HTML
 * `name` value; `ref`/`event`/`pass`/etc. carry a `.name` field with a
 * different meaning (a JS binding or event name) and must not match.
 */
const reportNamedFormControls = (
	ctx: ExtractContext,
	root: TemplateNode,
): void => {
	const visit = (node: TemplateNode): void => {
		if (node.kind === 'element') {
			if (NAMED_FORM_CONTROL_TAGS.has(node.tag)) {
				const nameAttr = node.attrs.find(
					a =>
						(a.kind === 'static' ||
							a.kind === 'server' ||
							a.kind === 'reactive') &&
						a.name === 'name',
				)
				if (nameAttr)
					ctx.diagnostics.push(
						diagnostic.formControlHasName(
							ctx.source,
							node.node.start,
							node.tag,
						),
					)
			}
			for (const child of node.children) visit(child)
			return
		}
		if (node.kind === 'if') {
			for (const child of node.then) visit(child)
			for (const child of node.alternate) visit(child)
			return
		}
		if (node.kind === 'switch') {
			for (const arm of node.cases)
				for (const child of arm.children) visit(child)
			return
		}
		if (node.kind === 'try') {
			for (const child of node.children) visit(child)
			for (const child of node.catchChildren) visit(child)
			if (node.pendingChildren)
				for (const child of node.pendingChildren) visit(child)
			return
		}
		// 'compose', 'text', 'expr', 'client-stmt' — nothing to check/recurse.
	}
	visit(root)
}

/**
 * Report a loop whose output is a direct root of an `if`/`switch` branch
 * (LT-301) — `.tsrx` `@if (…) { … } @else { @for … }`, `.tsx`
 * `{c ? <>{xs.map(…)}</> : …}` (fragments flatten, so the loop's items land
 * as the arm's roots). The server renders it correctly, but the client
 * addresses a branch by its roots: it binds the loop output with `first()`,
 * so only the first item gets its handlers. A loop wrapped in an element
 * inside the branch is not this shape: the wrapper is the branch root, and
 * a client construct inside it is already LTC005 (analysis/effects.ts,
 * "must sit on the branch root elements"). A loop's `@empty` arm is not a
 * branch, so the empty-state spellings stay legal.
 */
const reportLoopsInBranches = (
	ctx: ExtractContext,
	root: TemplateNode,
	fors: ReadonlyMap<AstNode, ForIR>,
): void => {
	const outputs = new Set<TemplateNode>([...fors.values()].map(f => f.output))
	walkTemplate(root, (node, parent) => {
		if (
			outputs.has(node) &&
			(parent?.kind === 'if' || parent?.kind === 'switch')
		)
			ctx.diagnostics.push(
				diagnostic.loopInBranch(
					ctx.source,
					node.node?.start,
					wordingOf(ctx),
					parent.kind,
				),
			)
	})
}

/**
 * The post-lowering validation tail, shared by both front ends. Runs after
 * `resolveTemplateOutput` and `readModuleDecls` because every check below
 * needs `root`, `config`, or `exposeArgNode`:
 *
 * - LTC039 (LT-122): one value, two channels. Skips the ROOT element (the
 *   root is the host, so a Parser prop rendered as its attribute is the
 *   correct channel) and the sanctioned override (LT-141); a
 *   `formAssociated()`/`formAssociatedCheckbox()` host's reserved prop
 *   (`value`/`checked`) is a third exclusion — the root's own content
 *   attribute is the reset baseline, not a duplicate copy.
 * - LTC047 (LT-173, ADR 0030 sub-design 4): literal prose inside a
 *   component that declared `export const i18n`. Author-fixable, so a
 *   genuine compile warning that converges to zero — unlike a missing
 *   translation, which rides the build report's translation census instead.
 *   Two or more adjacent letters is the prose test: a single-letter fragment
 *   (basic-pluralize's `s` suffix spans) is per-instance page data, not
 *   catalog material.
 * - The static `truc:case-type` configuration (LT-190) for the translation
 *   census's reachability filter (effects/i18n.ts).
 * - LTC055 (LT-250, ADR 0030 s4): every `t.<key>` site against the key's
 *   parsed ICU pattern — called with exactly its arguments, or read bare
 *   when it takes none (`reportMessageCallSites`, i18n.ts).
 * - `config.observedAttributes` must name Parser-exposed props only — a
 *   name that is not Parser-exposed would make the extension silently
 *   inert.
 * - LTC028 (LT-157a): an expose() key that is a reserved word or Object
 *   builtin. Ungated: the runtime throws `InvalidPropertyNameError` before
 *   its `prop in this` guard, and since LT-155 contains that throw, this
 *   rule is what the author actually sees.
 * - The LTC010 family (LT-058): a form-associated component's expose()
 *   naming a member the extension installs on the prototype — silently
 *   shadows it at the JS level. `value`/`checked` (config.form) are the
 *   deliberate exceptions the component MUST expose; the variant's own
 *   reset-baseline prop (`defaultValue`/`defaultChecked`, LT-057) is
 *   reserved too.
 * - LT-059: a form-associated component's inner native control must have
 *   no `name`.
 * - LT-301: a loop inside an `if`/`switch` branch is LTC005.
 *
 * Returns the caseType configuration the IR carries.
 */
export const validateLoweredComponent = (
	ctx: ExtractContext,
	{
		root,
		config,
		i18nMessages,
		i18nArgs,
		componentFn,
		extraction,
		fors,
	}: {
		root: TemplateNode & { kind: 'element' }
		config: ConfigIR | null
		i18nMessages: Record<string, string> | null
		i18nArgs: Record<string, readonly MessageArg[]> | null
		componentFn: AstNode
		extraction: SetupExtraction
		fors: ReadonlyMap<AstNode, ForIR>
	},
): 'cardinal' | 'ordinal' | 'union' => {
	const source = ctx.source
	const exposeArgNode = extraction.exposeArgNode

	reportDuplicatedChannels({
		root,
		source,
		diagnostics: ctx.diagnostics,
		argNames: ctx.argNames,
		parserProps: ctx.parserProps,
		parserFactoryOf: ctx.parserFactoryOf,
		parserFallbackRefsOf: ctx.parserFallbackRefsOf,
		formResetProp: config?.form
			? config.form === 'value'
				? 'value'
				: 'checked'
			: null,
	})

	if (i18nMessages)
		walkTemplate(root, node => {
			if (node.kind !== 'text' || !/[A-Za-z]{2}/.test(node.value)) return
			ctx.diagnostics.push(
				diagnostic.untranslatedLiteral(source, node.node?.start, node.value),
			)
		})

	if (i18nArgs) reportMessageCallSites(ctx, componentFn, i18nArgs)

	// LT-190: a literal `'ordinal'`/`'cardinal'` — or an explicit
	// `undefined`, which is cardinal by Intl's own default — proves the
	// pruning type; a dynamic expression (basic-pluralize's
	// `ordinal ? 'ordinal' : undefined`) or no declaration at all stays
	// `'union'`, the runtime's own fallback, so the census only skips
	// categories NEITHER configuration reaches in a locale.
	let caseType: 'cardinal' | 'ordinal' | 'union' = 'union'
	{
		let sawType = false
		let proven: 'cardinal' | 'ordinal' | null = null
		let conflicted = false
		walkTemplate(root, node => {
			if (node.kind !== 'element') return
			for (const attr of node.attrs) {
				if (attr.kind !== 'plural-case-type') continue
				sawType = true
				const thisType: 'cardinal' | 'ordinal' | null =
					attr.exprText === '"ordinal"'
						? 'ordinal'
						: attr.exprText === '"cardinal"' || attr.exprText === 'undefined'
							? 'cardinal'
							: null
				if (thisType === null) conflicted = true
				else if (proven === null) proven = thisType
				else if (proven !== thisType) conflicted = true
			}
		})
		if (sawType && !conflicted && proven !== null) caseType = proven
	}

	if (config)
		for (const attr of config.observedAttributes) {
			if (!extraction.parserExposeProps.has(attr))
				ctx.diagnostics.push(
					diagnostic.invalidConfig(
						source,
						undefined,
						`config.observedAttributes names \`${attr}\`, which is not a Parser-exposed prop — the extension would be inert. Declare it as expose({ ${attr}: asString(…) }).`,
					),
				)
		}

	if (exposeArgNode) {
		for (const prop of asArray(exposeArgNode.properties)) {
			if (prop.type !== 'Property') continue
			const propName = identifierName(prop.key)
			if (propName && RESERVED_PROP_NAMES.has(propName))
				ctx.diagnostics.push(
					diagnostic.reservedExposeName(source, prop.start, propName),
				)
		}
	}

	if (config?.form && exposeArgNode) {
		const defaultPropName =
			config.form === 'value' ? 'defaultValue' : 'defaultChecked'
		const extensionName =
			config.form === 'value' ? 'formAssociated' : 'formAssociatedCheckbox'
		for (const prop of asArray(exposeArgNode.properties)) {
			if (prop.type !== 'Property') continue
			const propName = identifierName(prop.key)
			if (
				propName &&
				(MANAGED_FORM_MEMBERS.has(propName) || propName === defaultPropName)
			)
				ctx.diagnostics.push(
					diagnostic.managedFormMemberShadowed(
						source,
						prop.start,
						propName,
						extensionName,
					),
				)
		}
	}

	if (config?.form) reportNamedFormControls(ctx, root)

	reportLoopsInBranches(ctx, root, fors)

	return caseType
}
