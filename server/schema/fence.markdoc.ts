import Markdoc, { type Node, type Schema, Tag } from '@markdoc/markdoc'

const fence: Schema = {
	render: 'module-codeblock',
	attributes: {
		...Markdoc.nodes.fence.attributes,
	},
	transform(node: Node) {
		// Use node attributes directly instead of transformAttributes
		const code = node.attributes.content || ''
		let language = node.attributes.language || 'text'
		let filename: string | undefined

		// Parse language and filename from info string (e.g., "html#filename.html")
		if (language.includes('#')) {
			const parts = language.split('#')
			language = parts[0]
			filename = parts[1]
		}

		// Determine if code should be collapsed (>10 lines)
		const collapsed = code.split('\n').length > 10
		const collapsedAttr = collapsed ? { collapsed: '' } : {}

		// Create meta section
		const metaContent: Tag[] = []
		if (filename)
			metaContent.push(new Tag('span', { class: 'file' }, [filename]))
		metaContent.push(new Tag('span', { class: 'language' }, [language]))
		const metaSection = new Tag('p', { class: 'meta' }, metaContent)

		// Create placeholder for syntax highlighted code that will be processed by file-signals
		const codePlaceholder = new Tag(
			'module-scrollarea',
			{ orientation: 'horizontal' },
			[
				new Tag('pre', { 'data-language': language, 'data-code': code }, [
					new Tag('code', { class: `language-${language}` }, [code]),
				]),
			],
		)

		// Create copy button
		const copyButton = new Tag(
			'basic-button',
			{
				class: 'copy',
				'copy-success': 'Copied!',
				'copy-error': 'Error trying to copy to clipboard!',
			},
			[
				new Tag('button', { type: 'button', class: 'secondary small' }, [
					new Tag('span', { class: 'label' }, ['Copy']),
				]),
			],
		)

		// Create expand button if collapsed
		const expandButton = collapsed
			? new Tag(
					'button',
					{ type: 'button', class: 'overlay', 'aria-expanded': 'false' },
					['Expand'],
				)
			: null

		// Build children array
		const children: (Tag | null)[] = [metaSection, codePlaceholder, copyButton]
		if (expandButton) {
			children.push(expandButton)
		}

		// Return complete module-codeblock structure
		return new Tag(
			'module-codeblock',
			{
				language: language,
				'copy-success': 'Copied!',
				'copy-error': 'Error trying to copy to clipboard!',
				...collapsedAttr,
			},
			children.filter(Boolean),
		)
	},
}

export default fence
