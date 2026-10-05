import { expect, type Page, test } from '@playwright/test'

/**
 * LT-423 fixture: a reactive-list item is a Mount Scope (ADR 0046 s1).
 * Both surfaces run the same scenario against their own page:
 *
 * - the server-rendered items are ADOPTED at connect and their wiring
 *   applies in place — the store field's reactive attribute (`class`),
 *   the composed child's `truc:pass={{ checked: { get, set } }}` and the
 *   lazy text child all work on the nodes the server rendered, and a
 *   marker set on an adopted item survives a state change (no re-clone);
 * - the Add button appends an item the client CLONED from the extracted
 *   `<template data-list="0">` — and the same wiring applies to the
 *   clone, including the key-derived `id`/`for` (the `.tsx` keyed `map`
 *   binds the key since LT-425).
 */

const firstTask = (page: Page, tag: string) =>
	page.locator(`${tag} ul.tasks li`).first()

const checkbox = (page: Page, tag: string, key: string) =>
	page.locator(`${tag} li[data-key="${key}"] form-checkbox input`)

const textInput = (page: Page, tag: string, key: string) =>
	page.locator(`${tag} li[data-key="${key}"] input[type="text"]`)

for (const tag of ['test-listitem', 'test-listitem-tsx'] as const) {
	test.describe(`${tag}: the item is a Mount Scope (LT-423)`, () => {
		test.beforeEach(async ({ page }) => {
			await page.goto(`/test/${tag}`)
			await page.waitForSelector(tag)
		})

		test('adopted items are wired in place at connect', async ({ page }) => {
			// The reactive attribute over the store field, applied to the
			// server-rendered element.
			await expect(firstTask(page, tag)).toHaveClass(/done/)
			await expect(page.locator(`${tag} ul.tasks li`).nth(1)).not.toHaveClass(
				/done/,
			)
			// The composed child's pass binding: task-1 is done, task-2 is not.
			await expect(checkbox(page, tag, 'task-1')).toBeChecked()
			await expect(checkbox(page, tag, 'task-2')).not.toBeChecked()
			// The lazy text child over the store field.
			await expect(firstTask(page, tag).locator('> label')).toHaveText(
				'First task',
			)
		})

		test('toggling the composed child updates the item in place', async ({
			page,
		}) => {
			const item = page.locator(`${tag} ul.tasks li[data-key="task-2"]`)
			// A marker the mount did not write: a re-clone would discard it.
			await item.evaluate(el => el.setAttribute('data-probe', '1'))
			await checkbox(page, tag, 'task-2').check()
			await expect(item).toHaveClass(/done/)
			await expect(checkbox(page, tag, 'task-1')).toBeChecked()
			await expect(item).toHaveAttribute('data-probe', '1')
			await checkbox(page, tag, 'task-2').uncheck()
			await expect(item).not.toHaveClass(/done/)
		})

		test('the store field binding is two-way through the native input', async ({
			page,
		}) => {
			const item = page.locator(`${tag} ul.tasks li[data-key="task-2"]`)
			await textInput(page, tag, 'task-2').fill('Renamed task')
			await expect(item.locator('> label')).toHaveText('Renamed task')
		})

		test('an item added after connect clones with its wiring', async ({
			page,
		}) => {
			await page.locator(`${tag} button.add`).click()
			const added = page.locator(`${tag} ul.tasks li`).last()
			await expect(added).toHaveClass(/done/)
			await expect(added.locator('> label')).toHaveText('Added task')
			await expect(added.locator('form-checkbox input')).toBeChecked()
			// Key-derived attributes, set once at clone: the new task's
			// label points at its own input by key.
			const key = await added.getAttribute('data-key')
			expect(key).toBeTruthy()
			await expect(added.locator(`input[type="text"]#${key}`)).toBeAttached()
			await expect(added.locator(`label[for="${key}"]`)).toBeAttached()
			await expect(added.locator(`label[for="${key}"]`)).toHaveText(
				'Added task',
			)
			// And the clone's own input drives its label.
			await added.locator('input[type="text"]').fill('Edited clone')
			await expect(added.locator('> label')).toHaveText('Edited clone')
		})
	})
}

test.describe('test-listitem: removal through the key binding', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/test-listitem')
		await page.waitForSelector('test-listitem')
	})

	test('the remove button reads the key and reconciles', async ({ page }) => {
		await page.locator('test-listitem li[data-key="task-1"] button').click()
		await expect(
			page.locator('test-listitem li[data-key="task-1"]'),
		).toHaveCount(0)
		await expect(page.locator('test-listitem ul.tasks li')).toHaveCount(1)
	})
})
