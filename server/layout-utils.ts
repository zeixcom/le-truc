import {
	CONTENT_MARKER,
	LAYOUT_PATHS,
	LAYOUTS_DIR,
	type LayoutConfig,
	ROUTE_LAYOUT_MAP,
} from './config'
import { fileExists, getFileContent, getFilePath, writeFileSafe } from './io'
import { DEFAULT_LAYOUTS, LayoutEngine } from './layout-engine'

/**
 * Layout development utilities
 */
export class LayoutUtils {
	/**
	 * Validate all layout files exist and are readable
	 */
	static async validateLayouts(): Promise<{
		valid: boolean
		errors: string[]
	}> {
		const errors: string[] = []

		for (const [name, path] of Object.entries(LAYOUT_PATHS)) {
			if (!fileExists(path)) {
				errors.push(`Layout file not found: ${name} at ${path}`)
				continue
			}

			try {
				await getFileContent(path)
			} catch (error) {
				errors.push(`Cannot read layout file: ${name} at ${path} - ${error}`)
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		}
	}

	/**
	 * Generate a layout template with common structure
	 */
	static generateLayoutTemplate(
		name: string,
		options: {
			title?: string
			hasHeader?: boolean
			hasFooter?: boolean
			hasNavigation?: boolean
			customCSS?: string
			customJS?: string
		} = {},
	): string {
		const {
			title = `{{ title }} – Le Truc`,
			hasHeader = true,
			hasFooter = true,
			hasNavigation = false,
			customCSS = '',
			customJS = '',
		} = options

		return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>${title}</title>
		<meta name="description" content="{{ description }}" />
		<link
			rel="preload"
			href="{{ base-path }}assets/main.css?v={{ css-hash }}"
			as="style"
		/>
		<link
			rel="modulepreload"
			href="{{ base-path }}assets/main.js?v={{ js-hash }}"
		/>
		<link
			rel="stylesheet"
			href="{{ base-path }}assets/main.css?v={{ css-hash }}"
		/>
		<script
			type="module"
			src="{{ base-path }}assets/main.js?v={{ js-hash }}"
		></script>${
			customCSS
				? `
		<style>
			${customCSS}
		</style>`
				: ''
		}
	</head>
	<body class="{{ section }} ${name}-page">${
		hasHeader
			? `
		<context-router>
			<header class="content-grid">
				<a href="#main" class="skiplink visually-hidden">
					Skip to main content
				</a>
				<h1 class="content">Le Truc <small>Version 0.15.0</small></h1>${
					hasNavigation
						? `
				{{ include 'menu.html' }}`
						: ''
				}
				<card-callout class="content danger" hidden>
					<p class="error" role="alert" aria-live="assertive"></p>
				</card-callout>
			</header>`
			: ''
	}
			<main id="main" class="content-grid">
				<div class="content">
					{{ content }}
				</div>
			</main>${
				hasFooter
					? `
			<footer class="content-grid">
				<div class="content">
					<h2 class="visually-hidden">Footer</h2>
					<p>© 2024 – 2025 Zeix AG</p>
				</div>
			</footer>`
					: ''
			}${
				hasHeader
					? `
		</context-router>`
					: ''
			}${
				customJS
					? `
		<script>
			${customJS}
		</script>`
					: ''
			}
	</body>
</html>`
	}

	/**
	 * Create a new layout file
	 */
	static async createLayout(
		name: string,
		template?: string,
		options?: Parameters<typeof LayoutUtils.generateLayoutTemplate>[1],
	): Promise<void> {
		const layoutPath = getFilePath(LAYOUTS_DIR, `${name}.html`)

		if (fileExists(layoutPath)) {
			throw new Error(`Layout ${name} already exists at ${layoutPath}`)
		}

		const content = template || this.generateLayoutTemplate(name, options)
		await writeFileSafe(layoutPath, content)

		console.log(`✅ Created layout: ${name} at ${layoutPath}`)
	}

	/**
	 * Extract template variables from layout content
	 */
	static extractTemplateVariables(content: string): string[] {
		const variables = new Set<string>()
		const regex = /{{\s*([\w\-]+)\s*}}/g
		let match: RegExpExecArray | null

		while ((match = regex.exec(content)) !== null) {
			const variable = match[1].trim()
			if (variable !== 'content') {
				// Exclude the main content variable
				variables.add(variable)
			}
		}

		return Array.from(variables).sort()
	}

	/**
	 * Analyze layout usage across routes
	 */
	static analyzeLayoutUsage(): Record<string, string[]> {
		const usage: Record<string, string[]> = {}

		for (const [route, layout] of Object.entries(ROUTE_LAYOUT_MAP)) {
			if (!usage[layout]) {
				usage[layout] = []
			}
			usage[layout].push(route)
		}

		return usage
	}

	/**
	 * Generate layout configuration for a new layout
	 */
	static generateLayoutConfig(
		name: string,
		options: {
			type?: 'simple' | 'template'
			contentMarker?: string
			defaultContext?: Record<string, string>
		} = {},
	): LayoutConfig {
		return {
			name,
			path: getFilePath(LAYOUTS_DIR, `${name}.html`),
			type: options.type || 'template',
			contentMarker: options.contentMarker || CONTENT_MARKER,
			defaultContext: options.defaultContext,
		}
	}

	/**
	 * Preview layout with sample content
	 */
	static async previewLayout(
		name: string,
		sampleContent: string = '<h1>Sample Content</h1><p>This is a preview of your layout.</p>',
		context: Record<string, string> = {},
	): Promise<string> {
		const engine = new LayoutEngine(DEFAULT_LAYOUTS)

		const defaultContext = {
			title: 'Layout Preview',
			description: 'Preview of layout with sample content',
			section: 'preview',
			'base-path': '',
			'css-hash': 'preview',
			'js-hash': 'preview',
			...context,
		}

		return engine.renderWithLayout(name, sampleContent, defaultContext)
	}

	/**
	 * Check for unused template variables in layouts
	 */
	static async findUnusedVariables(): Promise<Record<string, string[]>> {
		const unused: Record<string, string[]> = {}

		for (const [name, path] of Object.entries(LAYOUT_PATHS)) {
			if (!fileExists(path)) continue

			try {
				const content = await getFileContent(path)
				const variables = this.extractTemplateVariables(content)

				// Common variables that are always available
				const commonVars = new Set([
					'title',
					'description',
					'section',
					'base-path',
					'css-hash',
					'js-hash',
					'content',
				])

				const potentiallyUnused = variables.filter(v => !commonVars.has(v))
				if (potentiallyUnused.length > 0) {
					unused[name] = potentiallyUnused
				}
			} catch (error) {
				console.warn(`Could not analyze ${name}: ${error}`)
			}
		}

		return unused
	}

	/**
	 * Generate route test URLs for layout testing
	 */
	static generateTestUrls(): Record<string, string[]> {
		const testUrls: Record<string, string[]> = {}

		for (const [route, layout] of Object.entries(ROUTE_LAYOUT_MAP)) {
			if (!testUrls[layout]) {
				testUrls[layout] = []
			}

			// Generate sample URLs based on route patterns
			if (route.includes('{')) {
				// Dynamic route - generate sample
				const sampleUrl = route
					.replace('{component}', 'sample-component')
					.replace('{example}', 'basic-example')
					.replace('{id}', 'sample-item')
					.replace('{article}', 'sample-article')
				testUrls[layout].push(sampleUrl + 'sample.html')
			} else {
				// Static route
				testUrls[layout].push(route + (route.endsWith('/') ? 'index.html' : ''))
			}
		}

		return testUrls
	}

	/**
	 * Lint layout files for common issues
	 */
	static async lintLayouts(): Promise<
		{
			layout: string
			issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }>
		}[]
	> {
		const results: {
			layout: string
			issues: Array<{ type: 'error' | 'warning' | 'info'; message: string }>
		}[] = []

		for (const [name, path] of Object.entries(LAYOUT_PATHS)) {
			const issues: Array<{
				type: 'error' | 'warning' | 'info'
				message: string
			}> = []

			if (!fileExists(path)) {
				issues.push({
					type: 'error',
					message: `Layout file not found: ${path}`,
				})
				results.push({ layout: name, issues })
				continue
			}

			try {
				const content = await getFileContent(path)

				// Check for required elements
				if (!content.includes('<!doctype html>')) {
					issues.push({
						type: 'warning',
						message: 'Missing DOCTYPE declaration',
					})
				}

				if (!content.includes('<title>')) {
					issues.push({ type: 'warning', message: 'Missing title element' })
				}

				if (!content.includes('{{ content }}')) {
					issues.push({
						type: 'error',
						message: 'Missing {{ content }} placeholder',
					})
				}

				if (!content.includes('charset="UTF-8"')) {
					issues.push({
						type: 'warning',
						message: 'Missing or incorrect charset declaration',
					})
				}

				if (!content.includes('viewport')) {
					issues.push({ type: 'warning', message: 'Missing viewport meta tag' })
				}

				// Check for accessibility
				if (!content.includes('lang="')) {
					issues.push({
						type: 'warning',
						message: 'Missing lang attribute on html element',
					})
				}

				if (
					content.includes('<a href="#main"')
					&& !content.includes('id="main"')
				) {
					issues.push({
						type: 'warning',
						message: 'Skip link target not found',
					})
				}

				// Check for potential issues
				if (content.includes('{{') && content.includes('}}')) {
					const variables = this.extractTemplateVariables(content)
					if (variables.length === 0) {
						issues.push({
							type: 'info',
							message: 'No template variables found',
						})
					}
				}

				results.push({ layout: name, issues })
			} catch (error) {
				issues.push({
					type: 'error',
					message: `Cannot read layout file: ${error}`,
				})
				results.push({ layout: name, issues })
			}
		}

		return results
	}

	/**
	 * Generate development report for layouts
	 */
	static async generateReport(): Promise<string> {
		const validation = await this.validateLayouts()
		const usage = this.analyzeLayoutUsage()
		const testUrls = this.generateTestUrls()
		const lintResults = await this.lintLayouts()
		const unused = await this.findUnusedVariables()

		let report = '# Layout System Report\n\n'

		// Validation section
		report += '## Layout Validation\n\n'
		if (validation.valid) {
			report += '✅ All layouts are valid and readable\n\n'
		} else {
			report += '❌ Layout validation issues found:\n\n'
			for (const error of validation.errors) {
				report += `- ${error}\n`
			}
			report += '\n'
		}

		// Usage analysis
		report += '## Layout Usage\n\n'
		for (const [layout, routes] of Object.entries(usage)) {
			report += `### ${layout}\n`
			report += `Routes: ${routes.length}\n`
			for (const route of routes) {
				report += `- \`${route}\`\n`
			}
			report += '\n'
		}

		// Test URLs
		report += '## Test URLs\n\n'
		for (const [layout, urls] of Object.entries(testUrls)) {
			report += `### ${layout}\n`
			for (const url of urls) {
				report += `- http://localhost:5000${url}\n`
			}
			report += '\n'
		}

		// Lint results
		report += '## Layout Linting\n\n'
		for (const result of lintResults) {
			if (result.issues.length === 0) {
				report += `✅ **${result.layout}**: No issues\n\n`
			} else {
				report += `### ${result.layout}\n\n`
				for (const issue of result.issues) {
					const icon =
						issue.type === 'error'
							? '❌'
							: issue.type === 'warning'
								? '⚠️'
								: 'ℹ️'
					report += `${icon} ${issue.message}\n`
				}
				report += '\n'
			}
		}

		// Unused variables
		if (Object.keys(unused).length > 0) {
			report += '## Potentially Unused Variables\n\n'
			for (const [layout, variables] of Object.entries(unused)) {
				report += `### ${layout}\n`
				for (const variable of variables) {
					report += `- \`{{ ${variable} }}\`\n`
				}
				report += '\n'
			}
		}

		return report
	}
}

/**
 * CLI helper functions
 */
export const LayoutCLI = {
	/**
	 * Create a new layout interactively
	 */
	async createInteractive(): Promise<void> {
		console.log('🎨 Creating new layout...')

		// This would typically use a CLI library like inquirer
		// For now, just show the concept
		const name = process.argv[3] || 'new-layout'
		const hasHeader = true
		const hasFooter = true
		const hasNavigation = false

		await LayoutUtils.createLayout(name, undefined, {
			hasHeader,
			hasFooter,
			hasNavigation,
		})

		console.log(`
Next steps:
1. Edit the layout file: server/layouts/${name}.html
2. Add route mapping in server/config.ts
3. Add to DEFAULT_LAYOUTS in server/layout-engine.ts
4. Test with: bun server/serve.ts --mode unified
		`)
	},

	/**
	 * Validate all layouts
	 */
	async validate(): Promise<void> {
		console.log('🔍 Validating layouts...')
		const result = await LayoutUtils.validateLayouts()

		if (result.valid) {
			console.log('✅ All layouts are valid')
		} else {
			console.log('❌ Validation errors found:')
			for (const error of result.errors) {
				console.log(`  ${error}`)
			}
			process.exit(1)
		}
	},

	/**
	 * Generate and display report
	 */
	async report(): Promise<void> {
		console.log('📊 Generating layout report...')
		const report = await LayoutUtils.generateReport()
		console.log(report)
	},

	/**
	 * Preview a layout
	 */
	async preview(): Promise<void> {
		const layoutName = process.argv[3]
		if (!layoutName) {
			console.log('Usage: bun server/layout-utils.ts preview <layout-name>')
			process.exit(1)
		}

		try {
			const html = await LayoutUtils.previewLayout(layoutName)
			console.log('📋 Layout preview:')
			console.log(html)
		} catch (error) {
			console.error('❌ Preview failed:', error)
			process.exit(1)
		}
	},
}

// CLI interface
if (import.meta.main) {
	const command = process.argv[2]

	switch (command) {
		case 'create':
			await LayoutCLI.createInteractive()
			break
		case 'validate':
			await LayoutCLI.validate()
			break
		case 'report':
			await LayoutCLI.report()
			break
		case 'preview':
			await LayoutCLI.preview()
			break
		default:
			console.log(`
Layout Utils CLI

Usage:
  bun server/layout-utils.ts <command>

Commands:
  create    Create a new layout interactively
  validate  Validate all layout files
  report    Generate development report
  preview   Preview a layout with sample content

Examples:
  bun server/layout-utils.ts create
  bun server/layout-utils.ts validate
  bun server/layout-utils.ts report
  bun server/layout-utils.ts preview page
			`)
			break
	}
}
