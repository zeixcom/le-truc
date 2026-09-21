/**
 * React runtime floor (LT-266 size bet): the smallest module that still
 * pulls in and starts React's hydration machinery — what every React page
 * ships once, amortized across all components on the page.
 */
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'

const root = document.getElementById('root')
if (root) hydrateRoot(root, createElement(() => null))
