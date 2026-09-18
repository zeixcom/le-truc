/**
 * Unit Tests for config.ts — Configuration Constants
 *
 * Tests that all exported constants have the expected shape and values.
 * No I/O — purely constant verification.
 */

import { describe, expect, test } from 'bun:test'
import { isAbsolute } from 'path'
import {
	ASSETS_DIR,
	CHAPTERS,
	COMPONENTS_DIR,
	EXAMPLES_DIR,
	INCLUDES_DIR,
	INPUT_DIR,
	LAYOUTS_DIR,
	LOCALE_INDEPENDENT_DIRS,
	localeAssetPath,
	MENU_GROUPS,
	MIME_TYPES,
	OUTPUT_DIR,
	PAGE_ORDER,
	PAGES_DIR,
	ROOT,
	ROUTE_LAYOUT_MAP,
	rewriteFragmentRefs,
	SITEMAP_FILE,
	SOURCES_DIR,
	TEST_DIR,
} from '../config'

/* === PAGE_ORDER === */

describe('PAGE_ORDER', () => {
	test('contains all known pages', () => {
		const expected = [
			'index',
			'getting-started',
			'components',
			'props',
			'effects',
			'extensions',
			'data-flow',
			'lists',
			'context',
			'async',
			'styling',
			'examples',
			'api',
			'blog',
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

/* === CHAPTERS === */

describe('CHAPTERS', () => {
	test('every chapter member appears in PAGE_ORDER', () => {
		for (const chapter of CHAPTERS) {
			for (const slug of chapter.pages) {
				expect(PAGE_ORDER).toContain(slug)
			}
		}
	})

	test('no page belongs to two chapters', () => {
		const allMembers = CHAPTERS.flatMap(chapter => [...chapter.pages])
		expect(new Set(allMembers).size).toBe(allMembers.length)
	})

	test('chapter titles are unique and non-empty', () => {
		const titles = CHAPTERS.map(chapter => chapter.title)
		expect(titles.every(title => title.length > 0)).toBe(true)
		expect(new Set(titles).size).toBe(titles.length)
	})

	test('each chapter has at least two pages', () => {
		for (const chapter of CHAPTERS) {
			expect(chapter.pages.length).toBeGreaterThanOrEqual(2)
		}
	})
})

/* === MENU_GROUPS === */

describe('MENU_GROUPS', () => {
	test('every PAGE_ORDER page belongs to exactly one MENU_GROUPS group', () => {
		for (const slug of PAGE_ORDER) {
			const owningGroups = MENU_GROUPS.filter(group =>
				(group.pages as readonly string[]).includes(slug),
			)
			expect(owningGroups.length).toBe(1)
		}
	})

	test('every group member appears in PAGE_ORDER', () => {
		for (const group of MENU_GROUPS) {
			for (const slug of group.pages) {
				expect(PAGE_ORDER).toContain(slug)
			}
		}
	})

	test("each group's members are contiguous in PAGE_ORDER", () => {
		for (const group of MENU_GROUPS) {
			const indices = group.pages
				.map(slug => PAGE_ORDER.indexOf(slug))
				.sort((a, b) => a - b)
			for (let i = 1; i < indices.length; i++) {
				expect(indices[i]).toBe(indices[0]! + i)
			}
		}
	})

	test('group titles are unique and non-empty', () => {
		const titles = MENU_GROUPS.map(group => group.title)
		expect(titles.every(title => title.length > 0)).toBe(true)
		expect(new Set(titles).size).toBe(titles.length)
	})

	test('no page belongs to two groups', () => {
		const allMembers = MENU_GROUPS.flatMap(group => [...group.pages])
		expect(new Set(allMembers).size).toBe(allMembers.length)
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

/* === localeAssetPath (LT-174) === */

describe('localeAssetPath', () => {
	test('depth 0 (a root page of the locale tree) is one level up', () => {
		expect(localeAssetPath(0)).toBe('../')
	})

	test('depth 1 (a blog post) is two levels up', () => {
		expect(localeAssetPath(1)).toBe('../../')
	})

	test('depth 2 is three levels up', () => {
		expect(localeAssetPath(2)).toBe('../../../')
	})

	test('every level is a trailing ../ segment', () => {
		expect(localeAssetPath(3)).toBe('../../../../')
	})
})

/* === rewriteFragmentRefs (LT-174) === */

describe('rewriteFragmentRefs', () => {
	test('rewrites href to the docs root at depth 0', () => {
		expect(
			rewriteFragmentRefs('<a href="./api/functions/abort.html">abort</a>', 0),
		).toBe('<a href="../api/functions/abort.html">abort</a>')
	})

	test('rewrites src and value attributes too', () => {
		const input =
			'<img src="./assets/img/x.png" listnav value="./examples/basic-button.html">'
		const output = rewriteFragmentRefs(input, 0)
		expect(output).toContain('src="../assets/img/x.png"')
		expect(output).toContain('value="../examples/basic-button.html"')
	})

	test('covers every locale-independent directory', () => {
		for (const dir of LOCALE_INDEPENDENT_DIRS) {
			const output = rewriteFragmentRefs(`href="./${dir}/x"`, 0)
			expect(output).toBe(`href="../${dir}/x"`)
		}
	})

	test('goes one level deeper for a nested page (depth 1)', () => {
		expect(rewriteFragmentRefs('<a href="./sources/foo.html">s</a>', 1)).toBe(
			'<a href="../../sources/foo.html">s</a>',
		)
	})

	test('rewrites every occurrence in one document', () => {
		const output = rewriteFragmentRefs(
			'<a href="./api/a.html">a</a><a href="./examples/b.html">b</a>',
			0,
		)
		expect(output).toContain('href="../api/a.html"')
		expect(output).toContain('href="../examples/b.html"')
	})

	test('leaves page-relative links inside the locale tree alone', () => {
		const input =
			'<a href="./guide.html">g</a><a href="./blog/post.html">p</a><a href="./api.html">a</a>'
		expect(rewriteFragmentRefs(input, 0)).toBe(input)
	})

	test('leaves absolute and parent-relative URLs alone', () => {
		const input =
			'<a href="https://example.com/api/x">e</a><a href="../api/y.html">y</a>'
		expect(rewriteFragmentRefs(input, 0)).toBe(input)
	})
})
