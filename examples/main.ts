// Site cutover (LT-092): every migrated component mounts its COMPILED client
// from server/generated/tsrx (gitignored build output — scripts/build-tsrx.ts
// regenerates it; build:examples:js runs that compiler step before bundling,
// and server/build.ts sequences the tsrx effect in phase 1 ahead of the js
// bundle for the same reason). The hand-written .ts twins are deleted per the
// card-blogpost/card-callout precedent.
// basic-button cut over in LT-117 — it OWNS its template (the server
// renders the button and its spans from the args) and harvests
// label/badge/disabled back out of that same markup at connect, so a
// page may also author the markup itself, in whole or in part.
import '../server/generated/tsrx/basic-button.client.ts'
import '../server/generated/tsrx/basic-counter.client.ts'
// basic-gauge and basic-pluralize cut over in LT-115: the arg→DOM
// substitution now routes derived signals through the exposed prop's Slot
// (a tracked source — post-connect writes re-derive instead of freezing),
// and root harvest sites read the ambient `host` instead of an illegal
// `first('<own-tag>')` self-query. Both components were reshaped to their
// twins' contracts (gauge: meter-fallback harvest + observedAttributes;
// pluralize: getLocale thunks, no setup signals) — see their .tsrx headers.
import '../server/generated/tsrx/basic-gauge.client.ts'
import '../server/generated/tsrx/basic-number.client.ts'
import '../server/generated/tsrx/basic-hello.client.ts'
import '../server/generated/tsrx/basic-pluralize.client.ts'
import './card/blogmeta/card-blogmeta.ts'
import '../server/generated/tsrx/card-collapsible.client.ts'
import '../server/generated/tsrx/card-colorscale.client.ts'
import '../server/generated/tsrx/card-mediaqueries.client.ts'
import './context/media/context-media.ts'
import './docs/lifecycle/docs-lifecycle.ts'
import './docs/reconcile/docs-reconcile.ts'
import './docs/task-states/docs-task-states.ts'
import '../server/generated/tsrx/form-checkbox.client.ts'
import '../server/generated/tsrx/form-colorgraph.client.ts'
import '../server/generated/tsrx/form-combobox.client.ts'
import '../server/generated/tsrx/form-inplace-edit.client.ts'
import '../server/generated/tsrx/form-listbox.client.ts'
// form-radiogroup cut over in LT-116: the loop-body `checked` mirror lowers
// to a property write (the compiler's dirty-flag dispatch widening), so the
// compiled client restores the twin's mutual exclusion after interaction.
import '../server/generated/tsrx/form-radiogroup.client.ts'
import '../server/generated/tsrx/form-spinbutton.client.ts'
import '../server/generated/tsrx/form-textbox.client.ts'
import '../server/generated/tsrx/form-tokenbox.client.ts'
import './module/calctable/module-calctable.ts'
import './module/carousel/module-carousel.ts'
import './module/catalog/module-catalog.ts'
import './module/cem-list/module-cem-list.ts'
import './module/codeblock/module-codeblock.ts'
import './module/coloreditor/module-coloreditor.ts'
import './module/colorinfo/module-colorinfo.ts'
import './module/dialog/module-dialog.ts'
import './module/lazyload/module-lazyload.ts'
import '../server/generated/tsrx/module-list.client.ts'
import './module/listnav/module-listnav.ts'
import './module/pagination/module-pagination.ts'
import './module/scrollarea/module-scrollarea.ts'
import './module/splitview/module-splitview.ts'
import '../server/generated/tsrx/module-tabgroup.client.ts'
import './module/ticker/module-ticker.ts'
import './module/todo/module-todo.ts'
import './test/audit/test-audit.ts'
import './test/context/test-context.ts'
import './test/context/test-context-late-provider.ts'
import './test/debug/test-debug.ts'
import './test/debug/test-debug-collision.ts'
import './test/security/test-security.ts'
import './test/each/test-each.ts'
import './test/expose/test-expose.ts'
import './test/on/test-on.ts'
import './test/pass/test-pass.ts'
import './test/watch/test-watch.ts'

// Structural-only custom elements — no behavior, just layout containers.
// Declared as named classes (not inline expressions) so the CEM analyzer
// extracts proper PascalCase names + descriptions for editor LSP awareness.
//
// card-blogpost and card-callout used to be stubs here too; both migrated to
// .tsrx (fb06e37a, LT-033/LT-034) — same structural-only shape, now compiled
// from examples/card/{blogpost,callout}/*.tsrx and read into the CEM
// manifest from their generated client, so a stub here would double-declare
// the tag (verify-cem.ts's duplicate-tag guard).

/** Wrapper around a live component preview in the docs. */
class ModuleDemo extends HTMLElement {}
customElements.define('module-demo', ModuleDemo)

/** Table-of-contents container. */
class ModuleToc extends HTMLElement {}
customElements.define('module-toc', ModuleToc)

/** Hero section at the top of a page. */
class SectionHero extends HTMLElement {}
customElements.define('section-hero', SectionHero)

/** Navigation menu section. */
class SectionMenu extends HTMLElement {}
customElements.define('section-menu', SectionMenu)
