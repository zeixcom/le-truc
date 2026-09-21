/**
 * Browser entry of the React side of the size bet (LT-266): read the JSON
 * payload the page embedded and hydrate the server-rendered app. This is
 * the module a bundler ships for the todo page — React plus the component
 * tree.
 */
import { hydrateRoot } from 'react-dom/client'
import { createElement } from 'react'
import { ModuleTodo, type TodoItem } from './module-todo'

const payload = document.getElementById('initial-todos')
if (!payload?.textContent) throw new Error('missing #initial-todos payload')
const initial = JSON.parse(payload.textContent) as TodoItem[]

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')
hydrateRoot(root, createElement(ModuleTodo, { initial }))
