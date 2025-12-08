# Le Truc Testing Guide

## Test Infrastructure Overview

Le Truc uses a sophisticated test setup that combines Bun's build system with Playwright for end-to-end testing. Here's how the pieces work together:

### **Test Server Architecture**

1. **Bun Development Server** (`examples/server.ts`)
   - Serves on `http://localhost:4173`
   - Dynamically injects component HTML fragments into a layout template
   - Routes `/test/{component}.html` to render component examples for testing
   - Serves compiled assets from `/assets/` directory

2. **Layout Template** (`examples/layout.html`)
   - Base HTML structure with compiled JS/CSS imports
   - Component HTML fragments are injected via comment placeholder
   - Provides consistent testing environment across all components

3. **Asset Compilation**
   - `bun run build:examples` compiles all components and examples
   - Creates `examples/assets/main.js` and `examples/assets/main.css`
   - Includes all component definitions and shared styles

### **Test Structure**

```typescript
// Standard test pattern
test.describe('component-name component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4173/test/component-name.html')
    await page.waitForSelector('component-name')
  })

  test('test description', async ({ page }) => {
    // Test implementation
  })
})
```

### **Fixture System**

- **HTML Fixtures**: Each component's `.html` file in `examples/` serves as test fixture
- **Dynamic Injection**: Server reads HTML files and injects them into layout
- **Multiple Instances**: HTML fixtures can contain multiple component instances with different configurations
- **Real DOM**: Tests run against actual component implementations, not mocks

## Le Truc Component Architecture

### **1. Reactive Properties**

All custom component properties in Le Truc are reactive - they track access and notify on changes. The component's `Props` type interface defines which properties can be controlled externally:

```typescript
type FormCheckboxProps = {
  readonly checked: boolean  // Read-only sensor property
  label: string             // Writable reactive property
}
```

**Key Points**:
- Properties marked `readonly` cannot be set externally
- Writable properties can be controlled by outside components or arbitrary JavaScript
- All properties are reactive and will trigger updates when changed

### **2. Uncontrolled Form Components**

**Key Insight**: Le Truc form components are fundamentally different from React-style controlled components.

```typescript
// 🚫 Wrong assumption - trying to control read-only sensor property
await page.evaluate(() => {
  const element = document.querySelector('form-checkbox')
  element.checked = true // This won't work - readonly property
})

// ✅ Correct approach - interact with actual DOM elements
const checkbox = page.locator('form-checkbox input[type="checkbox"]')
await checkbox.click() // User interaction drives state

// ✅ Also correct - setting writable properties
await page.evaluate(() => {
  const element = document.querySelector('form-checkbox')
  element.label = 'New Label' // This works - writable property
})
```

**Why**: Le Truc protects user-entered data from external JavaScript modification while allowing controlled updates to non-sensitive properties.

### **3. Sensor-Based State Management**

Many Le Truc form components use sensors that read from DOM elements:

```typescript
// Component definition
checked: createSensor(
  read(ui => ui.checkbox.checked, false),
  'checkbox',
  { change: ({ target }) => target.checked },
)
```

**Testing Implications**:
- Sensor properties are read-only and reflect DOM state
- State updates only through user interactions or DOM events
- Test by simulating real user behavior for sensor properties
- Other properties can be set programmatically if not marked readonly

### **4. Security-First Design**

Le Truc assumes potential malicious JavaScript on the page:

- **User interactions** (clicks, typing, form submissions) are trusted
- **Sensor properties** are protected from external manipulation
- **Writable properties** can be controlled but are still reactive
- **Server-rendered HTML** provides initial trusted state

## Testing Best Practices

### **1. Understanding Property Types**

Before testing, check the component's Props interface:

```typescript
// Check component definition
type MyComponentProps = {
  readonly sensorValue: number  // Test via user interaction
  writableValue: string         // Can test both ways
  label: string                // Writable reactive property
}
```

### **2. Test Real User Interactions for Sensors**

```typescript
// For readonly/sensor properties
await button.click()
await input.fill('text')
await select.selectOption('value')
```

### **3. Test Programmatic Updates for Writable Properties**

```typescript
// For writable reactive properties
await page.evaluate(() => {
  const element = document.querySelector('my-component')
  element.label = 'New Label'    // This works
  element.writableValue = 'test' // This works
})
```

### **4. Verify Property Reactivity**

```typescript
// Test that property changes trigger updates
await page.evaluate(() => {
  const element = document.querySelector('my-component')
  element.label = 'Updated Label'
})

const labelElement = page.locator('my-component .label')
await expect(labelElement).toHaveText('Updated Label')
```

### **5. Test Read-only Property Reflection**

```typescript
// Check that readonly properties reflect internal state
const sensorValue = await page.evaluate(() => {
  const element = document.querySelector('form-checkbox')
  return element.checked // Read-only reflection of DOM state
})
expect(sensorValue).toBe(true)
```

### **6. Test Multiple Component Instances**

```typescript
const firstComponent = page.locator('form-checkbox').first()
const secondComponent = page.locator('form-checkbox.todo')
// Test independence between instances
```

### **7. Validate Attribute Synchronization**

```typescript
// Components sync internal state to host attributes
await expect(component).toHaveAttribute('checked')
await expect(component).not.toHaveAttribute('checked')
```

### **8. Test Form Integration**

```typescript
// Verify components work with standard form APIs
const formData = await page.evaluate(() => {
  const form = document.querySelector('form')
  return Object.fromEntries(new FormData(form).entries())
})
```

## Event-Driven Updates

Components respond to real DOM events for sensor properties:

```typescript
// ✅ Correct - triggers sensor update
await checkbox.click()

// ✅ Also correct - dispatches real event
await page.evaluate(() => {
  const input = document.querySelector('input[type="checkbox"]')
  input.checked = true
  input.dispatchEvent(new Event('change', { bubbles: true }))
})

// 🚫 Wrong - doesn't trigger sensor updates
await page.evaluate(() => {
  const input = document.querySelector('input[type="checkbox"]')
  input.checked = true // Missing event dispatch
})
```

## Common Testing Pitfalls

### **🚫 Don't**: Try to control readonly sensor properties
```typescript
element.checked = true // Ignored if readonly
element.value = 'new value' // Won't work for sensors
```

### **🚫 Don't**: Assume all properties are readonly
```typescript
// Check the Props interface first
element.label = 'new label' // This might work!
```

### **🚫 Don't**: Assume React-like behavior
```typescript
// This pattern doesn't work in Le Truc
component.props.onChange({ target: { checked: true }})
```

### **🚫 Don't**: Mock component behavior
```typescript
// Test real components, not mocked implementations
```

### **✅ Do**: Check component Props interface first
```typescript
// Understand what's readonly vs writable before testing
type ComponentProps = {
  readonly sensor: boolean
  writable: string
}
```

### **✅ Do**: Simulate real user interactions for sensors
```typescript
await checkbox.click()
await input.type('text')
await page.keyboard.press('Space')
```

### **✅ Do**: Test programmatic updates for writable properties
```typescript
await page.evaluate(() => {
  element.writableProperty = 'new value'
})
```

### **✅ Do**: Verify property reactivity
```typescript
// All properties are reactive and trigger updates
const propertyValue = await page.evaluate(() => element.property)
expect(propertyValue).toBe('expected')
```

### **✅ Do**: Verify DOM synchronization
```typescript
await expect(checkbox).toBeChecked()
await expect(component).toHaveAttribute('checked')
```

## Key Commands

```bash
# Start test server
bun run serve:examples

# Run all tests
bunx playwright test

# Run specific component tests
bunx playwright test tests/components/form-checkbox.spec.ts

# Run tests on specific browser
bunx playwright test --project=Chromium

# Build examples for testing
bun run build:examples
```

## Summary

Le Truc's testing approach ensures components work correctly in real-world scenarios where:
- User interactions drive sensor property changes
- Writable properties can be controlled by external JavaScript
- All properties are reactive and trigger appropriate updates
- Components maintain their security boundaries for sensitive data
- The distinction between readonly sensors and writable properties is clearly defined

Always check the component's Props interface to understand which properties are readonly sensors (controlled by user interaction) versus writable reactive properties (controllable by external JavaScript).
