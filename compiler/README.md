# @zeix/le-truc-compiler

The Le Truc component compiler. It compiles a corpus of authored component
sources — `.tsx` (the **stable** surface) and `.tsrx` (**experimental**: it
compiles and ships, and it may change or be removed in any minor release
while so labeled) — into server render modules, client modules and scoped
CSS. The browser runtime ships separately as
[`@zeix/le-truc`](https://www.npmjs.com/package/@zeix/le-truc), declared here
as a peer dependency.

## Install

```sh
npm install @zeix/le-truc-compiler @zeix/le-truc
```

`jsdom` is an optional peer: install it to unlock the Simulated evaluation
tier; without it, components that would route Simulated route Static and the
tier census records `unavailable substrate`. The `typescript` peer (pinned to
the range the `.tsx` front end's parser supports) is required for `.tsx`
sources.

## Use

The one entry point is the corpus pass:

```ts
import { compileCorpus, type CorpusConfig } from '@zeix/le-truc-compiler'

const config: CorpusConfig = {
	root: process.cwd(),
	sources: ['src/components/**/*.tsx', 'src/components/**/*.tsrx'],
	siblingModules: [],
	outDir: 'build/le-truc',
	i18nDir: 'i18n',
	locales: ['en'],
	variantSurface: 'tsx',
	variantOverrides: {},
	cssTargets: {},
}

const { diagnostics, summary } = await compileCorpus(config)
```

`compileCorpus` scans the configured sources, compiles both corpus passes and
writes every artifact to `outDir` — the generated `*.server.ts` /
`*.client.ts` / `*.css` per component, `registry.json`, the `i18n` module —
then returns the diagnostics and a summary. Errors are returned, never
thrown: the caller decides whether they fail its build.

Authored sources import the compile-time markers from the `/macros`
subpath — `css` (the stylesheet tag) and `harvest()` (server-seed parsers):

```ts
import { css, harvest } from '@zeix/le-truc-compiler/macros'
```

The markers are consumed at compile time and stripped from the generated
modules; the shipped stubs throw if a source reaches them uncompiled. The
`/macros` module has no dependencies of its own.

Generated server modules import the render harness from this package's
`/runtime` subpath — the default `runtimeImport`, so a consumer never sets
that field.

Documentation: [zeixcom.github.io/le-truc](https://zeixcom.github.io/le-truc/)
