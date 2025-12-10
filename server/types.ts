export type FileInfo = {
	path: string
	filename: string
	content: string
	hash: string
	lastModified: number
	size: number
	exists: boolean
}

export type PageInfo = {
	title: string
	emoji: string
	description: string
	url: string
	filename: string
	relativePath: string
	lastModified: number
	section?: string
}

export type PageMetadata = {
	title?: string
	description?: string
	emoji?: string
	url?: string
	section?: string
	order?: number
	draft?: boolean
	tags?: string[]
	created?: Date
	updated?: Date
}

export type ProcessedMarkdownFile = FileInfo & {
	metadata: PageMetadata
	processedContent: string
	htmlContent: string
	section?: string
	depth: number
	relativePath: string
	basePath: string
	title: string
}

export type CodeBlock = {
	header: string
	code: string
	highlightedCode: string
}

export type WatcherOptions = {
	recursive?: boolean
	extensions?: string[]
	ignore?: string[]
}
