/**
 * Unit Tests for config.ts — Configuration Constants
 *
 * Tests that all exported constants have the expected shape and values.
 * No I/O — purely constant verification.
 */

import { describe, expect, test } from 'bun:test'
import {
	ASSETS_DIR,
	COMPONENTS_DIR,
	EXAMPLES_DIR,
	INCLUDES_DIR,
	INPUT_DIR,
	LAYOUTS_DIR,
	MENU_FILE,
	MIME_TYPES,
	OUTPUT_DIR,
	PAGE_ORDER,
	PAGES_DIR,
	ROOT,
	ROUTE_LAYOUT_MAP,
	SITEMAP_FILE,
	SOURCES_DIR,
	TEST_DIR,
} from '../config'
import { isAbsolute } from 'path'

/* === PAGE_ORDER === */

describe('PAGE_ORDER', () => {
	test('contains all known pages', () => {
		const expected = [
			'index',
			'getting-started',
			'components',
			'styling',
			'data-flow',
			'examples',
			'api',
			'about',
		]
		for (const page of expected) {
			expect(PAGE_ORDER).toContain(page)
		}
	})

	test('has no duplicates', () => {
		expect(new Set(PAGE_ORDER).size).toBe(PAGE_ORDER.length)
	})
})

/* === ROUTE_LAYOUT_MAP === */

describe('ROUTE_LAYOUT_MAP', () => {
	test('maps /api/classes/ sub-path to "api"', () => {
		expect(ROUTE_LAYOUT_MAP['/api/classes/']).toBe('api')
	})

	test('maps /api/functions/ sub-path to "api"', () => {
		expect(ROUTE_LAYOUT_MAP['/api/functions/']).toBe('api')
	})

	test('maps /api/type-aliases/ sub-path to "api"', () => {
		expect(ROUTE_LAYOUT_MAP['/api/type-aliases/']).toBe('api')
	})

	test('maps /api/variables/ sub-path to "api"', () => {
		expect(ROUTE_LAYOUT_MAP['/api/variables/']).toBe('api')
	})

	test('has default "/" fallback to "page"', () => {
		expect(ROUTE_LAYOUT_MAP['/']).toBe('page')
	})

	test('maps /test/ to "test"', () => {
		expect(ROUTE_LAYOUT_MAP['/test/']).toBe('test')
	})
})

/* === Directory constants are absolute paths === */

describe('directory constants', () => {
	const dirs = [
		['ROOT', ROOT],
		['INPUT_DIR', INPUT_DIR],
		['PAGES_DIR', PAGES_DIR],
		['OUTPUT_DIR', OUTPUT_DIR],
		['ASSETS_DIR', ASSETS_DIR],
		['COMPONENTS_DIR', COMPONENTS_DIR],
		['EXAMPLES_DIR', EXAMPLES_DIR],
		['SOURCES_DIR', SOURCES_DIR],
		['TEST_DIR', TEST_DIR],
		['LAYOUTS_DIR', LAYOUTS_DIR],
		['INCLUDES_DIR', INCLUDES_DIR],
		['MENU_FILE', MENU_FILE],
		['SITEMAP_FILE', SITEMAP_FILE],
	] as const

	for (const [name, value] of dirs) {
		test(`${name} is an absolute path`, () => {
			expect(isAbsolute(value)).toBe(true)
		})
	}

	test('PAGES_DIR is inside INPUT_DIR', () => {
		expect(PAGES_DIR.startsWith(INPUT_DIR)).toBe(true)
	})

	test('ASSETS_DIR is inside OUTPUT_DIR', () => {
		expect(ASSETS_DIR.startsWith(OUTPUT_DIR)).toBe(true)
	})
})

/* === MIME_TYPES === */

describe('MIME_TYPES', () => {
	const required = ['html', 'css', 'js', 'json', 'svg', 'woff2'] as const

	for (const ext of required) {
		test(`covers "${ext}" extension`, () => {
			expect(MIME_TYPES[ext]).toBeTruthy()
		})
	}

	test('html maps to text/html', () => {
		expect(MIME_TYPES.html).toBe('text/html')
	})

	test('css maps to text/css', () => {
		expect(MIME_TYPES.css).toBe('text/css')
	})

	test('js maps to application/javascript', () => {
		expect(MIME_TYPES.js).toBe('application/javascript')
	})

	test('woff2 maps to a font MIME type', () => {
		expect(MIME_TYPES.woff2).toMatch(/^font\//)
	})
})
