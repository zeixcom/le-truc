/**
 * Test harness for helper calls outside a factory (ADR 0018).
 *
 * `activate()` runs `fn` inside a fresh collector, then activates everything
 * the helpers registered — the same collect-then-activate pipeline
 * `connectedCallback` runs. Returns the enclosing scope's dispose, so a test
 * can tear down what activated (listeners, effects, per-element scopes).
 */

import { createScope } from '@zeix/cause-effect'
import { activateDescriptors } from '../helpers/reactive'
import { withCollector } from '../internal'
import type { EffectDescriptor } from '../types'

const activate = (fn: () => void): (() => void) | undefined =>
	createScope(() => {
		const collected: EffectDescriptor[] = []
		withCollector(collected, fn)
		activateDescriptors(collected)
	})

export { activate }
