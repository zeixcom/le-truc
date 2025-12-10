/**
 * Code Block Templates
 *
 * Tagged template literals for generating code block HTML with syntax highlighting.
 * Used by the markdown plugin to transform markdown code blocks into interactive components.
 */

import { html } from './utils'

export interface CodeBlockConfig {
	lang: string
	code: string
	filename?: string
	collapsed?: boolean
	highlightedCode: string
}

export interface CodeBlockMeta {
	filename?: string
	language: string
}

export interface CodeBlockButton {
	type: 'copy' | 'expand'
	label: string
	className?: string
}

/**
 * Generate code block metadata section
 */
export function codeBlockMeta({ filename, language }: CodeBlockMeta): string {
	return html` <p class="meta">
		${filename ? html`<span class="file">${filename}</span>` : ''}
		<span class="language">${language}</span>
	</p>`
}

/**
 * Generate copy button for code blocks
 */
export function copyButton(): string {
	return html` <basic-button class="copy">
		<button type="button" class="secondary small">
			<span class="label">Copy</span>
		</button>
	</basic-button>`
}

/**
 * Generate expand button for collapsed code blocks
 */
export function expandButton(): string {
	return html`<button type="button" class="overlay">Expand</button>`
}

/**
 * Generate interactive code block button
 */
export function codeBlockButton({
	type,
	label,
	className,
}: CodeBlockButton): string {
	if (type === 'copy') {
		return copyButton()
	}

	if (type === 'expand') {
		return expandButton()
	}

	return html`<button type="button" class="${className || ''}">
		${label}
	</button>`
}

/**
 * Generate complete code block component
 */
export function codeBlock(config: CodeBlockConfig): string {
	const { lang, filename, collapsed, highlightedCode } = config
	const collapsedAttr = collapsed ? ' collapsed' : ''

	return html`
<module-codeblock${collapsedAttr} language="${lang}" copy-success="Copied!" copy-error="Error trying to copy to clipboard!">
	${codeBlockMeta({ filename, language: lang })}
	${highlightedCode}
	${copyButton()}
	${collapsed ? expandButton() : ''}
</module-codeblock>`
}

/**
 * Generate enhanced code block with additional features
 */
export function enhancedCodeBlock(
	config: CodeBlockConfig & {
		lineNumbers?: boolean
		highlightLines?: number[]
		title?: string
		theme?: string
	},
): string {
	const {
		lang,
		filename,
		collapsed,
		highlightedCode,
		lineNumbers,
		title,
		theme = 'monokai',
	} = config

	const attributes = [
		collapsed && 'collapsed',
		lineNumbers && 'line-numbers',
		theme && `theme="${theme}"`,
	]
		.filter(Boolean)
		.join(' ')

	const attributeString = attributes ? ` ${attributes}` : ''

	return html`
<module-codeblock${attributeString} language="${lang}" copy-success="Copied!" copy-error="Error trying to copy to clipboard!">
	${title ? html`<h4 class="code-title">${title}</h4>` : ''}
	${codeBlockMeta({ filename: filename || title, language: lang })}
	${highlightedCode}
	${copyButton()}
	${collapsed ? expandButton() : ''}
</module-codeblock>`
}

/**
 * Generate simple inline code element
 */
export function inlineCode(code: string, language?: string): string {
	const langClass = language ? ` class="language-${language}"` : ''
	return html`<code${langClass}>${code}</code>`
}

/**
 * Process code block transformation parameters
 */
export interface CodeBlockTransformParams {
	lang: string
	filename?: string
	code: string
	highlightedCode: string
	collapseThreshold?: number
}

/**
 * Transform code block with automatic collapse detection
 */
export function transformCodeBlock({
	lang,
	filename,
	code,
	highlightedCode,
	collapseThreshold = 10,
}: CodeBlockTransformParams): string {
	const collapsed = code.split('\n').length > collapseThreshold

	return codeBlock({
		lang,
		filename,
		code,
		collapsed,
		highlightedCode,
	})
}

/**
 * Generate placeholder for code block replacement
 */
export function createCodeBlockPlaceholder(counter: number): string {
	return `{{ codeblock-${counter} }}`
}

/**
 * Batch process multiple code blocks
 */
export function processCodeBlocks(
	codeBlocks: Array<{
		lang: string
		filename?: string
		code: string
		highlightedCode: string
	}>,
	options: {
		collapseThreshold?: number
		enhanced?: boolean
	} = {},
): Map<string, string> {
	const codeBlockMap = new Map<string, string>()
	const { collapseThreshold = 10, enhanced = false } = options

	codeBlocks.forEach((block, index) => {
		const placeholder = createCodeBlockPlaceholder(index)
		const collapsed = block.code.split('\n').length > collapseThreshold

		const config = {
			...block,
			collapsed,
		}

		const codeBlockHtml = enhanced
			? enhancedCodeBlock(config)
			: codeBlock(config)

		codeBlockMap.set(placeholder, codeBlockHtml.trim())
	})

	return codeBlockMap
}

/**
 * Validate code block configuration
 */
export function validateCodeBlockConfig(config: CodeBlockConfig): {
	valid: boolean
	errors: string[]
} {
	const errors: string[] = []

	if (!config.lang) {
		errors.push('Language is required')
	}

	if (!config.code) {
		errors.push('Code content is required')
	}

	if (!config.highlightedCode) {
		errors.push('Highlighted code is required')
	}

	if (config.filename && typeof config.filename !== 'string') {
		errors.push('Filename must be a string')
	}

	if (config.collapsed !== undefined && typeof config.collapsed !== 'boolean') {
		errors.push('Collapsed must be a boolean')
	}

	return { valid: errors.length === 0, errors }
}

/**
 * Extract language and filename from code block header
 */
export function parseCodeBlockHeader(header: string): {
	lang: string
	filename?: string
} {
	// Match patterns like: js, js (filename.js), typescript (src/main.ts)
	const match = header.match(/^(\w+)(?:\s*\(([^)]+)\))?$/)

	if (!match) {
		return { lang: header.trim() || 'text' }
	}

	const [, lang, filename] = match
	return {
		lang: lang || 'text',
		filename: filename?.trim(),
	}
}

/**
 * Generate code block with automatic language detection
 */
export function autoDetectCodeBlock(
	code: string,
	header: string,
	highlightedCode: string,
): string {
	const { lang, filename } = parseCodeBlockHeader(header)

	return transformCodeBlock({
		lang,
		filename,
		code,
		highlightedCode,
	})
}

/**
 * Create code block map for markdown replacement
 */
export function createCodeBlockMap(
	codeBlocks: Array<{
		header: string
		code: string
		highlightedCode: string
	}>,
): Map<string, string> {
	const codeBlockMap = new Map<string, string>()

	codeBlocks.forEach((block, index) => {
		const placeholder = createCodeBlockPlaceholder(index)
		const codeBlockHtml = autoDetectCodeBlock(
			block.code,
			block.header,
			block.highlightedCode,
		)

		codeBlockMap.set(placeholder, codeBlockHtml)
	})

	return codeBlockMap
}
