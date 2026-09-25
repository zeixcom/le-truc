# TODO

Current iteration only. Part of the 3-file mini-kanban (owner, 2026-09-18) with `BACKLOG.md`
(everything planned, out of iteration scope — new tasks are created there) and `DONE.md`
(done-and-reviewed tasks since the last release, compacted for Changelog Keeper). Only the
Architect moves tasks between files; developers annotate the status suffix on the entry in
place. Task IDs are global and sequential across all three files.

**Current iteration (opened 2026-09-25): wave 4 at cadence — six migrations, and the gates
they trip first.** Drawn from [BACKLOG.md](BACKLOG.md)'s P1, P3 and P5 bands. The previous
iteration ("opening wave 4 — the last gates cleared, and the first migrations land") is fully
landed and reviewed: ADR 0039's variant sets, ADR 0040's `ForIR` split, `@empty`, LTC053,
composition across tiers, the spike fixtures rehomed, module-codeblock served as `.tsx`,
LTC054 and suite determinism. Compacted records are in `DONE.md`; the public summary is in
`CHANGELOG.md [Unreleased]`.

**Why these fifteen** (twenty-three with the addendum below). Module-codeblock proved one migration end to end. This iteration moves
the wave from proof to cadence with the six components that need nothing undesigned:
four leaves (**LT-099** pagination, **LT-101** dialog, **LT-102** splitview, **LT-103**
scrollarea) and two composites over `.tsrx` children (**LT-098** colorinfo, **LT-100** catalog).
Each migration trips a filed gate, and those gates run first. **LT-291**: every migration
retains a `.ts` twin, so the first compiled parent that references a migrated tag (codeblock
renders `<module-scrollarea>`) would import the twin. **LT-312**: the two composites are `.tsx`
parents over `.tsrx` children, the case the hand-listed typings file cannot scale to.
**LT-307**: scrollarea is the migration most likely to land Simulated, and would be the first
`.tsx`-served Simulated entry. Each migration adds a variant set, so **LT-295/LT-296** put the
variant matrix in CI and make its surface tests fail loudly instead of passing vacuously.
**LT-292** rides with LT-291 (same `compileCorpus` code). **LT-299** turns `biome check ./server`
green, so the gates the migrations cite read true. **LT-313/LT-314** are the LT-258 riders, run in
a parallel slot. LT-313 is the last gate in front of LT-257 (template emission, pioneer 2's
critical path) that does not wait on publishing.

**Addendum (2026-09-25): the migration follow-ups.** The six migrations' reviews filed defects
that sit on the components this iteration migrated, so the iteration closes them before it
exits. **LT-316** is the systemic one: the compiler swaps authored `first()` selectors for
synthesized ones, which narrows splitview's contract and widens colorinfo's. It is also the gate
for the next batch. **LT-318** (dialog's connect-time scroll jump), **LT-320**/**LT-321**/**LT-322**
(catalog: interim `data-product` fallback, missing badge site, empty `each()`) and **LT-317**
(pagination's empty pre-JS spans) fix the served components. **LT-323** brings scrollarea back
in line with ADR 0029. **LT-324** gives splitview and colorinfo the specs `test:variants` needs
to verify them at all. Left in the backlog: LT-319 (the imperative `pass(all(…))` form is
sanctioned, so the design question is low priority) and LT-325 (typings hygiene, no component
behaviour).
**Review (2026-09-25):** all eight follow-ups approved and moved to `DONE.md`, together with
the four migrations still held here, after `test:variants` ran green for every variant set on
every surface (owner run, 2026-09-25). **LT-327** joins the iteration: it is the LT-323 regression, and it gates
the next batch alongside LT-316. LT-328 (docs) and LT-329 (`check:sim` on a clean tree) are in
the backlog.

**Deliberately not here.** LT-104 lazyload waits on LT-303 (`truc:try`). LT-105 coloreditor and
LT-107 listnav compose the tags this iteration migrates, so they follow once LT-291 holds. LT-095
blogmeta is a contract reshape with consumer ports, and LT-106 context-media has no spec. All of
those form the next migration batch, together with LT-301 (the loop-in-branch gate) and LT-108
carousel. LT-280's grilling still waits for the iteration that implements it (it gates only
LT-109/110/111). LT-309–LT-311 (codeblock follow-through, plus two designs) wait until the
batch shows how often the root-attribute and compose-event patterns recur. The i18n chain
(LT-242 → LT-233 → LT-250), the ADR 0037 implementation (LT-274–276) and the ADR 0033 CSS track
(LT-268 → LT-304/306) do not contend with this iteration and keep for later ones.

**Exit criterion:** six more examples serve as compiled `.tsx` with their `.ts` twins retained,
every spec green on every surface they carry, zero warnings and tier + reason recorded
(LT-098–LT-103, scrollarea's wall-time figures included); a bundle defines each migrated tag
exactly once, from the generated client, even where a compiled parent references it (LT-291);
`tsrx-imports.d.ts` is generated, not hand-written (LT-312); CI runs `test:variants`, and a
broken twin fails it (LT-295, LT-296); a stale `variantOverrides` entry is a config error
(LT-292); `bunx biome check ./server` exits 0 (LT-299); a server-data loop over `document` and a
folded `crypto.randomUUID()` both fail the build (LT-313, LT-314). The migrated components
preserve their authored contracts and match their twins' served behaviour: authored selectors
emitted (LT-316), `data-product` restored and the catalog badge server-rendered (LT-320,
LT-321), no connect-time dialog scroll (LT-318), pagination's spans filled pre-JS (LT-317), no
empty `each()` (LT-322), scrollarea not Simulated (LT-323) without a false Folded
elsewhere (LT-327), and splitview and colorinfo green on
both surfaces through their new specs (LT-324).

**Next free task ID: LT-330.**

---

### Migrations (leaf components first, then the two composites, then scrollarea)

All six landed and are green on every surface; see `DONE.md` (LT-098–LT-103).

### Migration follow-ups — defects in this iteration's migrated components

- [ ] LT-327: A context-member initializer read by a render position must not classify Folded (LT-323 review). **Gate: before the next migration batch.**
  **Skill:** le-truc-dev
  **Context:** LT-323 lets a signal credited only by client-only reads seed from an initializer
  over FactoryContext members (`allowContextMembers`). The "only" test is
  `!renderCredited.has(signal)`, and `renderCredited` is the pre-LT-323 `thunkRendered`, which
  records only direct `sig.get()` calls in template thunks. It is not transitive through the
  new carriers. Reproduction (a `.tsrx`): `const count = createMemo(() => all('li').get().length)`,
  `const label = () => String(count.get())`, `watch(label, …)`, and `<p>{() => label()}</p>`.
  That compiles **Folded** with zero routing signals. Its server module then declares
  `count = createMemo(() => all(…))` with `all` undeclared, which is TS2304 at `check:corpus`
  and a ReferenceError at render. Before LT-323 the same shape routed Simulated. ADR 0029 makes
  a false Folded the forbidden direction ("any doubt routes downward"). This one fails loudly
  instead of shipping wrong HTML, but it is still a misclassification.
  **Rule:** compute render credit through the same `carriedBy` closure. Every template render
  position — reactive/class-map/style-map/`truc:html` thunks, lazy and non-lazy expression
  children, server attributes, `@if`/`@switch` tests — contributes `carriedBy(node)` to
  `renderCredited`. `allowContextMembers` holds only for a signal outside that set. Leave the
  literal-initializer credit (the LT-119 route) untouched; it is sound either way.
  **Accept:** the reproduction routes Simulated (LTC004) and gets a test in
  `client-setup-credit.test.ts`. The corpus census is unchanged (27/2/0), with scrollarea and
  catalog still Folded.
