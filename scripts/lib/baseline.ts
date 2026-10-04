/**
 * The baseline guard (LT-305, REQUIREMENTS § Browser support).
 *
 * Each runtime major pins a Baseline year (`leTruc.baseline` in the root
 * `package.json`; 3.0 → 2023). This module scans what ships — TypeScript
 * sources and emitted CSS — for web-platform features, resolves each one to
 * its Baseline date through `web-features`, and reports every feature newer
 * than the pinned year that is not allowlisted by name.
 *
 * Scanner choice: a direct `web-features` mapping. Every feature in
 * `web-features` lists its `@mdn/browser-compat-data` keys with a per-key
 * Baseline status (`status.by_compat_key`), so a scanner that can name the
 * BCD key of a use site needs nothing else. TypeScript's checker (already a
 * dependency) resolves a member access's receiver to the platform interface
 * names BCD keys use (`api.ElementInternals.states`,
 * `javascript.builtins.Promise.withResolvers`), through mixins and base
 * interfaces; css-tree (already a dependency) names properties, values,
 * at-rules, selectors and functions in CSS. A browserslist query fed to a
 * compat linter would add a lint stack that covers only a curated API subset
 * and no CSS.
 *
 * The CLI (`scripts/check-baseline.ts`) decides what is judged: the
 * library in full, and of the compiled corpus only what the compiler added
 * — author code is the author's own baseline.
 *
 * Coverage limits: a use the scanner cannot name is not checked — a member
 * read through `any`, a computed key, a syntax form outside `SYNTAX_KEYS`, a
 * CSS feature inside a block css-tree folds into a Raw node.
 */

import { readFileSync } from 'node:fs'
import { parse } from 'css-tree/dist/csstree.esm.js'
import { Features, transform } from 'lightningcss-wasm'
import ts from 'typescript'
import { features } from 'web-features'

/* === Types === */

/** One compat key's Baseline status, as `web-features` records it. */
export type CompatStatus = {
	baseline: 'high' | 'low' | false
	baseline_low_date?: string
}

/** One use site of a web-platform feature. */
export type Finding = {
	/** The `@mdn/browser-compat-data` key (`api.CustomStateSet.add`). */
	key: string
	/** Where the use sits: `path:line:column` (1-based). */
	at: string
	/** The use's character offset in its file. */
	offset: number
}

export type BaselineReport = {
	/** Uses newer than the pinned year and not allowlisted. */
	violations: (Finding & { since: string })[]
	/** Allowlisted keys the scan saw, with every use site. */
	allowed: Map<string, Finding[]>
	/** Allowlist entries the scan never saw, or that are within the pin now. */
	stale: string[]
}

/* === Allowlist === */

/**
 * Features newer than the pin that shipped code uses behind a guard, or
 * whose per-key status is a known gap in the compat data. Exact compat keys,
 * each with the reason it is safe — never a pattern.
 */
export const BASELINE_ALLOWLIST: Readonly<Record<string, string>> = {
	'api.CustomElementRegistry.get':
		'Compat-data gap: the key records no Safari support, though Safari has shipped get() alongside define() since 10.1; its feature, autonomous-custom-elements, is Baseline 2020.',
	'api.ElementInternals.states':
		'bindState() reads internals?.states once at bind time and becomes a no-op when it is absent (src/bindings.ts).',
	'api.CustomStateSet.add':
		'Called only after bindState() verified states.add is a function (src/bindings.ts).',
	'api.CustomStateSet.delete':
		'Called only after bindState() verified states.delete is a function (src/bindings.ts).',
}

/* === Baseline index === */

let index: Map<string, CompatStatus> | undefined

/** Every compat key `web-features` knows, with its own Baseline status. */
export const compatIndex = (): Map<string, CompatStatus> => {
	if (index) return index
	index = new Map()
	for (const feature of Object.values(features)) {
		if (feature.kind !== 'feature') continue
		for (const [key, status] of Object.entries(
			feature.status.by_compat_key ?? {},
		))
			index.set(key, status as CompatStatus)
	}
	return index
}

/** The year a status became Baseline, or `null` when it is not Baseline. */
export const baselineYear = (status: CompatStatus): number | null => {
	if (!status.baseline || !status.baseline_low_date) return null
	// Dates BCD cannot pin exactly carry a `≤` prefix.
	return Number(status.baseline_low_date.replace(/^\D+/, '').slice(0, 4))
}

/** Whether a status is Baseline in or before `year`. */
export const withinBaseline = (status: CompatStatus, year: number): boolean => {
	const since = baselineYear(status)
	return since !== null && since <= year
}

/* === TypeScript scan === */

/**
 * Syntax forms newer than ES2020, by the compat key that tracks them. A
 * syntax form absent here goes unchecked.
 */
export const SYNTAX_KEYS = {
	staticBlock: 'javascript.classes.static.initialization_blocks',
	using: 'javascript.statements.using',
	awaitUsing: 'javascript.statements.await_using',
	importAttributes: 'javascript.statements.import.import_attributes',
	privateIn: 'javascript.classes.private_class_fields_in',
	topLevelAwait: 'javascript.operators.await.top_level',
	regexUnicodeSets: 'javascript.builtins.RegExp.unicodeSets',
	regexHasIndices: 'javascript.builtins.RegExp.hasIndices',
	regexDotAll: 'javascript.builtins.RegExp.dotAll',
	regexModifier: 'javascript.regular_expressions.modifier',
} as const

const REGEX_FLAG_KEYS: Record<string, string> = {
	v: SYNTAX_KEYS.regexUnicodeSets,
	d: SYNTAX_KEYS.regexHasIndices,
	s: SYNTAX_KEYS.regexDotAll,
}

/** Interface names BCD files under another name. */
const INTERFACE_ALIASES = new Map([
	['ReadonlyArray', 'Array'],
	['ReadonlyMap', 'Map'],
	['ReadonlySet', 'Set'],
])

const COMPILER_OPTIONS: ts.CompilerOptions = {
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	allowImportingTsExtensions: true,
	noEmit: true,
	strict: true,
	skipLibCheck: true,
	// The platform libraries only: `@types/bun` and `@types/node` would put
	// non-browser declarations behind the same names.
	lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
	types: [],
}

/** Whether a symbol is declared only by a TypeScript platform library. */
const isPlatformSymbol = (
	program: ts.Program,
	symbol: ts.Symbol | undefined,
): boolean => {
	const declarations = symbol?.declarations
	return (
		!!declarations?.length &&
		declarations.every(d =>
			program.isSourceFileDefaultLibrary(d.getSourceFile()),
		)
	)
}

/** Interface names a receiver type answers to, nearest first. */
const receiverNames = (checker: ts.TypeChecker, type: ts.Type): string[] => {
	const names: string[] = []
	const seen = new Set<ts.Type>()
	const queue: ts.Type[] = [type]
	while (queue.length) {
		const current = queue.shift() as ts.Type
		if (seen.has(current)) continue
		seen.add(current)
		if (current.isUnionOrIntersection()) {
			queue.push(...current.types)
			continue
		}
		const apparent = checker.getApparentType(current)
		const target =
			(apparent as ts.TypeReference).target ?? (apparent as ts.Type)
		const name = (target.getSymbol() ?? apparent.getSymbol())?.name
		if (name && !name.startsWith('__')) names.push(name)
		if (target.isClassOrInterface()) queue.push(...checker.getBaseTypes(target))
	}
	return names
}

/** The compat keys a member of an interface may be filed under. */
const memberCandidates = (owner: string, member: string): string[] => {
	const base = INTERFACE_ALIASES.get(owner) ?? owner
	// `ObjectConstructor` holds `Object`'s statics.
	const name = base.endsWith('Constructor')
		? base.slice(0, -'Constructor'.length)
		: base
	return [`api.${name}.${member}`, `javascript.builtins.${name}.${member}`]
}

const isFunctionLike = (node: ts.Node): boolean =>
	ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node)

const hasDeclareModifier = (node: ts.Node): boolean =>
	ts.canHaveModifiers(node) &&
	!!ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword)

/** Whether a subtree is type-only and never reaches the shipped JavaScript. */
const isTypeOnly = (node: ts.Node): boolean => {
	if (ts.isExpressionWithTypeArguments(node))
		return (
			ts.isHeritageClause(node.parent) &&
			node.parent.token === ts.SyntaxKind.ImplementsKeyword
		)
	return (
		ts.isTypeNode(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		hasDeclareModifier(node) ||
		(ts.isImportDeclaration(node) && !!node.importClause?.isTypeOnly) ||
		(ts.isExportDeclaration(node) && node.isTypeOnly)
	)
}

/**
 * Scan TypeScript sources for web-platform features. `files` are scanned;
 * modules they import are type-checked for resolution but not scanned.
 * `paths` maps bare specifiers the way the shipped bundle resolves them.
 */
export const scanTypeScript = (
	files: string[],
	options: { root: string; paths?: Record<string, string[]> },
): Finding[] => {
	const program = ts.createProgram(files, {
		...COMPILER_OPTIONS,
		baseUrl: options.root,
		paths: options.paths ?? {},
	})
	const checker = program.getTypeChecker()
	const keys = compatIndex()
	const findings: Finding[] = []

	for (const file of files) {
		const source = program.getSourceFile(file)
		if (!source) throw new Error(`The baseline scan could not load ${file}.`)
		const report = (key: string, node: ts.Node) => {
			const { line, character } = source.getLineAndCharacterOfPosition(
				node.getStart(source),
			)
			findings.push({
				key,
				at: `${file}:${line + 1}:${character + 1}`,
				offset: node.getStart(source),
			})
		}
		const reportFirstKnown = (candidates: string[], node: ts.Node) => {
			const key = candidates.find(k => keys.has(k))
			if (key) report(key, node)
		}

		const member = (
			node: ts.Node,
			receiver: ts.Expression,
			nameNode: ts.Node,
			name: string,
		) => {
			const symbol = checker.getSymbolAtLocation(nameNode)
			if (!isPlatformSymbol(program, symbol)) return
			const owners = receiverNames(checker, checker.getTypeAtLocation(receiver))
			const parent = symbol?.declarations?.[0]?.parent
			if (parent && ts.isInterfaceDeclaration(parent))
				owners.push(parent.name.text)
			reportFirstKnown(
				owners.flatMap(owner => memberCandidates(owner, name)),
				node,
			)
		}

		const visit = (node: ts.Node): void => {
			if (isTypeOnly(node)) return

			if (ts.isPropertyAccessExpression(node)) {
				member(node, node.expression, node.name, node.name.text)
			} else if (
				ts.isElementAccessExpression(node) &&
				ts.isStringLiteralLike(node.argumentExpression)
			) {
				member(
					node,
					node.expression,
					node.argumentExpression,
					node.argumentExpression.text,
				)
			} else if (
				ts.isIdentifier(node) &&
				!(
					ts.isPropertyAccessExpression(node.parent) &&
					node.parent.name === node
				)
			) {
				const symbol = checker.getSymbolAtLocation(node)
				const declaration = symbol?.declarations?.[0]
				if (
					isPlatformSymbol(program, symbol) &&
					declaration &&
					(ts.isVariableDeclaration(declaration) ||
						ts.isFunctionDeclaration(declaration))
				)
					reportFirstKnown(
						[
							`api.${node.text}`,
							`javascript.builtins.${node.text}`,
							`api.Window.${node.text}`,
						],
						node,
					)
			} else if (ts.isClassStaticBlockDeclaration(node)) {
				report(SYNTAX_KEYS.staticBlock, node)
			} else if (ts.isVariableDeclarationList(node)) {
				const flags = node.flags & ts.NodeFlags.BlockScoped
				if (flags === ts.NodeFlags.AwaitUsing)
					report(SYNTAX_KEYS.awaitUsing, node)
				else if (flags === ts.NodeFlags.Using) report(SYNTAX_KEYS.using, node)
			} else if (
				(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
				node.attributes
			) {
				report(SYNTAX_KEYS.importAttributes, node)
			} else if (
				ts.isCallExpression(node) &&
				node.expression.kind === ts.SyntaxKind.ImportKeyword &&
				node.arguments.length > 1
			) {
				report(SYNTAX_KEYS.importAttributes, node)
			} else if (
				ts.isBinaryExpression(node) &&
				node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
				ts.isPrivateIdentifier(node.left)
			) {
				report(SYNTAX_KEYS.privateIn, node)
			} else if (
				ts.isAwaitExpression(node) ||
				(ts.isForOfStatement(node) && node.awaitModifier)
			) {
				let scope: ts.Node | undefined = node.parent
				while (scope && !isFunctionLike(scope)) scope = scope.parent
				if (!scope) report(SYNTAX_KEYS.topLevelAwait, node)
			} else if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
				const text = node.getText(source)
				const slash = text.lastIndexOf('/')
				for (const flag of text.slice(slash + 1)) {
					const key = REGEX_FLAG_KEYS[flag]
					if (key) report(key, node)
				}
				if (/(?:^|[^\\])\(\?[ims]*-?[ims]+:/.test(text.slice(1, slash)))
					report(SYNTAX_KEYS.regexModifier, node)
			}
			ts.forEachChild(node, visit)
		}
		visit(source)
	}
	return findings
}

/* === CSS scan === */

type CssNode = {
	type: string
	name?: unknown
	property?: unknown
	unit?: string
	loc?: { start: { line: number; column: number; offset: number } }
	children?: Iterable<CssNode>
	prelude?: CssNode | null
	block?: CssNode | null
	condition?: CssNode | null
	value?: CssNode | string
}

/** Where BCD files a CSS function's compat key, by the function's type. */
const CSS_FUNCTION_GROUPS = [
	'css.types',
	'css.types.color',
	'css.types.gradient',
	'css.types.image',
	'css.types.transform-function',
	'css.types.basic-shape',
	'css.types.easing-function',
	'css.types.filter-function',
]

/** Viewport units BCD files as a group rather than by unit. */
const VIEWPORT_UNIT_GROUPS: Record<string, string> = {
	d: 'css.types.length.viewport_percentage_units_dynamic',
	l: 'css.types.length.viewport_percentage_units_large',
	s: 'css.types.length.viewport_percentage_units_small',
}

const unprefixed = (name: string): string | undefined =>
	name.startsWith('-') ? undefined : name.toLowerCase()

/** Scan a stylesheet's text for web-platform features. */
export const scanCss = (text: string, file: string): Finding[] => {
	const keys = compatIndex()
	const findings: Finding[] = []
	const ast = parse(text, { positions: true }) as unknown as CssNode
	const report = (candidates: string[], node: CssNode) => {
		const key = candidates.find(k => keys.has(k))
		if (!key) return
		const start = node.loc?.start
		findings.push({
			key,
			at: `${file}:${start?.line}:${start?.column}`,
			offset: start?.offset ?? 0,
		})
	}

	const visit = (node: CssNode, property: string | undefined): void => {
		const name =
			typeof node.name === 'string' ? unprefixed(node.name) : undefined
		switch (node.type) {
			case 'Atrule':
				if (name) report([`css.at-rules.${name}`], node)
				break
			case 'PseudoClassSelector':
			case 'PseudoElementSelector':
				if (name) report([`css.selectors.${name}`], node)
				break
			case 'NestingSelector':
				report(['css.selectors.nesting'], node)
				break
			case 'Feature':
				if (name) report([`css.at-rules.media.${name}`], node)
				break
			case 'Declaration': {
				const prop =
					typeof node.property === 'string'
						? unprefixed(node.property)
						: undefined
				if (prop?.startsWith('--')) return
				if (prop) report([`css.properties.${prop}`], node)
				property = prop
				break
			}
			case 'Identifier':
				if (property && name)
					report([`css.properties.${property}.${name}`], node)
				break
			case 'Function':
				if (name)
					report(
						CSS_FUNCTION_GROUPS.map(group => `${group}.${name}`),
						node,
					)
				break
			case 'Dimension': {
				const unit = node.unit?.toLowerCase()
				if (!unit) break
				const viewport = /^([dls])v(?:h|w|i|b|min|max)$/.exec(unit)
				report(
					viewport
						? [VIEWPORT_UNIT_GROUPS[viewport[1] as string] as string]
						: [`css.types.length.${unit}`],
					node,
				)
				break
			}
		}
		if (node.prelude && typeof node.prelude === 'object')
			visit(node.prelude, property)
		if (node.block) visit(node.block, property)
		if (node.condition) visit(node.condition, property)
		if (node.value && typeof node.value === 'object')
			visit(node.value, property)
		if (node.children) for (const child of node.children) visit(child, property)
	}
	visit(ast, undefined)
	return findings
}

export const scanCssFile = (path: string, label = path): Finding[] =>
	scanCss(readFileSync(path, 'utf8'), label)

/**
 * Flatten a stylesheet's nesting and nothing else. css-tree folds nested
 * rules into Raw nodes, so an authored sheet is flattened before it is
 * scanned (the emitted sheet already is).
 */
export const flattenNesting = (css: string): string =>
	new TextDecoder().decode(
		transform({
			code: new TextEncoder().encode(css),
			filename: 'authored.css',
			include: Features.Nesting,
		}).code,
	)

/* === Evaluation === */

/** Judge findings against the pinned year and the allowlist. */
export const evaluateBaseline = (
	findings: Finding[],
	year: number,
	allowlist: Readonly<Record<string, string>> = BASELINE_ALLOWLIST,
): BaselineReport => {
	const keys = compatIndex()
	const violations: BaselineReport['violations'] = []
	const allowed: BaselineReport['allowed'] = new Map()
	for (const finding of findings) {
		const status = keys.get(finding.key)
		if (!status || withinBaseline(status, year)) continue
		if (Object.hasOwn(allowlist, finding.key)) {
			allowed.set(finding.key, [...(allowed.get(finding.key) ?? []), finding])
			continue
		}
		violations.push({
			...finding,
			since: status.baseline_low_date ?? 'not Baseline',
		})
	}
	const stale = Object.keys(allowlist).filter(key => !allowed.has(key))
	return { violations, allowed, stale }
}

/* === Pin === */

/** What `package.json` declares: the version and the pinned year. */
export type PinnedRelease = { version: string; baseline: unknown }

/** The `leTruc.baseline` pin of a parsed `package.json`. */
export const readPin = (pkg: {
	version?: string
	leTruc?: { baseline?: unknown }
}): PinnedRelease => ({
	version: String(pkg.version ?? ''),
	baseline: pkg.leTruc?.baseline,
})

const majorOf = (version: string): number => Number(version.split('.')[0])

/**
 * Check the pin, and that it moved only with a major version. `reference`
 * is the latest release; one that predates the pin constrains nothing.
 * Returns the problems found; none means the pin holds.
 */
export const checkPin = (
	current: PinnedRelease,
	reference: PinnedRelease | undefined,
): string[] => {
	const year = current.baseline
	if (typeof year !== 'number' || !Number.isInteger(year) || year < 2015)
		return [
			`package.json "leTruc.baseline" must be a Baseline year such as 2023 — received ${JSON.stringify(year)}. Pin the year the runtime major targets (REQUIREMENTS § Browser support).`,
		]
	if (!reference || reference.baseline === undefined) return []
	if (
		reference.baseline !== year &&
		majorOf(current.version) <= majorOf(reference.version)
	)
		return [
			`package.json "leTruc.baseline" moved from ${JSON.stringify(reference.baseline)} (v${reference.version}) to ${year} without a major version bump (now v${current.version}). Only a new runtime major may move the baseline — restore ${JSON.stringify(reference.baseline)}, or bump the major version.`,
		]
	return []
}
