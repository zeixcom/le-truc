import { expect, test } from '@playwright/test'

test.describe('form-radiogroup component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/form-radiogroup.html')
		await page.waitForSelector('form-radiogroup')
	})

	test('renders initial state correctly', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const radios = radiogroupComponent.locator('input[type="radio"]')
		const legend = radiogroupComponent.locator('legend')
		const labels = radiogroupComponent.locator('label')

		// Should have the correct number of radio buttons
		await expect(radios).toHaveCount(3)
		await expect(labels).toHaveCount(3)

		// Should display correct legend text
		await expect(legend).toHaveText('Gender')

		// Should have the initial selection based on the value attribute
		const checkedRadio = radiogroupComponent.locator('input[value="other"]')
		await expect(checkedRadio).toBeChecked()

		// Should have the selected class on the correct label
		const selectedLabel = radiogroupComponent.locator('label.selected')
		await expect(selectedLabel).toHaveCount(1)
		await expect(selectedLabel.locator('span')).toHaveText('Other')
	})

	test('selects radio button when clicked', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const maleRadio = radiogroupComponent.locator('input[value="male"]')
		const otherRadio = radiogroupComponent.locator('input[value="other"]')

		// Initially "other" is selected
		await expect(otherRadio).toBeChecked()
		await expect(femaleRadio).not.toBeChecked()
		await expect(maleRadio).not.toBeChecked()

		// Click female radio
		await femaleRadio.click()
		await expect(femaleRadio).toBeChecked()
		await expect(otherRadio).not.toBeChecked()
		await expect(maleRadio).not.toBeChecked()

		// Click male radio
		await maleRadio.click()
		await expect(maleRadio).toBeChecked()
		await expect(femaleRadio).not.toBeChecked()
		await expect(otherRadio).not.toBeChecked()
	})

	test('syncs value property with radio selection', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')

		// Initially should have "other" value
		let currentValue = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(currentValue).toBe('other')

		// Click female radio
		await femaleRadio.click()

		currentValue = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(currentValue).toBe('female')
	})

	test('updates selected class when selection changes', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const femaleLabel = radiogroupComponent
			.locator('label')
			.filter({ has: page.locator('input[value="female"]') })
		const otherLabel = radiogroupComponent
			.locator('label')
			.filter({ has: page.locator('input[value="other"]') })

		// Initially "other" label should have selected class
		const initialSelectedLabel = radiogroupComponent.locator('label.selected')
		await expect(initialSelectedLabel).toHaveCount(1)
		await expect(femaleLabel).not.toHaveClass(/selected/)

		// Click female radio
		await femaleRadio.click()

		// Female label should now have selected class, other should not
		await expect(femaleLabel).toHaveClass(/selected/)
		await expect(otherLabel).not.toHaveClass(/selected/)
	})

	test('handles keyboard navigation with arrow keys', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const maleRadio = radiogroupComponent.locator('input[value="male"]')
		const otherRadio = radiogroupComponent.locator('input[value="other"]')

		// Start with focus on the initially checked radio (other is at index 2)
		await otherRadio.focus()
		await expect(otherRadio).toBeFocused()

		// Arrow right should wrap around to index 0 (female)
		await page.keyboard.press('ArrowRight')
		await page.waitForTimeout(10)
		await expect(femaleRadio).toBeFocused()

		// Arrow right should move to index 1 (male)
		await page.keyboard.press('ArrowRight')
		await page.waitForTimeout(10)
		await expect(maleRadio).toBeFocused()

		// Arrow right should move to index 2 (other)
		await page.keyboard.press('ArrowRight')
		await page.waitForTimeout(10)
		await expect(otherRadio).toBeFocused()

		// Arrow left should move backwards to index 1 (male)
		await page.keyboard.press('ArrowLeft')
		await page.waitForTimeout(10)
		await expect(maleRadio).toBeFocused()

		// Arrow left should move to index 0 (female)
		await page.keyboard.press('ArrowLeft')
		await page.waitForTimeout(10)
		await expect(femaleRadio).toBeFocused()

		// Arrow left from first item should wrap around to last item (other)
		await page.keyboard.press('ArrowLeft')
		await page.waitForTimeout(10)
		await expect(otherRadio).toBeFocused()
	})

	test('handles keyboard navigation with up/down arrows', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const maleRadio = radiogroupComponent.locator('input[value="male"]')
		const otherRadio = radiogroupComponent.locator('input[value="other"]')

		// Focus on middle radio (male at index 1)
		await maleRadio.focus()
		await expect(maleRadio).toBeFocused()

		// Arrow down should move focus (same as arrow right) to next index (other)
		await page.keyboard.press('ArrowDown')
		await page.waitForTimeout(10)
		await expect(otherRadio).toBeFocused()

		// Arrow down should wrap around to first item (female)
		await page.keyboard.press('ArrowDown')
		await page.waitForTimeout(10)
		await expect(femaleRadio).toBeFocused()

		// Arrow up should move focus backwards (same as arrow left) to last item (other)
		await page.keyboard.press('ArrowUp')
		await page.waitForTimeout(10)
		await expect(otherRadio).toBeFocused()
	})

	test('handles Home and End key navigation', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const otherRadio = radiogroupComponent.locator('input[value="other"]')
		const maleRadio = radiogroupComponent.locator('input[value="male"]')

		// Focus somewhere in the middle
		await maleRadio.focus()
		await expect(maleRadio).toBeFocused()

		// Home should move to first radio (female is first in DOM)
		await page.keyboard.press('Home')
		await page.waitForTimeout(10)
		await expect(femaleRadio).toBeFocused()

		// End should move to last radio (other is last in DOM)
		await page.keyboard.press('End')
		await page.waitForTimeout(10)
		await expect(otherRadio).toBeFocused()
	})

	test('handles Enter key to select focused radio', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const otherRadio = radiogroupComponent.locator('input[value="other"]')

		// Initially "other" is checked
		await expect(otherRadio).toBeChecked()
		await expect(femaleRadio).not.toBeChecked()

		// Focus female radio but don't click
		await femaleRadio.focus()
		await expect(femaleRadio).toBeFocused()
		await expect(femaleRadio).not.toBeChecked() // Still not selected

		// Press Enter to select
		await page.keyboard.press('Enter')
		await expect(femaleRadio).toBeChecked()
		await expect(otherRadio).not.toBeChecked()
	})

	test('manages tabindex correctly for roving tabindex pattern', async ({
		page,
	}) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')

		// Wait for component to initialize and set tabindex
		await page.waitForTimeout(200)

		// Initially checked radio should have tabindex 0, others -1
		// Check the DOM property, not the attribute
		const initialTabIndexes = await page.evaluate(() => {
			const radios = Array.from(
				document.querySelectorAll('form-radiogroup input[type="radio"]'),
			)
			return radios.map((r: any) => ({
				value: r.value,
				tabIndex: r.tabIndex,
			}))
		})

		expect(initialTabIndexes.find(r => r.value === 'other')?.tabIndex).toBe(0)
		expect(initialTabIndexes.find(r => r.value === 'female')?.tabIndex).toBe(-1)
		expect(initialTabIndexes.find(r => r.value === 'male')?.tabIndex).toBe(-1)

		// After selecting female, it should get tabindex 0
		await femaleRadio.click()
		await page.waitForTimeout(10)

		// Check tabindex after selection change
		const updatedTabIndexes = await page.evaluate(() => {
			const radios = Array.from(
				document.querySelectorAll('form-radiogroup input[type="radio"]'),
			)
			return radios.map((r: any) => ({
				value: r.value,
				tabIndex: r.tabIndex,
			}))
		})

		expect(updatedTabIndexes.find(r => r.value === 'female')?.tabIndex).toBe(0)
		expect(updatedTabIndexes.find(r => r.value === 'other')?.tabIndex).toBe(-1)
		expect(updatedTabIndexes.find(r => r.value === 'male')?.tabIndex).toBe(-1)
	})

	test('handles clicking on label to select radio', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const femaleLabel = radiogroupComponent
			.locator('label')
			.filter({ has: page.locator('input[value="female"]') })

		// Initially not checked
		await expect(femaleRadio).not.toBeChecked()

		// Click on label should select the radio
		await femaleLabel.click()
		await expect(femaleRadio).toBeChecked()
	})

	test('handles multiple radiogroup instances independently', async ({
		page,
	}) => {
		const firstRadiogroup = page.locator('form-radiogroup').first()
		const secondRadiogroup = page.locator('form-radiogroup.split-button')

		// First radiogroup should have "other" selected
		const firstOtherRadio = firstRadiogroup.locator('input[value="other"]')
		await expect(firstOtherRadio).toBeChecked()

		// Second radiogroup should have "all" selected
		const secondAllRadio = secondRadiogroup.locator('input[value="all"]')
		await expect(secondAllRadio).toBeChecked()

		// Change selection in first radiogroup
		const firstFemaleRadio = firstRadiogroup.locator('input[value="female"]')
		await firstFemaleRadio.click()
		await expect(firstFemaleRadio).toBeChecked()
		await expect(firstOtherRadio).not.toBeChecked()

		// Second radiogroup should be unaffected
		await expect(secondAllRadio).toBeChecked()

		// Change selection in second radiogroup (use label click for visually hidden inputs)
		const secondActiveLabel = secondRadiogroup
			.locator('label')
			.filter({ has: page.locator('input[value="active"]') })
		const secondActiveRadio = secondRadiogroup.locator('input[value="active"]')
		await secondActiveLabel.click()
		await expect(secondActiveRadio).toBeChecked()
		await expect(secondAllRadio).not.toBeChecked()

		// First radiogroup should still have female selected
		await expect(firstFemaleRadio).toBeChecked()
	})

	test('handles split-button variant styling', async ({ page }) => {
		const splitButtonRadiogroup = page.locator('form-radiogroup.split-button')
		const labels = splitButtonRadiogroup.locator('label')
		const selectedLabel = splitButtonRadiogroup.locator('label.selected')

		// Should have split-button class
		await expect(splitButtonRadiogroup).toHaveClass(/split-button/)

		// Should have correct number of labels
		await expect(labels).toHaveCount(3)

		// Should have one selected label initially
		await expect(selectedLabel).toHaveCount(1)
		await expect(selectedLabel.locator('span')).toHaveText('All')

		// Visually hidden inputs should be present
		const hiddenInputs = splitButtonRadiogroup.locator('input.visually-hidden')
		await expect(hiddenInputs).toHaveCount(3)
	})

	test('value property is readonly (sensor-based)', async ({ page }) => {
		// Test that the value property reflects radio state but doesn't control it
		const initialValue = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(initialValue).toBe('other')

		// Click a different radio
		const femaleRadio = page
			.locator('form-radiogroup input[value="female"]')
			.first()
		await femaleRadio.click()

		// Property should now reflect the selected value
		const valueAfterClick = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(valueAfterClick).toBe('female')

		// Verify that trying to set the value property doesn't change the selection
		// (since it's a readonly sensor)
		await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			try {
				element.value = 'male'
			} catch (_e) {
				// Expected - property might be readonly
			}
		})

		// Radio should still be female
		await expect(femaleRadio).toBeChecked()

		// The property should still reflect female because it reads from DOM
		const valueAfterAttemptedChange = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(valueAfterAttemptedChange).toBe('female')
	})

	test('sensor updates when radio state changes programmatically', async ({
		page,
	}) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const maleRadio = radiogroupComponent.locator('input[value="male"]')

		// Change the radio state directly via DOM
		await page.evaluate(() => {
			const input = document.querySelector(
				'form-radiogroup input[value="male"]',
			) as HTMLInputElement
			input.checked = true
			input.dispatchEvent(new Event('change', { bubbles: true }))
		})

		// Component should reflect the change
		await expect(maleRadio).toBeChecked()

		const valueProperty = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(valueProperty).toBe('male')
	})

	test('fires change events on radio interaction', async ({ page }) => {
		// Set up event listener
		await page.evaluate(() => {
			;(window as any).changeEventCount = 0
			const radiogroup = document.querySelector('form-radiogroup')
			radiogroup?.addEventListener('change', () => {
				;(window as any).changeEventCount++
			})
		})

		const femaleRadio = page
			.locator('form-radiogroup input[value="female"]')
			.first()

		// Click should fire change event
		await femaleRadio.click()

		let changeEventCount = await page.evaluate(
			() => (window as any).changeEventCount,
		)
		expect(changeEventCount).toBe(1)

		// Click different radio should fire another change event
		const maleRadio = page
			.locator('form-radiogroup input[value="male"]')
			.first()
		await maleRadio.click()

		changeEventCount = await page.evaluate(
			() => (window as any).changeEventCount,
		)
		expect(changeEventCount).toBe(2)
	})

	test('handles form integration', async ({ page }) => {
		// Add a form wrapper and test form data
		await page.evaluate(() => {
			const form = document.createElement('form')
			const radiogroup = document.querySelector('form-radiogroup')
			if (radiogroup) {
				radiogroup.parentNode?.insertBefore(form, radiogroup)
				form.appendChild(radiogroup)
			}
		})

		const femaleRadio = page
			.locator('form-radiogroup input[value="female"]')
			.first()
		await femaleRadio.click()

		// Test form data includes the selected radio value
		const formData = await page.evaluate(() => {
			const form = document.querySelector('form')
			if (!form) return null
			const data = new FormData(form)
			return Object.fromEntries(data.entries())
		})

		expect(formData).toEqual({ gender: 'female' })
	})

	test('prevents default behavior on keyboard navigation', async ({ page }) => {
		// Set up event listener to track prevented events on the radio inputs
		await page.evaluate(() => {
			;(window as any).preventedEvents = []
			const radios = document.querySelectorAll(
				'form-radiogroup input[type="radio"]',
			)
			radios.forEach(radio => {
				radio.addEventListener('keydown', event => {
					if (event.defaultPrevented) {
						;(window as any).preventedEvents.push(event.key)
					}
				})
			})
		})

		const otherRadio = page
			.locator('form-radiogroup input[value="other"]')
			.first()
		await otherRadio.focus()

		// Navigation keys should prevent default
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('ArrowLeft')
		await page.keyboard.press('Home')
		await page.keyboard.press('End')

		const preventedEvents = await page.evaluate(
			() => (window as any).preventedEvents,
		)
		expect(preventedEvents).toEqual(['ArrowRight', 'ArrowLeft', 'Home', 'End'])
	})

	test('handles rapid selection changes', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')
		const maleRadio = radiogroupComponent.locator('input[value="male"]')
		const otherRadio = radiogroupComponent.locator('input[value="other"]')

		// Rapid clicks between different radios
		await femaleRadio.click()
		await maleRadio.click()
		await otherRadio.click()
		await femaleRadio.click()

		// Should end up with female selected
		await expect(femaleRadio).toBeChecked()
		await expect(maleRadio).not.toBeChecked()
		await expect(otherRadio).not.toBeChecked()

		const finalValue = await page.evaluate(() => {
			const element = document.querySelector('form-radiogroup') as any
			return element.value
		})
		expect(finalValue).toBe('female')
	})

	test('handles missing required elements gracefully', async ({ page }) => {
		// Create a radiogroup without the required radio buttons
		await page.evaluate(() => {
			const emptyRadiogroup = document.createElement('form-radiogroup')
			emptyRadiogroup.innerHTML = '<fieldset><legend>Empty</legend></fieldset>'
			document.body.appendChild(emptyRadiogroup)
		})

		// Should not crash - component should handle missing radios gracefully
		const emptyValue = await page.evaluate(() => {
			const element = document.querySelector(
				'form-radiogroup:last-child',
			) as any
			return element?.value ?? ''
		})
		expect(emptyValue).toBe('')
	})

	test('maintains focus management after DOM changes', async ({ page }) => {
		const radiogroupComponent = page.locator('form-radiogroup').first()
		const femaleRadio = radiogroupComponent.locator('input[value="female"]')

		// Focus and select female (index 0)
		await femaleRadio.focus()
		await femaleRadio.click()

		// Verify focus management is still working - should move to next index
		await page.keyboard.press('ArrowRight')
		await page.waitForTimeout(10)
		const maleRadio = radiogroupComponent.locator('input[value="male"]')
		await expect(maleRadio).toBeFocused()
	})
})
