import { expect, test } from '@playwright/test'

test('debug disconnectedCallback via MutationObserver', async ({ page }) => {
  await page.goto('http://localhost:3000/test/module-catalog')
  await page.waitForSelector('module-catalog')
  await page.waitForTimeout(500)

  const result = await page.evaluate(async () => {
    const catalog = document.querySelector('#vanilla-test') as any
    const vb = document.querySelector('#vanilla-test vanilla-button') as any
    
    // Verify current state
    const descBefore = Object.getOwnPropertyDescriptor(vb, 'disabled')
    
    // We know vanilla-button.disabled is a getter. 
    // Try manually calling disconnectedCallback on catalog
    if (typeof catalog.disconnectedCallback === 'function') {
      catalog.disconnectedCallback()
      const descAfterManual = Object.getOwnPropertyDescriptor(vb, 'disabled')
      return {
        hasDisconnectCb: true,
        descBefore: descBefore?.get ? 'getter' : `value:${descBefore?.value}`,
        descAfterManual: descAfterManual?.get ? 'getter' : `value:${descAfterManual?.value}`,
        disabledAfterManual: vb.disabled,
      }
    }
    
    return {
      hasDisconnectCb: false,
      descBefore: descBefore?.get ? 'getter' : `value:${descBefore?.value}`,
      ownProps: Object.getOwnPropertyNames(catalog).filter(p => !p.startsWith('#')),
    }
  })
  
  console.log('Result:', JSON.stringify(result, null, 2))
})
