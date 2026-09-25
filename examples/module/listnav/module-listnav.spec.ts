import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-listnav Component
 *
 * module-listnav composes form-listbox and module-lazyload: the selected
 * option's value is the partial the lazyload fetches, and the selection syncs
 * with the URL hash. It reads the listbox only through its public surface
 * (`value`, `filter`, `options`), never its owned option buttons (LT-332).
 */

const PAGE = 'http://localhost:3000/test/module-listnav'

test.describe('module-listnav component', () => {
	let pageErrors: string[]

	test.beforeEach(async ({ page }) => {
		pageErrors = []
		page.on('pageerror', error => {
			pageErrors.push(error.message)
		})
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})
	})

	test.afterEach(() => {
		expect(pageErrors).toEqual([])
	})

	test('loads the initially selected option’s partial', async ({ page }) => {
		await page.goto(PAGE)
		const content = page.locator('module-lazyload .content')
		await expect(content).toBeVisible()
		await expect(content).toContainText('This is the content of page 1.')
	})

	test('selecting an option loads its partial and updates the hash', async ({
		page,
	}) => {
		await page.goto(PAGE)
		const content = page.locator('module-lazyload .content')
		await expect(content).toContainText('page 1')

		await page.getByRole('option', { name: 'Page 2' }).click()

		await expect(page.getByRole('option', { name: 'Page 2' })).toHaveAttribute(
			'aria-selected',
			'true',
		)
		await expect(content).toContainText('This is the content of page 2.')
		expect(await page.evaluate(() => location.hash)).toBe(
			'#module-listnav/mocks/page2',
		)
	})

	test('a hash on load selects the matching option', async ({ page }) => {
		await page.goto(`${PAGE}#module-listnav/mocks/page3`)

		await expect(page.getByRole('option', { name: 'Page3' })).toHaveAttribute(
			'aria-selected',
			'true',
		)
		await expect(page.locator('module-lazyload .content')).toContainText(
			'page 3',
		)
	})

	test('a hash matching no option leaves the selection alone', async ({
		page,
	}) => {
		await page.goto(`${PAGE}#module-listnav/mocks/nope`)

		await expect(page.getByRole('option', { name: 'Page 1' })).toHaveAttribute(
			'aria-selected',
			'true',
		)
	})

	test('a hashchange selects the matching option and clears the filter', async ({
		page,
	}) => {
		await page.goto(PAGE)
		await page.evaluate(() => {
			document.querySelector('form-listbox')!.filter = 'Section'
			location.hash = '#module-listnav/mocks/page5'
		})

		await expect(page.getByRole('option', { name: 'Page 5' })).toHaveAttribute(
			'aria-selected',
			'true',
		)
		expect(
			await page.evaluate(() => document.querySelector('form-listbox')!.filter),
		).toBe('')
	})

	test('filtering narrows the options without throwing', async ({ page }) => {
		await page.goto(PAGE)
		await page.evaluate(() => {
			document.querySelector('form-listbox')!.filter = 'page 1'
		})

		await expect(page.getByRole('option', { name: 'Page 1' })).toBeVisible()
		await expect(page.getByRole('option', { name: 'Page 2' })).toBeHidden()
		expect(
			await page.evaluate(() =>
				document
					.querySelector('form-listbox')!
					.visibleOptions.map(option => option.label),
			),
		).toEqual(['Page 1'])
	})

	test('form-listbox exposes every option, unfiltered, in document order', async ({
		page,
	}) => {
		await page.goto(PAGE)
		await page.evaluate(() => {
			document.querySelector('form-listbox')!.filter = 'page 1'
		})
		const options = await page.evaluate(
			() => document.querySelector('form-listbox')!.options,
		)
		expect(options.map(option => option.label)).toEqual([
			'Page 1',
			'Page 2',
			'Page3',
			'Page 4',
			'Page 5',
			'Missing Page 6',
		])
		expect(options[0]?.value).toBe('./test/module-listnav/mocks/page1.html')
	})
})
