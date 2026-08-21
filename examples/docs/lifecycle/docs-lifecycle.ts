import { bindText, createCell, defineComponent } from '../../../index'

/**
 * Teaching components for the "Component Lifecycle" section of the docs.
 *
 * `docs-pulse` is a real Le Truc component whose factory run and cleanup
 * are observable as DOM events. `docs-lifecycle` is the playground: it
 * connects and disconnects instances of `docs-pulse` on demand and logs
 * what actually happens — factory, effect setup, cleanup.
 */

const EVENT = 'docs-lifecycle:event'

type LifecycleDetail = { kind: 'factory' | 'setup' | 'cleanup'; id: number }

let instances = 0

/* === Child: the component under observation === */

defineComponent('docs-pulse', ({ expose, first, host, watch }) => {
	const id = ++instances
	const ticks = createCell(0)

	const instanceEl = first('.instance', 'Add a span.instance to docs-pulse.')
	const ticksEl = first('.ticks', 'Add a span.ticks to docs-pulse.')

	expose({
		instance: id,
		ticks: ticks.get, // read-only — only the component writes it
	})

	instanceEl.textContent = `#${id}`

	// The factory runs inside connectedCallback() — the host is in the DOM,
	// so this event bubbles to the playground while connect is happening.
	host.dispatchEvent(
		new CustomEvent<LifecycleDetail>(EVENT, {
			bubbles: true,
			composed: true,
			detail: { kind: 'factory', id },
		}),
	)

	// An interval needs manual setup and cleanup — the hand-authored
	// EffectDescriptor pattern from the lifecycle section, doing real work.
	watch(() => true, () => {
		host.dispatchEvent(
			new CustomEvent<LifecycleDetail>(EVENT, {
				bubbles: true,
				composed: true,
				detail: { kind: 'setup', id },
			}),
		)
		const interval = setInterval(() => ticks.update(t => t + 1), 1000)
		return () => {
			clearInterval(interval)
			// The element is already out of the DOM when cleanup runs, so
			// this event cannot bubble — it goes straight to the document.
			document.dispatchEvent(
				new CustomEvent<LifecycleDetail>(EVENT, {
					detail: { kind: 'cleanup', id },
				}),
			)
		}
	})

	watch(ticks, bindText(ticksEl))
})

/* === Parent: the playground === */

export default defineComponent('docs-lifecycle', ({ first, on, watch }) => {
	const stage = first('.stage', 'Add a .stage element as the playground for docs-pulse.')
	const connect = first('button.connect', 'Add a connect button to docs-lifecycle.')
	const disconnect = first('button.disconnect', 'Add a disconnect button to docs-lifecycle.')
	const log = first('ol.log', 'Add an ol.log to docs-lifecycle for the event log.')

	const entries: string[] = []
	const lines = createCell<string[]>([])
	const alive = createCell(stage.querySelector('docs-pulse') !== null)

	const record = (line: string) => {
		entries.unshift(line)
		if (entries.length > 6) entries.length = 6
		lines.set([...entries])
	}

	const describe = (detail: LifecycleDetail): string => {
		switch (detail.kind) {
			case 'factory':
				return `factory() ran — instance #${detail.id} connected`
			case 'setup':
				return 'effect setup — interval started'
			case 'cleanup':
				return `cleanup() ran — interval cleared, instance #${detail.id} gone`
		}
	}

	record('page loaded — server-rendered pulse upgraded in place')

	// Custom events from the child are not native event types, so they get
	// the same hand-authored effect treatment as any external observation.
	// One listener on document covers both cases: factory/setup bubble up
	// from inside the stage, and cleanup is dispatched on document directly
	// because the element is already out of the DOM when it runs.
	watch(() => true, () => {
		const handler = (e: Event) => {
			const line = describe((e as CustomEvent<LifecycleDetail>).detail)
			if (line) record(line)
		}
		document.addEventListener(EVENT, handler)
		return () => document.removeEventListener(EVENT, handler)
	})

	watch(alive, a => {
		connect.disabled = a
		disconnect.disabled = !a
	})

	on(connect, 'click', () => {
		const pulse = document.createElement('docs-pulse')
		pulse.innerHTML = '<span class="instance"></span><span class="ticks"></span>'
		stage.append(pulse)
		alive.set(true)
		record('stage.append(<docs-pulse>) — a fresh element')
	})

	on(disconnect, 'click', () => {
		stage.querySelector('docs-pulse')?.remove()
		alive.set(false)
		record('pulse.remove() — disconnectedCallback() runs all cleanups')
	})

	watch(lines, ls => {
		log.replaceChildren(
			...ls.map(line => {
				const li = document.createElement('li')
				li.textContent = line
				return li
			}),
		)
	})
})
