# ADR 0047: Harvest Through a Key Alias, Witnessed by the Render

## Status

✅ Accepted (owner, design session 2026-10-06) — extends [ADR 0046](0046-reactive-list-items-as-mount-scopes.md) s7.

## Context

The client has no server args. A list seeded from them is rebuilt at connect from the markup, field by field, from each item's canonical render site ([ADR 0046](0046-reactive-list-items-as-mount-scopes.md) s7, on [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md)). The compiler proves that every item renders in one way only: the list's own `map` renders it.

A flat list rendered through a nested grouping breaks that proof. A table split into `<tbody>` blocks, group-by sections, a paged or virtualized view all keep the data in one host-level list and render it through derived lists, one per group, whose items reach the data by key (`list.byKey(k)`). Whether those derived lists together enumerate every item is a question about derived membership, and that is undecidable in general. Yet the server executes the render, so it knows exactly which items it rendered. An unproved harvest fails silently: an item the server did not render never reaches the client, and nothing reports it.

## Decision

**Split the proof. The compiler proves where each field renders; the server render witnesses which items rendered.**

1. **The key alias (static, compiler channel, Prevented).** A host-level list seeded from server args, and never rendered by its own `map`, harvests through an alias: `const t = list.byKey(k)` in the item setup of a reactive list. The compiler accepts the alias only when all of the following hold:
   - the alias list's key is the loop key, and its item *is* that key (`keyConfig: k => k`);
   - the alias is `byKey` over that key, unconditionally, in item setup;
   - there is exactly one alias scope per harvested list, so each field has one canonical site;
   - every field of the item type is read at a canonical site through `t.get().<field>` under s7's rules: a parser is inferred or declared through `harvest()`, and a formatted site needs a raw source.

   Each unmet condition is its own diagnostic, naming the fix.

2. **The render witness (dynamic, server render).** The emitted server module records, in render order, the keys it renders at the alias scope. When the render ends, the first occurrences must equal the harvested list's keys: every key, in order. A mismatch throws a named error that names the list and the first missing or out-of-order key. Under static generation and the Server Simulation realm, this fails the build, so no page ships with a list the client would rebuild incomplete ([ADR 0028](0028-tiered-error-surfacing.md): Prevented in effect). The witness is what makes the harvest sound. A client cannot detect an item it never saw.

3. **Client harvest.** At connect, before anything reads the list, the client rebuilds it from every alias-scope root in document order, across all enclosing scopes, through a selector path the structural proof synthesizes ([ADR 0045](0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md)). After connect, the rendered subset is irrelevant. Virtualizing, paging or regrouping the view never touches the data.

4. **Template targets.** A backend template ([ADR 0043](0043-the-target-emitter-interface-for-template-emission.md)) cannot carry the witness, and its coverage depends on data the build never sees. Under a configured target, a key-alias harvest is not emittable. This is a census routing outcome until a target operation carries the witness. Static-generation builds are unaffected.

## Alternatives Considered

- **A static coverage proof over derived membership**: undecidable in general. A decidable fragment (recognized partition constructs, the gate's server value) would need symbolic evaluation of arbitrary derivations, and it would still be wrong the moment a derivation filters.
- **Seed through a root attribute** (a JSON-parsed exposed prop): sound and needs no new mechanism, but it ships the data twice, as payload and as rendered cells. Avoiding exactly that duplication is the reason for harvesting.
- **Client-side rendering from a page-level data block**: data ships once, and it scales past what a server can render. But it contradicts the stated constraint that components enhance the server's markup and never generate it. It removes ADR 0028's pre-JS degradation state, and it needs a type-safe codec as a bundled dependency. Rejected. For a dataset too large to render at once, the HTML-first answer is HTML partials loaded on demand.
- **Restructure the component to a flat list**: harvest works there today, but every grouped or virtualized view is then inexpressible.

## Consequences

**Good:**

- A flat list rendered through a nested grouping is expressible on every surface, with no data duplication beyond s7's raw sources.
- Virtualization, paging and grouping are view concerns. The data list survives them.
- An incomplete render is a build error with a key in the message, never a silent loss.

**Bad / accepted tradeoffs:**

- The server must render every item once. Server-side virtualization (rendering only the first screen) fails the witness by design. This is harvest's limit, not the alias's.
- A dynamic check joins the server module: one key record per alias item and one comparison per render.
- A key-alias harvest is not emittable to template targets until a target can carry the witness.
- The alias form is narrow by design (one scope, the key as the item, unconditional `byKey`). Wider forms wait for a component that needs them.

## Related

- Requirements: [M17](../REQUIREMENTS.md#m17-single-file-isomorphic-authoring-format), [M18](../REQUIREMENTS.md#m18-compile-time-contract-checking), [M19](../REQUIREMENTS.md#m19-tiered-server-evaluation), [M22](../REQUIREMENTS.md#m22-tiered-error-surfacing), [M27](../REQUIREMENTS.md#m27-backend-neutral-template-emission)
- Extends: [ADR 0046](0046-reactive-list-items-as-mount-scopes.md) s7
- Related: [ADR 0003](0003-attributes-drive-state-at-connect-time-only.md) (harvest at connect), [ADR 0028](0028-tiered-error-surfacing.md) (surfacing), [ADR 0045](0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md) (selector synthesis), [ADR 0043](0043-the-target-emitter-interface-for-template-emission.md) (targets)
