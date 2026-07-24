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

	test('submits its value in a form via ElementInternals', async ({ page }) => {
		await page.evaluate(() => {
			const form = document.createElement('form')
			const el = document.querySelector('form-inplace-edit')
			if (el) {
				el.parentNode?.insertBefore(form, el)
				form.appendChild(el)
			}
		})

		const formData = await page.evaluate(() => {
			const form = document.querySelector('form')
			if (!form) return null
			return Object.fromEntries(new FormData(form).entries())
		})

		expect(formData).toEqual({ label: 'Edit me' })
	})

	test('restores the default value on form reset', async ({ page }) => {
		// formAssociated()'s formResetCallback re-runs the retained initializer
		// — the original .text snapshot taken at connect time.
		await page.evaluate(() => {
			const form = document.createElement('form')
			const el = document.querySelector('form-inplace-edit')
			if (el) {
				el.parentNode?.insertBefore(form, el)
				form.appendChild(el)
			}
		})

		await page.locator('form-inplace-edit button').click()
		await page.locator('form-inplace-edit input').fill('Changed value')
		await page.locator('form-inplace-edit input').press('Enter')
		await expect(page.locator('form-inplace-edit .text')).toHaveText(
			'Changed value',
		)

		await page.evaluate(() => document.querySelector('form')?.reset())

		await expect(page.locator('form-inplace-edit .text')).toHaveText('Edit me')
		const value = await page
			.locator('form-inplace-edit')
			.evaluate((node: any) => node.value)
		expect(value).toBe('Edit me')
	})

	test('disabling the host disables the edit button and blocks dblclick entry', async ({
		page,
	}) => {
		await page.locator('form-inplace-edit').evaluate((node: any) => {
			node.disabled = true
		})

		await expect(page.locator('form-inplace-edit button')).toBeDisabled()

		await page.locator('form-inplace-edit .text').dblclick()
		await expect(
			page.locator('form-inplace-edit form-textbox'),
		).not.toBeAttached()
	})

	test('a disabled ancestor fieldset disables the edit button', async ({
		page,
	}) => {
		await page.evaluate(() => {
			const el = document.querySelector('form-inplace-edit')
			const fieldset = document.createElement('fieldset')
			fieldset.disabled = true
			el?.parentNode?.insertBefore(fieldset, el)
			fieldset.appendChild(el!)
		})

		await expect(page.locator('form-inplace-edit button')).toBeDisabled()
		const hostDisabled = await page
			.locator('form-inplace-edit')
			.evaluate((node: any) => node.disabled)
		expect(hostDisabled).toBe(true)
	})
})
