# module-todo Bug Analysis: `checkbox state affects form-checkbox attributes`

## Status

**Resolved.** 

The bug has been fixed by leveraging `cause-effect` 1.3.0's granular reactivity (specifically using `createStore` as the item factory) and updating `module-todo` to restrict its DOM reconciliation to structural list changes only.

---

## Root Cause

The issue stemmed from an over-broad reactive dependency in the main DOM reconciliation effect (`watch(list, ...)`). 

When a user clicked a checkbox to complete a task:
1. `slot.replace(descriptor)` correctly handled the `{ get, set }` and called `item.set({ ...spread, completedAt: new Date() })`.
2. Because the entire item was stored as a single `State<T>`, the `item.set()` propagated to the overarching `list` node.
3. The `watch(list, ...)` effect re-ran because it inherently depended on `list.get()`, which tracks all items.
4. Due to the synchronous execution of `each` cleanup/scopes and the complex cascading graph queue triggered by DOM sync, the reactive edge between the checkbox slot and the new value was temporarily severed or reverted, causing the element to either drop the attribute or fail to add it.

Basically, updating *content* inside a list item inappropriately triggered *structural* DOM synchronization, leading to race conditions between the slot updates and the DOM reconciliation loop.

---

## Solution Implemented

We resolved this by isolating item content reactivity from list structural reactivity using the newly available `createStore` pattern:

1. **Granular Reactivity via `createStore`:**
   Configured the `List` to use `createStore` for its items:
   ```ts
   const list = createList<TodoItem>([], {
       keyConfig: 'todo',
       createItem: v => createStore(v),
   })
   ```
   We changed `completedAt: Date | null` to `completed: boolean` to ensure strict type compatibility with `createStore`, allowing us to read and write directly to `item.completed.get()` and `item.completed.set()`. 

2. **Structural-Only DOM Sync:**
   Changed the DOM reconciliation effect to depend exclusively on the list's keys:
   ```ts
   watch(() => Array.from(list.keys()), () => {
       // DOM elements are added/removed here
   })
   ```
   Now, this heavy effect *only* re-runs when items are added or removed, completely ignoring granular property changes like toggling a checkbox or editing text.

3. **Precise Slot Descriptor Edges:**
   Checkboxes and text inputs now bind directly to the granular store properties:
   ```ts
   checked: {
       get: () => item.completed.get(),
       set: (checked: boolean) => item.completed.set(checked),
   }
   ```

4. **Iterative Memos for Aggregates:**
   Rewrote `activeCount` and `completedCount` to explicitly track `list.keys()` for additions/removals while iterating over individual store properties (`item.completed.get()`). This correctly aggregates counts without subscribing to the global list value.

## Conclusion

With these changes, the `le-truc` `watch` graph operates cleanly: checking a box isolates the mutation to `item.completed`, propagating *only* to the slot bindings (`form-checkbox` checked attributes) and the aggregate count memos, completely bypassing the expensive structural DOM sync. All e2e tests across Chromium, Firefox, and WebKit now pass reliably.