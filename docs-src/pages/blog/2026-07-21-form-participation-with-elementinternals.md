---
title: Form Participation with ElementInternals
description: Le Truc 2.3 adds form association and custom :state() pseudo-classes via ElementInternals, but stops short of promoting ARIA reflection until the accessibility tooling catches up.
emoji: 📝
layout: blog
date: 2026-07-21
author: Esther Brunner
tags: forms, accessibility, release
---

{% section %}
Le Truc components have never been able to act as real form controls. If you've written `form-listbox`, `form-colorgraph`, or `form-spinbutton`, you've seen the workaround: a hidden `<input>` synced by hand, with a `change` event dispatched manually to make the value show up on submit. It works, but it's a tax you pay on every form component, and it has a bug — reset the form and the hidden input reverts while the component's own state doesn't.

`ElementInternals` is the platform's answer to this. It's Baseline across evergreen browsers now, and it covers three things at once: form association (`setFormValue`, reset, disable, state restore), custom `:state()` pseudo-classes, and ARIA reflection. Le Truc 2.3 adopts the first two. The third is available, but we're not telling you to use it yet.

## Form association, with almost no code

A component opts in with a third argument to `defineComponent`:

```ts
defineComponent<FormListboxProps>(
	'form-listbox',
	({ host, expose, watch, each }) => {
		// ...
	},
	{ formAssociated: true },
)
```

From there, the convention is simple: expose a `value` prop, and Le Truc handles the rest. It watches `value` and calls `internals.setFormValue()` for you. It restores `value` to its default on form reset. It reflects `formDisabledCallback` — including disabling via an ancestor `<fieldset disabled>` — into a managed `disabled` property. `checkValidity()`, `reportValidity()`, `validity`, `validationMessage`, and `setCustomValidity()` all appear on the host, backed by `internals`, exactly like on a native `<input>`.

The result: `form-listbox` drops its hidden input and the reset bug along with it. `form-colorgraph` submits one value instead of three separate named inputs. `form-textbox` and `form-combobox` lose the manual relay from `checkValidity()` to an `aria-invalid` attribute — the browser's own `:invalid` and `:user-invalid` pseudo-classes do that job now.

## Custom states for styling hooks

`:state()` pseudo-classes aren't tied to forms — any component gets a live `internals` object, and `bindState()` mirrors the existing `bindClass()` binding:

```ts
watch(hasOverflow, bindState(internals, 'overflow'))
watch(overflowStart, bindState(internals, 'overflow-start'))
watch(overflowEnd, bindState(internals, 'overflow-end'))
```

`module-scrollarea` uses this to expose whether it's scrolled to the start, the end, or has no overflow at all, so a consumer can write `module-scrollarea:state(overflow-end) { ... }` in their own stylesheet. Unlike a CSS class, a custom state can't be clobbered by another script rewriting the host's `class` attribute — it's a styling hook the component owns outright.

## Why ARIA reflection is different

`internals.role` and `internals.aria*` properties are also sitting right there on the same object, and we thought about wrapping them the same way. We didn't, and the reason is specific: browsers and accessibility testing tools don't reliably see them yet. axe-core has open issues producing false positives against `internals`-set ARIA state. Chromium doesn't consistently update the accessibility tree from it. The spec gap is still open with the W3C.

There's a concrete failure mode this protects against. Imagine a `<basic-button>` that sets `internals.role = 'button'` and then drops its inner native `<button>` element, relying on the ARIA reflection to carry the semantics. Static analysis tools wouldn't catch that this could break button nesting rules, because they can't see the reflected role. You'd ship an inaccessible component and nothing in your toolchain would tell you.

So `internals` is exposed on the factory context — we can't take it away, since it's one object — but we're not adding `bindAria()` helpers, and we're not using ARIA reflection in any example component. Keep writing explicit `aria-*` attributes and reaching for native semantic elements first. When the tooling catches up, we'll revisit this.

## What this means for you

Nothing changes for existing components — `formAssociated` is opt-in, and `internals` is a new addition to the factory context, not a change to an existing one. If you're maintaining a form control that currently juggles a hidden input, this is worth a look: read [ADR 0016](https://github.com/zeixcom/le-truc/blob/main/adr/0016-element-internals-for-form-association-and-states.md) for the full convention, or look at `form-listbox` and `form-colorgraph` in `examples/` for the before-and-after.
{% /section %}
