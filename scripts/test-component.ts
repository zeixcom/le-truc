#!/usr/bin/env bun

/**
 * Component Test Runner
 *
 * Simplified script for running Playwright tests for individual components.
 *
 * Usage:
 *   bun run test:component module-carousel
 *   bun run test:component basic-hello
 *   bun run test:component form-combobox
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function showHelp() {
	console.log(`
Component Test Runner

Usage:
  bun run test:component <component-name>

Examples:
  bun run test:component module-carousel
  bun run test:component basic-hello
  bun run test:component form-combobox

Options:
  --help, -h     Show this help message
  --headed       Run tests in headed mode (show browser)
  --debug        Run tests in debug mode
  --ui           Open Playwright UI mode

Additional Playwright options can be passed after --:
  bun run test:component module-carousel -- --reporter=html
  bun run test:component basic-hello -- --headed --debug
`)
}

function getComponentPath(componentName: string) {
	// Derive category and sub-name from component name (e.g. "module-todo" → category="module", sub="todo")
	const dashIndex = componentName.indexOf('-')
	const category = dashIndex >= 0 ? componentName.slice(0, dashIndex) : null
	const sub = dashIndex >= 0 ? componentName.slice(dashIndex + 1) : null

	// Try different possible paths for the component
	// Files are named {componentName}.spec.ts inside examples/{category}/{sub}/
	const possiblePaths = [
		...(category && sub ? [
			`examples/${category}/${sub}/${componentName}.spec.ts`,
			`examples/${category}/${sub}`,
		] : []),
		`examples/${componentName}/${componentName}.spec.ts`,
		`examples/${componentName}`,
		`examples/${componentName}.spec.ts`,
	]

	for (const path of possiblePaths) {
		if (existsSync(path)) {
			return path
		}
	}

	return null
}

function listAvailableComponents() {
	console.log('\nAvailable components:')

	try {
		const examplesDir = 'examples'
		if (!existsSync(examplesDir)) {
			console.log('  No examples directory found')
			return
		}

		const items = readdirSync(examplesDir)

		const components: string[] = []
		for (const item of items) {
			const itemPath = join(examplesDir, item)
			if (!statSync(itemPath).isDirectory()) continue
			// Direct component (flat layout, component name = directory name)
			if (existsSync(join(itemPath, `${item}.spec.ts`))) {
				components.push(item)
				continue
			}
			// Category directory — scan one level deeper
			// Files are named {category}-{sub}.spec.ts (e.g. module-todo.spec.ts in module/todo/)
			for (const sub of readdirSync(itemPath)) {
				const subPath = join(itemPath, sub)
				const componentName = `${item}-${sub}`
				if (statSync(subPath).isDirectory() && existsSync(join(subPath, `${componentName}.spec.ts`))) {
					components.push(componentName)
				}
			}
		}
		components.sort()

		if (components.length === 0) {
			console.log('  No components with test files found')
		} else {
			components.forEach(component => {
				console.log(`  • ${component}`)
			})
		}
	} catch (error) {
		console.log(
			'  Error reading examples directory:',
			error instanceof Error ? error.message : error,
		)
	}
}

function runPlaywrightTest(testPath: string, playwrightArgs: string[] = []) {
	console.log(`🎭 Running tests for: ${testPath}`)
	console.log('')

	const args = ['playwright', 'test', testPath, ...playwrightArgs]

	const child = spawn('bunx', args, {
		stdio: 'inherit',
		shell: process.platform === 'win32',
	})

	child.on('close', (code: number | null) => {
		if (code === 0) {
			console.log(`\n✅ Tests completed successfully for ${testPath}`)
		} else {
			console.log(`\n❌ Tests failed with exit code ${code}`)
			process.exit(code ?? 1)
		}
	})

	child.on('error', error => {
		console.error('❌ Failed to start Playwright:', error.message)
		process.exit(1)
	})
}

function main() {
	const args = process.argv.slice(2)

	// Handle help
	if (args.includes('--help') || args.includes('-h') || args.length === 0) {
		showHelp()
		listAvailableComponents()
		return
	}

	// Find separator for additional Playwright args
	const separatorIndex = args.indexOf('--')
	const scriptArgs = separatorIndex >= 0 ? args.slice(0, separatorIndex) : args
	const playwrightArgs =
		separatorIndex >= 0 ? args.slice(separatorIndex + 1) : []

	const componentName = scriptArgs[0]

	if (!componentName) {
		console.error('❌ Component name is required')
		showHelp()
		listAvailableComponents()
		process.exit(1)
	}

	// Find the component test path
	const testPath = getComponentPath(componentName)

	if (!testPath) {
		console.error(`❌ Component "${componentName}" not found`)
		const dashIdx = componentName.indexOf('-')
	const errCategory = dashIdx >= 0 ? componentName.slice(0, dashIdx) : null
	const errSub = dashIdx >= 0 ? componentName.slice(dashIdx + 1) : null
	console.error('\nLooked for:')
	if (errCategory && errSub) {
		console.error(`  • examples/${errCategory}/${errSub}/${componentName}.spec.ts`)
		console.error(`  • examples/${errCategory}/${errSub}/`)
	}
	console.error(`  • examples/${componentName}/${componentName}.spec.ts`)
	console.error(`  • examples/${componentName}/`)
	console.error(`  • examples/${componentName}.spec.ts`)

		listAvailableComponents()
		process.exit(1)
	}

	// Handle script-specific flags
	const scriptFlags = scriptArgs.slice(1)
	const additionalArgs = [...playwrightArgs]

	// Convert script flags to Playwright args
	if (scriptFlags.includes('--headed')) {
		additionalArgs.push('--headed')
	}
	if (scriptFlags.includes('--debug')) {
		additionalArgs.push('--debug')
	}
	if (scriptFlags.includes('--ui')) {
		additionalArgs.push('--ui')
	}

	// Run the test
	runPlaywrightTest(testPath, additionalArgs)
}

main()
