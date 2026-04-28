import { expect, test } from '@playwright/test'

test.describe('form-inplace-edit component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/form-inplace-edit')
		await page.waitForSelector('form-inplace-edit')
	})

	test('shows text element and edit button by default', async ({ page }) => {
		const el = page.locator('form-inplace-edit')
		await expect(el.locator('.text')).toBeVisible()
		await expect(el.locator('.text')).toHaveText('Edit me')
		await expect(el.locator('button')).toBeVisible()
		await expect(el.locator('button')).toHaveAttribute('aria-label', 'Edit')
	})

	test('enters edit mode on edit button click', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await expect(page.locator('form-inplace-edit form-textbox')).toBeVisible()
		await expect(page.locator('form-inplace-edit input')).toBeFocused()
		await expect(page.locator('form-inplace-edit button')).toHaveText('✓')
		await expect(page.locator('form-inplace-edit button')).toHaveAttribute(
			'aria-label',
			'Accept',
		)
	})

	test('enters edit mode on text element double-click', async ({ page }) => {
		await page.locator('form-inplace-edit .text').dblclick()
		await expect(page.locator('form-inplace-edit form-textbox')).toBeVisible()
		await expect(page.locator('form-inplace-edit input')).toBeFocused()
	})

	test('pre-fills input with current value', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await expect(page.locator('form-inplace-edit input')).toHaveValue('Edit me')
	})

	test('accepts change on Enter key', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await page.locator('form-inplace-edit input').fill('Enter accepted')
		await page.locator('form-inplace-edit input').press('Enter')
		await expect(page.locator('form-inplace-edit .text')).toHaveText(
			'Enter accepted',
		)
	})

	test('cancels on Escape and restores original value', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await page.locator('form-inplace-edit input').fill('Will be discarded')
		await page.locator('form-inplace-edit input').press('Escape')
		await expect(page.locator('form-inplace-edit .text')).toHaveText('Edit me')
		await expect(
			page.locator('form-inplace-edit form-textbox'),
		).not.toBeAttached()
	})

	test('cancels on blur to external element', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await page.locator('form-inplace-edit input').fill('Will be discarded')
		await page.locator('form-inplace-edit button').focus() // no cancel when focus moves to button
		await page.locator('form-inplace-edit button').evaluate(el => el.blur()) // cancel when focus leaves component
		await expect(
			page.locator('form-inplace-edit form-textbox'),
		).not.toBeAttached()
		await expect(page.locator('form-inplace-edit .text')).toHaveText('Edit me')
	})

	test('focusing accept button does not cancel', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await page.locator('form-inplace-edit input').fill('Kept value')
		// Moving focus to the accept button should not cancel edit mode
		await page.locator('form-inplace-edit button').focus()
		await expect(page.locator('form-inplace-edit form-textbox')).toBeAttached()
	})

	test('restores edit button to ✎ after cancel', async ({ page }) => {
		await page.locator('form-inplace-edit button').click()
		await page.locator('form-inplace-edit input').press('Escape')
		await expect(page.locator('form-inplace-edit button')).toHaveText('✎')
		await expect(page.locator('form-inplace-edit button')).toHaveAttribute(
			'aria-label',
			'Edit',
		)
	})
})
