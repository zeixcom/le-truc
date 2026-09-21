/**
 * React twin of the Le Truc `module-todo` composite (LT-266 size bet) —
 * the same component split (ModuleTodo composing FormTextbox, BasicButton,
 * BasicPluralize, FormCheckbox, FormInplaceEdit, FormRadiogroup), the same
 * DOM shape, and the same behaviors: add, remove, complete, in-place edit,
 * filter, clear-completed, drag-and-drop and keyboard reordering, and live
 * region announcements.
 *
 * The initial items arrive as props, serialized by the page into a JSON
 * payload script — the state channel React hydration needs that the Le Truc
 * twin replaces by harvesting the server-rendered DOM.
 */
import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { BasicButton } from './components/basic-button'
import { BasicPluralize } from './components/basic-pluralize'
import { FormCheckbox } from './components/form-checkbox'
import { FormInplaceEdit } from './components/form-inplace-edit'
import { FormRadiogroup } from './components/form-radiogroup'
import { FormTextbox, type FormTextboxHandle } from './components/form-textbox'

export type TodoItem = {
	id: string
	label: string
	createdAt: string
	completed: boolean
}

type Filter = 'all' | 'active' | 'completed'

const DRAG_THRESHOLD = 5

export type ModuleTodoProps = {
	/** Initial items, hydrated from the page's JSON payload. */
	initial: TodoItem[]
}

export function ModuleTodo({ initial }: ModuleTodoProps) {
	const [todos, setTodos] = useState<TodoItem[]>(initial)
	const [draft, setDraft] = useState('')
	const [filter, setFilter] = useState<Filter>('all')
	const [status, setStatus] = useState('')
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	// Drag bookkeeping is pointer-event-owned transient state: the active
	// drag reads/writes it across pointermove without re-rendering. The
	// current todos and drop index are mirrored in refs so the pointerup
	// commit never acts on a stale closure.
	const dragRef = useRef<{
		id: string | null
		startY: number
		startX: number
		offsetY: number
		rect: DOMRect | null
		active: boolean
		suppressNextClick: boolean
	}>({
		id: null,
		startY: 0,
		startX: 0,
		offsetY: 0,
		rect: null,
		active: false,
		suppressNextClick: false,
	})
	const [dropIndex, setDropIndex] = useState<number | null>(null)
	const dropIndexRef = useRef<number | null>(null)
	const [dragPos, setDragPos] = useState<{
		left: number
		top: number
		width: number
	} | null>(null)
	const listRef = useRef<HTMLOListElement>(null)
	const textboxRef = useRef<FormTextboxHandle>(null)
	const idCounter = useRef(initial.length)

	const completedCount = useMemo(
		() => todos.filter(todo => todo.completed).length,
		[todos],
	)
	const activeCount = todos.length - completedCount

	const visible = todos.filter(todo => {
		if (filter === 'active') return !todo.completed
		if (filter === 'completed') return todo.completed
		return true
	})

	const addTodo = () => {
		const label = draft.trim()
		if (!label) return
		setTodos(previous => [
			...previous,
			{
				id: `todo${++idCounter.current}`,
				label,
				createdAt: new Date().toISOString(),
				completed: false,
			},
		])
		setDraft('')
		textboxRef.current?.clear()
	}

	const removeTodo = (key: string) => {
		setTodos(previous => previous.filter(todo => todo.id !== key))
		if (selectedKey === key) setSelectedKey(null)
	}

	const toggleTodo = (key: string, completed: boolean) => {
		setTodos(previous =>
			previous.map(todo => (todo.id === key ? { ...todo, completed } : todo)),
		)
	}

	const renameTodo = (key: string, label: string) => {
		setTodos(previous =>
			previous.map(todo => (todo.id === key ? { ...todo, label } : todo)),
		)
	}

	const clearCompletedTodos = () => {
		setTodos(previous => previous.filter(todo => !todo.completed))
	}

	const announceSelection = (key: string) => {
		const todo = todos.find(candidate => candidate.id === key)
		if (!todo) return
		const position = todos.findIndex(candidate => candidate.id === key) + 1
		setStatus(
			`${todo.label} selected, position ${position} of ${todos.length}. ` +
				`Press Up or Down arrow to move.`,
		)
	}

	const moveTodo = (key: string, direction: -1 | 1) => {
		const from = todos.findIndex(todo => todo.id === key)
		const to = from + direction
		if (from < 0 || to < 0 || to >= todos.length) return
		const next = [...todos]
		const [moved] = next.splice(from, 1)
		next.splice(to, 0, moved!)
		setTodos(next)
		setStatus(`${moved!.label} moved to position ${to + 1} of ${next.length}.`)
	}

	const onReorderKeydown = (key: string, event: KeyboardEvent<HTMLElement>) => {
		if (selectedKey !== key) return
		if (event.key === 'Escape') {
			setSelectedKey(null)
			return
		}
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
		event.preventDefault()
		moveTodo(key, event.key === 'ArrowUp' ? -1 : 1)
	}

	const onItemPointerDown = (
		key: string,
		event: ReactPointerEvent<HTMLButtonElement>,
	) => {
		const handle = event.currentTarget
		event.preventDefault()
		const item = handle.closest<HTMLElement>('[data-key]')
		if (!item) return
		dragRef.current = {
			id: key,
			startY: event.clientY,
			startX: event.clientX,
			offsetY: 0,
			rect: item.getBoundingClientRect(),
			active: false,
			suppressNextClick: false,
		}
		handle.setPointerCapture(event.pointerId)
		handle.focus()

		const handleMove = (e: PointerEvent) => {
			const drag = dragRef.current
			if (!drag.id || !drag.rect) return
			const dy = Math.abs(e.clientY - drag.startY)
			const dx = Math.abs(e.clientX - drag.startX)
			if (!drag.active && (dy > DRAG_THRESHOLD || dx > DRAG_THRESHOLD)) {
				drag.active = true
				drag.offsetY = drag.startY - drag.rect.top
				setDragPos({
					left: drag.rect.left,
					top: drag.rect.top,
					width: drag.rect.width,
				})
			}
			if (!drag.active) return
			setDragPos({ left: drag.rect.left, top: e.clientY - drag.offsetY, width: drag.rect.width })
			// Which rendered row the pointer is over decides the drop index.
			const rows = Array.from(
				listRef.current?.querySelectorAll<HTMLElement>('li[data-key]') ?? [],
			).filter(row => row.dataset.key !== drag.id)
			let index = rows.length
			for (let i = 0; i < rows.length; i++) {
				const rowRect = rows[i]!.getBoundingClientRect()
				if (e.clientY < rowRect.top + rowRect.height / 2) {
					index = i
					break
				}
			}
			dropIndexRef.current = index
			setDropIndex(index)
		}

		const commit = () => {
			const drag = dragRef.current
			if (drag.active && drag.id && dropIndexRef.current !== null) {
				setTodos(previous => {
					const from = previous.findIndex(todo => todo.id === drag.id)
					if (from < 0) return previous
					const filtered = previous.filter(
						todo =>
							todo.id !== drag.id &&
							(filter === 'active'
								? !todo.completed
								: filter === 'completed'
									? todo.completed
									: true),
					)
					const target = filtered[dropIndexRef.current ?? filtered.length]
					const to = target
						? previous.findIndex(todo => todo.id === target.id)
						: previous.length
					const next = [...previous]
					const [moved] = next.splice(from, 1)
					next.splice(from < to ? to - 1 : to, 0, moved!)
					setStatus(
						`${moved!.label} moved to position ${next.indexOf(moved!) + 1} of ${next.length}.`,
					)
					return next
				})
				drag.suppressNextClick = true
			}
			drag.id = null
			drag.active = false
			setDragPos(null)
			setDropIndex(null)
			dropIndexRef.current = null
			handle.removeEventListener('pointermove', handleMove)
			handle.removeEventListener('pointerup', commit)
			handle.removeEventListener('pointercancel', cancel)
		}

		const cancel = () => {
			dragRef.current.id = null
			dragRef.current.active = false
			setDragPos(null)
			setDropIndex(null)
			dropIndexRef.current = null
			handle.removeEventListener('pointermove', handleMove)
			handle.removeEventListener('pointerup', commit)
			handle.removeEventListener('pointercancel', cancel)
		}

		handle.addEventListener('pointermove', handleMove)
		handle.addEventListener('pointerup', commit)
		handle.addEventListener('pointercancel', cancel)
	}

	const draggingId = dragPos === null ? null : dragRef.current.id
	const rows: Array<{ todo: (typeof visible)[number] } | 'marker'> = []
	if (dragPos !== null && dropIndex !== null) {
		visible.forEach((todo, index) => {
			if (index === dropIndex) rows.push('marker')
			rows.push({ todo })
		})
	} else {
		visible.forEach(todo => rows.push({ todo }))
	}

	return (
		<module-todo
			onClick={event => {
				if (dragRef.current.suppressNextClick) {
					dragRef.current.suppressNextClick = false
					return
				}
				const target = event.target as HTMLElement
				const item = target.closest<HTMLElement>('[data-key]')
				if (!item?.dataset.key) return
				if (target.closest('basic-button.remove')) {
					event.stopPropagation()
					removeTodo(item.dataset.key)
				} else if (target.closest('button.reorder')) {
					setSelectedKey(item.dataset.key)
					announceSelection(item.dataset.key)
				}
			}}
		>
			<form
				action="#"
				onSubmit={event => {
					event.preventDefault()
					addTodo()
				}}
			>
				<FormTextbox
					ref={textboxRef}
					label="What needs to be done?"
					inputId="add-todo"
					value={draft}
					onValueChange={setDraft}
					clearable
				/>
				<BasicButton
					type="submit"
					variant="constructive"
					label="Add Todo"
					disabled={draft.trim() === ''}
				/>
			</form>
			<span role="status" className="visually-hidden">
				{status}
			</span>
			<ol data-container="" ref={listRef}>
				{rows.map(row =>
					row === 'marker' ? (
						<li key="drop-marker" className="drop-marker" aria-hidden="true" />
					) : (
						<li
							key={row.todo.id}
							data-key={row.todo.id}
							className={row.todo.id === draggingId ? 'dragging' : undefined}
							style={
								row.todo.id === draggingId && dragPos !== null
									? {
											position: 'fixed',
											left: dragPos.left,
											top: dragPos.top,
											width: dragPos.width,
										}
									: undefined
							}
						>
							<button
								type="button"
								className="reorder"
								aria-label="Drag to reorder"
								aria-pressed={selectedKey === row.todo.id}
								disabled={todos.length === 1}
								onPointerDown={event =>
									onItemPointerDown(row.todo.id, event)
								}
								onKeyDown={event => onReorderKeydown(row.todo.id, event)}
							>
								≡
							</button>
							<FormCheckbox
								checked={row.todo.completed}
								onChange={checked => toggleTodo(row.todo.id, checked)}
							>
								<FormInplaceEdit
									value={row.todo.label}
									onCommit={value => renameTodo(row.todo.id, value)}
								/>
							</FormCheckbox>
							<BasicButton
								variant="tertiary destructive small"
								label="✕"
								ariaLabel="Remove"
								onClick={event => {
									event.stopPropagation()
									removeTodo(row.todo.id)
								}}
							/>
						</li>
					),
				)}
			</ol>
			<footer>
				<BasicPluralize
					count={activeCount}
					none="Well done, all done!"
					one="task"
					other="tasks"
				/>
				<FormRadiogroup
					legend="Filter"
					value={filter}
					options={[
						{ value: 'all', label: 'All' },
						{ value: 'active', label: 'Active' },
						{ value: 'completed', label: 'Completed' },
					]}
					onChange={value => setFilter(value as Filter)}
				/>
				<BasicButton
					variant="tertiary destructive"
					label="Clear Completed"
					badge={completedCount > 0 ? String(completedCount) : ''}
					disabled={completedCount === 0}
					onClick={clearCompletedTodos}
				/>
			</footer>
		</module-todo>
	)
}
