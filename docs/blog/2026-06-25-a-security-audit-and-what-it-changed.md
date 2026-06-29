---
title: "A Security Audit and What It Changed"
description: "Le Truc 2.1 ships the fixes from a code audit – Trusted Types support for dangerouslyBindInnerHTML, an isSafeURL bypass closed, and pass() failures that now throw instead of failing silently."
emoji: "🔒"
date: 2026-06-25
author: "Esther Brunner"
tags: security, release
---

We ran a code audit on Le Truc looking specifically for security vulnerabilities and bugs that silent failures could be hiding. Version 2.1 is the result: a handful of real fixes, and a more honest error contract in a few places that used to fail quietly.

## TrustedHTML support for dangerouslyBindInnerHTML

Since `TrustedHTML` is newly supported by all major browsers (Baseline 2026) we asked a simple question: what happens on a page that enforces `Content-Security-Policy: require-trusted-types-for 'script'`? The answer was that it just broke – the DOM rejects a plain string assignment to `innerHTML` under that policy, no matter how well you sanitized it first.

`dangerouslyBindInnerHTML`, Le Truc's only `innerHTML` sink, now accepts a `sanitize` hook that can return either a `string` or a `TrustedHTML`:

```ts
dangerouslyBindInnerHTML(element, {
  sanitize: html => DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: true }),
})
```

Configure DOMPurify with `RETURN_TRUSTED_TYPE: true`, or use `window.trustedTypes.createPolicy(...).createHTML(...)`, and the assignment succeeds even under Trusted Types enforcement. Without that hook, the call still throws on an enforcing page – correctly. Le Truc ships no sanitizer of its own; `sanitize` is the one chokepoint where you wire one in.

One more thing worth being direct about: `allowScripts: false` was never a safety switch. Setting `innerHTML` fires event-handler attributes either way – for example: `<img onerror>`, `<svg onload>`. If the content isn't trusted, sanitize it. There's no flag that makes that step optional.

## pass() now throws instead of failing silently

`pass()` binds a live signal from a parent component to a child. Until now, three ways that binding could fail – a prop that doesn't exist on the target, a value that can't resolve to a signal, a target prop that isn't Slot-backed – only logged a `DEV_MODE` warning. In previous versions if you passed a prop to a Lit component, a FAST component, or a vanilla custom element, and it silently did nothing. The same goes for a read-only or computed property on a Le Truc component.

Every prop you list in a `pass()` call is a declared intent to bind a signal. There's no good reason to list one that can never bind. So now it throws `InvalidPassPropertyError`, naming every prop that failed and why, validated before any signal is swapped – either the whole call binds, or none of it does.

If your components only ever pass props between Le Truc components, to writable properties, this changes nothing. If you were trying to pass to a non-Le-Truc element or a read-only prop, that silent no-op is now a loud failure, and you'll want to fix the call site.

## The rest of the audit

A few more fixes came out of the same pass:

- `isSafeURL` closed a bypass where a scheme with internal whitespace (`java\tscript:`) or a protocol-relative URL (`//evil.com`) slipped past the `javascript:`/`data:` checks. This is the main XSS surface in `bindAttribute`, so it mattered.
- A throwing scheduled task no longer takes down the rest of the animation frame with it – each task and throttled callback now has its own error boundary.
- Reconnecting a component (after a reparent or re-slot) no longer leaks the previous activation's listeners and effects.
- `asJSON` now strips `__proto__` and `constructor` keys at every nesting level, and reserved property names throw `InvalidPropertyNameError` at the component level too.

The full list, with the reasoning behind each one, is in the [CHANGELOG](https://github.com/zeixcom/le-truc/blob/main/CHANGELOG.md#210) and in [ADR 0010](https://github.com/zeixcom/le-truc/blob/main/adr/0010-trusted-types-support-via-sanitize-hook.md) and [ADR 0011](https://github.com/zeixcom/le-truc/blob/main/adr/0011-throw-on-pass-binding-failure.md).

## What this means for you

We take this seriously enough to have gone looking for problems before someone else found them for us. That's the point of an audit.

For almost every component you've written, none of this requires a migration. The core API – `defineComponent`, `bind*`, `pass`, `dangerouslyBindInnerHTML` – is unchanged. If you weren't relying on `pass` silently ignoring what never worked or on illogical `attr="FALSE"` evaluating to `true`, version 2.1 is a drop-in upgrade. Run your test suite, and you'll know for sure.
