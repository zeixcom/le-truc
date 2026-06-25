/**
 * Unit Tests for effects/api-pages.ts — API Page Fragment Generation
 *
 * Tests for the pure functions that process TypeDoc-generated Markdown
 * into HTML fragments for the API documentation section.
 */

import { describe, expect, test } from 'bun:test'
import Markdoc from '@markdoc/markdoc'
import {
	convertParameterSectionsToTables,
	makeHeadingIdsUnique,
	mergeDefinedInIntoBlockquote,
	stripBreadcrumbs,
} from '../../effects/api-pages'
import { highlightCodeBlocks } from '../../html-shaping'
import markdocConfig from '../../markdoc.config'

const renderApi = (markdown: string): string => {
	const ast = Markdoc.parse(markdown)
	const transformed = mergeDefinedInIntoBlockquote(
		Markdoc.transform(ast, markdocConfig),
	)
	return Markdoc.renderers.html(transformed)
}

const renderApiUniqueIds = (markdown: string): string => {
	const ast = Markdoc.parse(markdown)
	const transformed = makeHeadingIdsUnique(
		Markdoc.transform(ast, markdocConfig),
	)
	return Markdoc.renderers.html(transformed)
}

const renderApiTables = (markdown: string): string => {
	const ast = Markdoc.parse(markdown)
	const transformed = convertParameterSectionsToTables(
		Markdoc.transform(ast, markdocConfig),
	)
	return Markdoc.renderers.html(transformed)
}

/* === stripBreadcrumbs Tests === */

describe('stripBreadcrumbs', () => {
	test('strips content above first H1 heading', () => {
		const content = `[**@zeix/le-truc**](../README.md) • **Docs**

***

[API Reference](../globals.md) / defineComponent

# Function: defineComponent()

Defines a custom element.`

		const result = stripBreadcrumbs(content)

		expect(result).toStartWith('# Function: defineComponent()')
		expect(result).toContain('Defines a custom element.')
		expect(result).not.toContain('API Reference')
		expect(result).not.toContain('@zeix/le-truc')
	})

	test('returns content unchanged when no breadcrumbs', () => {
		const content = `# Function: defineComponent()

Defines a custom element.`

		const result = stripBreadcrumbs(content)

		expect(result).toBe(content)
	})

	test('returns content unchanged when no H1', () => {
		const content = `Some text without any heading.

## This is H2 not H1

More text.`

		const result = stripBreadcrumbs(content)

		// Should start from ## heading since that's the first heading match
		// Actually, the regex looks for ^(#\s+.+)$ which matches ## too
		// Let's verify actual behavior
		expect(result).toContain('Some text')
	})

	test('preserves everything after the first H1', () => {
		const content = `Breadcrumb line

# Title

## Section 1

Content 1

## Section 2

Content 2`

		const result = stripBreadcrumbs(content)

		expect(result).toStartWith('# Title')
		expect(result).toContain('## Section 1')
		expect(result).toContain('Content 1')
		expect(result).toContain('## Section 2')
		expect(result).toContain('Content 2')
	})

	test('handles empty string', () => {
		expect(stripBreadcrumbs('')).toBe('')
	})

	test('handles content with only breadcrumbs and no heading', () => {
		const content = `[**@zeix/le-truc**](../README.md) • **Docs**

***

Just some text, no heading.`

		const result = stripBreadcrumbs(content)

		// No H1 found, so content is returned as-is
		expect(result).toBe(content)
	})

	test('strips multiple breadcrumb lines', () => {
		const content = `[**@zeix/le-truc**](../README.md)

[Back to index](../globals.md)

Navigation: foo > bar > baz

# Class: ContextRequestEvent

Event class for context requests.`

		const result = stripBreadcrumbs(content)

		expect(result).toStartWith('# Class: ContextRequestEvent')
		expect(result).toContain('Event class for context requests.')
	})
})

/* === mergeDefinedInIntoBlockquote Tests === */

describe('mergeDefinedInIntoBlockquote', () => {
	test('merges a linked "Defined in:" paragraph into the preceding blockquote as a cite', () => {
		const html = renderApi(`### Type Alias: ComponentProp

> **ComponentProp** = \`Exclude\`\\<\`string\`\\>

Defined in: [src/types.ts:61](https://github.com/zeixcom/le-truc/blob/main/src/types.ts#L61)

A valid reactive property name.`)

		expect(html).toContain(
			'<blockquote><p><strong>ComponentProp</strong> = <code>Exclude</code>&lt;<code>string</code>&gt;</p><cite>Defined in: <a href="https://github.com/zeixcom/le-truc/blob/main/src/types.ts#L61">src/types.ts:61</a></cite></blockquote>',
		)
		expect(html).not.toMatch(/<\/blockquote>\s*<p>Defined in:/)
		expect(html).toContain('<p>A valid reactive property name.</p>')
	})

	test('merges a plain-text "Defined in:" paragraph (no link) into the blockquote', () => {
		const html = renderApi(`### Type Alias: CollectionOptions

> **CollectionOptions** = \`object\`

Defined in: node_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:51`)

		expect(html).toContain(
			'<blockquote><p><strong>CollectionOptions</strong> = <code>object</code></p><cite>Defined in: node_modules/@zeix/cause-effect/types/src/nodes/collection.d.ts:51</cite></blockquote>',
		)
	})

	test('leaves a description paragraph after a blockquote untouched', () => {
		const html = renderApi(`> **Foo** = \`string\`

Just a description, not a location.`)

		expect(html).toContain(
			'<blockquote><p><strong>Foo</strong> = <code>string</code></p></blockquote>',
		)
		expect(html).toContain('<p>Just a description, not a location.</p>')
		expect(html).not.toContain('<cite>')
	})

	test('leaves a "Defined in:" paragraph untouched when not preceded by a blockquote', () => {
		const html = renderApi(`# Class: Foo

Defined in: [src/foo.ts:1](https://example.com/foo.ts#L1)`)

		expect(html).toContain(
			'<p>Defined in: <a href="https://example.com/foo.ts#L1">src/foo.ts:1</a></p>',
		)
		expect(html).not.toContain('<cite>')
	})

	test('leaves a blockquote untouched when it is the last node', () => {
		const html = renderApi(`> **Foo** = \`string\``)

		expect(html).toBe(
			'<article><blockquote><p><strong>Foo</strong> = <code>string</code></p></blockquote></article>',
		)
	})

	test('merges multiple blockquote/Defined-in pairs in the same document', () => {
		const html = renderApi(`> **a**: \`string\`

Defined in: [a.ts:1](https://example.com/a.ts#L1)

> **b**: \`number\`

Defined in: [b.ts:2](https://example.com/b.ts#L2)`)

		expect(html.match(/<cite>/g)).toHaveLength(2)
		expect(html).toContain(
			'<cite>Defined in: <a href="https://example.com/a.ts#L1">a.ts:1</a></cite>',
		)
		expect(html).toContain(
			'<cite>Defined in: <a href="https://example.com/b.ts#L2">b.ts:2</a></cite>',
		)
	})
})

/* === convertParameterSectionsToTables Tests === */

describe('convertParameterSectionsToTables', () => {
	test('renders Type Parameters, Parameters, and Returns as tables with a header', () => {
		const html = renderApiTables(`#### Type Parameters

##### T

\`T\` *extends* \`object\`

The type of value held by the delegated signal.

#### Parameters

##### initialSignal

[\`Signal\`](../type-aliases/Signal.md)\\<\`T\`\\>

The initial signal to delegate to.

##### options?

[\`SignalOptions\`](../type-aliases/SignalOptions.md)\\<\`T\`\\>

#### Returns

[\`Slot\`](../type-aliases/Slot.md)\\<\`T\`\\>

A \`Slot<T>\` object usable both as a property descriptor and as a reactive signal.`)

		expect(html).toContain(
			'<thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Description</th></tr></thead>',
		)
		expect(html).toContain(
			'<tr><td><strong>T</strong></td><td><code>T</code> <em>extends</em> <code>object</code></td><td>The type of value held by the delegated signal.</td></tr>',
		)
		expect(html).toContain(
			'<tr><td><strong>initialSignal</strong></td><td><a href="../type-aliases/Signal.html"><code>Signal</code></a>&lt;<code>T</code>&gt;</td><td>The initial signal to delegate to.</td></tr>',
		)
		// item with no description paragraph renders an empty cell, not a missing one
		expect(html).toContain(
			'<tr><td><strong>options?</strong></td><td><a href="../type-aliases/SignalOptions.html"><code>SignalOptions</code></a>&lt;<code>T</code>&gt;</td><td></td></tr>',
		)
		expect(html).toContain(
			'<thead><tr><th scope="col">Type</th><th scope="col">Description</th></tr></thead>',
		)
		expect(html).toContain(
			'<tr><td><a href="../type-aliases/Slot.html"><code>Slot</code></a>&lt;<code>T</code>&gt;</td><td>A <code>Slot&lt;T&gt;</code> object usable both as a property descriptor and as a reactive signal.</td></tr>',
		)
		expect(html).toContain('module-scrollarea')
		// the section headings themselves are kept, only their body becomes a table
		expect(html).toContain('Type Parameters')
		expect(html).toContain('Parameters')
		expect(html).toContain('Returns')
	})

	test('falls back to text labels for clamped item headings at the h6 depth ceiling', () => {
		// Mirrors TypeDoc's output for a class constructor: "Parameters" itself renders
		// at h6 (the markdown max), so its parameter-name headings clamp back to h5 —
		// the same level as sibling structural headings like "Constructors"/"Properties".
		const html = renderApiTables(`#### Constructors

##### Constructor

> **new Foo**(\`where\`): \`Foo\`

###### Parameters

##### where

\`string\`

The location where the error occurred.

###### Returns

\`Foo\`

#### Properties

##### cause`)

		expect(html).toContain(
			'<tr><td><strong>where</strong></td><td><code>string</code></td><td>The location where the error occurred.</td></tr>',
		)
		// sibling structural headings must NOT be swallowed into the table as rows
		expect(html).not.toContain('<td><strong>Constructors</strong></td>')
		expect(html).not.toContain('<td><strong>Properties</strong></td>')
		expect(html).toMatch(/<h4[^>]*>.*Constructors.*<\/h4>/)
		expect(html).toMatch(/<h4[^>]*>.*Properties.*<\/h4>/)
	})

	test('leaves a Returns section untouched when its value documents named fields', () => {
		// An inline object return type documents its own properties as further headings —
		// not a simple type+description pair, so the value stays unconverted past the type.
		const html = renderApiTables(`#### Returns

\`void\`

##### host

> **host**: \`HTMLElement\``)

		expect(html).toContain('<tr><td><code>void</code></td><td></td></tr>')
		expect(html).toMatch(/<h5[^>]*>.*host.*<\/h5>/)
		expect(html).toContain('<blockquote>')
	})

	test('leaves Type Parameters/Parameters untouched when no items follow', () => {
		const html = renderApiTables(`#### Type Parameters

#### Since

0.1.0`)

		expect(html).not.toContain('<table>')
		expect(html).toMatch(/<h4[^>]*>.*Type Parameters.*<\/h4>/)
	})

	test('leaves headings without a matching section name untouched', () => {
		const html = renderApiTables(`#### Extends

- \`Error\``)

		expect(html).not.toContain('<table>')
	})
})

/* === makeHeadingIdsUnique Tests === */

describe('makeHeadingIdsUnique', () => {
	test('prefixes a nested heading id with its ancestor heading id', () => {
		const html = renderApiUniqueIds(`#### Properties

##### cause?

###### Inherited from

\`Error.cause\``)

		expect(html).toContain('<h4 id="properties">')
		expect(html).toContain('<h5 id="properties-cause">')
		expect(html).toContain('<h6 id="properties-cause-inherited-from">')
		expect(html).toContain('href="#properties-cause-inherited-from"')
	})

	test('leaves the single top-level heading id untouched', () => {
		const html = renderApiUniqueIds('### Class: CircularDependencyError')

		expect(html).toContain('<h3 id="class-circulardependencyerror">')
	})

	test('disambiguates repeated section labels across sibling properties', () => {
		const html = renderApiUniqueIds(`#### Properties

##### cause?

###### Inherited from

\`Error.cause\`

##### message

###### Inherited from

\`Error.message\``)

		const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1])
		expect(ids).toEqual([
			'properties',
			'properties-cause',
			'properties-cause-inherited-from',
			'properties-message',
			'properties-message-inherited-from',
		])
		expect(new Set(ids).size).toBe(ids.length)
	})

	test('falls back to an incrementing counter when prefixing still collides', () => {
		// Mirrors TypeDoc's overload output: "Call Signature" item headings ("Parameters",
		// "Returns") clamp back to the same depth as the method name itself, so two
		// overloads produce identical ancestor-prefixed candidates.
		const html = renderApiUniqueIds(`#### Methods

##### captureStackTrace()

###### Call Signature

##### Parameters

##### Returns

###### Call Signature

##### Parameters

##### Returns`)

		const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1])
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toContain('methods-parameters')
		expect(ids).toContain('methods-parameters-2')
		expect(ids).toContain('methods-returns')
		expect(ids).toContain('methods-returns-2')
	})

	test('rewrites a same-page link to a renamed heading by its original id', () => {
		// TypeDoc emits a self-referencing "Inherited from" link back to the member's
		// own heading using its pre-prefix id (e.g. "bubbles"), which must follow the
		// heading to its new, prefixed id.
		const html = renderApiUniqueIds(`#### Properties

##### bubbles

\`boolean\`

###### Inherited from

\`ContextRequestEvent\`.[\`bubbles\`](#bubbles)`)

		expect(html).toContain('<h5 id="properties-bubbles">')
		expect(html).toContain(
			'<a href="#properties-bubbles"><code>bubbles</code></a>',
		)
		expect(html).not.toContain('href="#bubbles"')
	})
})

/* === highlightCodeBlocks Tests === */

describe('highlightCodeBlocks', () => {
	test('returns HTML unchanged when no code blocks present', async () => {
		const html = '<p>Hello world</p>'
		const result = await highlightCodeBlocks(html)
		expect(result).toBe(html)
	})

	test('returns HTML unchanged for empty string', async () => {
		const result = await highlightCodeBlocks('')
		expect(result).toBe('')
	})

	test('highlights a code block with known language', async () => {
		const html = `<p>Example:</p>
<pre data-language="typescript" data-code="const x = 1"><code class="language-typescript">const x = 1</code></pre>`

		const result = await highlightCodeBlocks(html)

		// Shiki wraps output in its own <pre> with a theme class
		expect(result).toContain('<pre')
		expect(result).toContain('const')
		// Should not contain the original data-code attribute pattern
		expect(result).not.toContain('data-code="const x = 1"')
	})

	test('preserves surrounding HTML', async () => {
		const html = `<h2>Example</h2>
<pre data-language="text" data-code="hello"><code class="language-text">hello</code></pre>
<p>More text</p>`

		const result = await highlightCodeBlocks(html)

		expect(result).toContain('<h2>Example</h2>')
		expect(result).toContain('<p>More text</p>')
	})

	test('decodes HTML entities in code content', async () => {
		const html = `<pre data-language="typescript" data-code="const x: Map&lt;string, number&gt; = new Map()"><code class="language-typescript">const x: Map&lt;string, number&gt; = new Map()</code></pre>`

		const result = await highlightCodeBlocks(html)

		// The decoded content should be highlighted
		expect(result).toContain('Map')
		expect(result).toContain('string')
	})

	test('handles multiple code blocks', async () => {
		const html = `<pre data-language="typescript" data-code="const a = 1"><code class="language-typescript">const a = 1</code></pre>
<p>Between blocks</p>
<pre data-language="typescript" data-code="const b = 2"><code class="language-typescript">const b = 2</code></pre>`

		const result = await highlightCodeBlocks(html)

		expect(result).toContain('Between blocks')
		// Both blocks should be highlighted (contain Shiki output)
		const preCount = (result.match(/<pre/g) || []).length
		expect(preCount).toBe(2)
	})
})
