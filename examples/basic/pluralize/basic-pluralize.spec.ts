import { expect, type Page, test } from '@playwright/test'

/**
 * LT-252: the plural morphology lives inside one ICU pattern (`t.tasks`),
 * so every instance renders ONE `.tasks` span whose text the client
 * re-evaluates when `count` changes — there are no per-category spans to
 * toggle. The locale instances carry the `i18n` attribute the server
 * renders at their locale (see basic-pluralize.html).
 */

const setCount = (page: Page, selector: string, count: number) =>
	page.evaluate(
		([sel, n]) => {
			const element = document.querySelector(sel as string) as any
			element.count = n
		},
		[selector, count] as const,
	)

test.describe('basic-pluralize component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-pluralize')
		await page.waitForSelector('basic-pluralize')
	})

	test('renders one .tasks span per instance', async ({ page }) => {
		const element = page.locator('basic-pluralize').first()
		await expect(element.locator('.some span')).toHaveCount(2)
		await expect(element.locator('.tasks')).toHaveCount(1)
	})

	test('renders correctly with count=0 (shows none, hides some)', async ({
		page,
	}) => {
		await setCount(page, 'basic-pluralize', 0)

		const defaultElement = page.locator('basic-pluralize').first()
		await expect(defaultElement.locator('.none')).toBeVisible()
		await expect(defaultElement.locator('.some')).toBeHidden()
	})

	test('renders correctly with count>0 (hides none, shows some)', async ({
		page,
	}) => {
		await setCount(page, 'basic-pluralize', 5)

		const defaultElement = page.locator('basic-pluralize').first()
		await expect(defaultElement.locator('.none')).toBeHidden()
		await expect(defaultElement.locator('.some')).toBeVisible()
		await expect(defaultElement.locator('.count')).toHaveText('5')
		await expect(defaultElement.locator('.tasks')).toHaveText('tasks')
	})

	test('updates count display when property changes', async ({ page }) => {
		await setCount(page, 'basic-pluralize', 1)

		const defaultElement = page.locator('basic-pluralize').first()
		const countSpan = defaultElement.locator('.count')
		await expect(countSpan).toHaveText('1')

		await setCount(page, 'basic-pluralize', 42)
		await expect(countSpan).toHaveText('42')
	})

	test('re-evaluates the pattern on count change (English)', async ({
		page,
	}) => {
		const tasks = page.locator('#plural-test .tasks')
		await expect(tasks).toHaveText('task')

		await setCount(page, '#plural-test', 2)
		await expect(tasks).toHaveText('tasks')

		await setCount(page, '#plural-test', 1)
		await expect(tasks).toHaveText('task')
	})

	test('German: {one, other} with a non-"s" plural', async ({ page }) => {
		const element = page.locator('#german-test')
		const tasks = element.locator('.tasks')
		await expect(element.locator('.count')).toHaveText('3')
		await expect(tasks).toHaveText('Aufgaben')

		await setCount(page, '#german-test', 1)
		await expect(tasks).toHaveText('Aufgabe')

		await setCount(page, '#german-test', 0)
		await expect(element.locator('.none')).toHaveText('Alles erledigt!')
		await expect(element.locator('.none')).toBeVisible()
		await expect(element.locator('.some')).toBeHidden()
	})

	test('Welsh: all six cardinal categories inside one pattern', async ({
		page,
	}) => {
		const element = page.locator('#welsh-test')
		const tasks = element.locator('.tasks')

		await expect(element.locator('.count')).toHaveText('0')
		await expect(element.locator('.none')).toBeVisible()
		await expect(element.locator('.some')).toBeHidden()

		// count → CLDR category → the cy pattern's arm
		const expected: Array<[number, string]> = [
			[1, 'tasg'], // one
			[2, 'dasg'], // two (soft mutation)
			[3, 'tasg'], // few
			[6, 'tasg'], // many
			[4, 'tasgiau'], // other
		]
		for (const [count, text] of expected) {
			await setCount(page, '#welsh-test', count)
			await expect(element.locator('.some')).toBeVisible()
			await expect(tasks).toHaveText(text)
		}
	})

	test('Arabic: the dual form for exactly two', async ({ page }) => {
		const tasks = page.locator('#arabic-test .tasks')
		await expect(tasks).toHaveText('مهمتان')

		await setCount(page, '#arabic-test', 3)
		await expect(tasks).toHaveText('مهام')
	})

	test('Polish and Latvian select their own arms', async ({ page }) => {
		const polish = page.locator('#polish-test .tasks')
		await expect(polish).toHaveText('zadań') // 5 → many
		await setCount(page, '#polish-test', 2)
		await expect(polish).toHaveText('zadania') // few

		const latvian = page.locator('#latvian-test .tasks')
		await expect(latvian).toHaveText('uzdevumu') // 10 → zero
		await setCount(page, '#latvian-test', 21)
		await expect(latvian).toHaveText('uzdevums') // one
	})

	test('Chinese: a single {other} arm', async ({ page }) => {
		const tasks = page.locator('#chinese-test .tasks')
		await expect(tasks).toHaveText('个任务')
		await setCount(page, '#chinese-test', 1)
		await expect(tasks).toHaveText('个任务')
	})

	test('materializes the inherited locale onto the root (LT-191)', async ({
		page,
	}) => {
		await expect(page.locator('#welsh-ancestor-test')).toHaveAttribute(
			'lang',
			'cy',
		)
	})

	test('handles ordinal attribute correctly', async ({ page }) => {
		const element = page.locator('#ordinal-test')
		const tasks = element.locator('.tasks')

		// en ordinal: 1 → one, 2 → two, 3 → few, 4 → other
		await expect(element.locator('.count')).toHaveText('1')
		await expect(tasks).toHaveText('task')

		await setCount(page, '#ordinal-test', 2)
		await expect(element.locator('.count')).toHaveText('2')
		await expect(tasks).toHaveText('tasks')

		await setCount(page, '#ordinal-test', 11)
		await expect(tasks).toHaveText('tasks')

		await setCount(page, '#ordinal-test', 21)
		await expect(tasks).toHaveText('task')
	})

	test('handles multiple instances with different counts', async ({ page }) => {
		const firstElement = page.locator('#pluralize-1')
		const secondElement = page.locator('#pluralize-2')

		await expect(firstElement.locator('.none')).toBeVisible()
		await expect(firstElement.locator('.some')).toBeHidden()

		await expect(secondElement.locator('.none')).toBeHidden()
		await expect(secondElement.locator('.some')).toBeVisible()
		await expect(secondElement.locator('.count')).toHaveText('5')
		await expect(secondElement.locator('.tasks')).toHaveText('tasks')
	})
})
