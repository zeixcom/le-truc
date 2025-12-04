/**
 * Test setup for le-truc
 * Provides DOM globals and utilities for testing
 */

import { JSDOM } from 'jsdom'

// Setup DOM environment for Bun tests
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
	url: 'http://localhost',
	pretendToBeVisual: true,
	resources: 'usable',
})

// Make DOM globals available
global.window = dom.window as unknown as Window & typeof globalThis
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.MutationObserver = dom.window.MutationObserver
global.CustomEvent = dom.window.CustomEvent
global.Event = dom.window.Event

// Add custom element registry
global.customElements = dom.window.customElements

// Cleanup function for tests
export const cleanup = () => {
	document.body.innerHTML = ''
	// Clear any remaining timers or observers
	global.clearTimeout = dom.window.clearTimeout as any
	global.clearInterval = dom.window.clearInterval as any
}

// Helper to wait for mutation observers
export const waitForMutations = (timeout = 50): Promise<void> => {
	return new Promise(resolve => setTimeout(resolve, timeout))
}

// Helper to create test elements
export const createElement = (
	tagName: string,
	attributes: Record<string, string> = {},
	textContent?: string,
): HTMLElement => {
	const element = document.createElement(tagName)

	for (const [key, value] of Object.entries(attributes)) {
		if (key === 'class') {
			element.className = value
		} else {
			element.setAttribute(key, value)
		}
	}

	if (textContent) {
		element.textContent = textContent
	}

	return element
}

// Helper to create test containers
export const createTestContainer = (html?: string): HTMLDivElement => {
	const container = document.createElement('div')
	container.setAttribute('data-testid', 'test-container')

	if (html) {
		container.innerHTML = html
	}

	document.body.appendChild(container)
	return container
}

// Mock console methods for testing
const originalConsole = { ...console }

export const mockConsole = () => {
	const logs: Array<{ level: string; args: unknown[] }> = []

	;['log', 'warn', 'error', 'debug'].forEach(level => {
		;(console as any)[level] = (...args: unknown[]) => {
			logs.push({ level, args })
		}
	})

	return {
		getLogs: () => logs,
		clearLogs: () => logs.splice(0, logs.length),
		restore: () => {
			Object.assign(console, originalConsole)
		},
	}
}

// Helper for testing reactivity
export const trackReactiveUpdates = (signal: {
	get(): unknown
}): {
	callCount: number
	lastValue: unknown
	track: () => void
} => {
	let callCount = 0
	let lastValue: unknown

	const track = () => {
		callCount++
		lastValue = signal.get()
	}

	return { callCount, lastValue, track }
}

// Export test utilities
export const TestUtils = {
	cleanup,
	waitForMutations,
	createElement,
	createTestContainer,
	mockConsole,
	trackReactiveUpdates,
}
