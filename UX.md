# InfoMancer interaction contract

Status: Phase 1 UX companion to [DESIGN.md](DESIGN.md). Existing controllers are canonical; this document records expected behavior rather than introducing new UI state infrastructure.

## Ownership

Follow [AGENTS.md](AGENTS.md): `app-shell.js` owns global search/site menu/sidebar; `library-controller.js` owns Library filters, AJAX search and title selection; `library-surface-lazy.js` owns Covers/List and persistence; `library-density.js` owns cover size; `workspace-core.js` owns Inspector lifecycle; `app-navigation.js` owns navigation pending/prefetch only; `workspace-ui-core.js` provides shared dialogs, toasts and workspace actions. Templates seed accessible markup. Never add document listeners in a second module to override an owner's state.

## Global search

- The search button opens an inline library query field. On a direct button activation, focus the input synchronously: delaying focus behind an animation can prevent the iOS software keyboard from opening.
- Outside pointer/tap/click closes the expanded search, **whether or not the field contains text**, without discarding the current query. Opening it again may restore that query.
- Escape closes the field and returns focus to its toggle. Opening the navigation menu closes search. Clicking the search toggle with a nonempty query continues to submit the search, as before; with an empty query it closes.
- Closing invalidates debounced updates, aborts in-flight suggestion requests, hides the list, and removes focus from a now-invisible input. Stale responses, including search-history requests, may **never** re-open suggestions or overwrite newer results.
- Typing suggests after a short debounce; queries shorter than two characters do not request media suggestions. The empty field may display recent searches. Search suggestions remain keyboard navigable with ArrowDown/ArrowUp and Escape, and Enter on an option submits the selected query.
- The suggestions region is not a full-screen modal or backdrop. Search must never block unrelated links, scrolling or focus on the page.
- Search GET submissions remain native and keep `record_search=1`; suggestion/history API semantics and CSRF handling remain unchanged.

## Common controls and disclosure

- Buttons are real `button` elements; navigation is a link; never simulate either with an arbitrary clickable `div`. Labels reflect action rather than appearance.
- Dialogs: use the Workspace confirmation/dialog system for enhanced clients, with explicit cancel, Escape, focus inside on open, and focus restored on close. Maintain server-side authorization, CSRF, and safe progressive fallback. Do not bulk-replace native `confirm()` outside focused behavior reviews.
- Menus and combobox suggestions must dismiss on outside action and Escape, with `aria-expanded` and visibility reflecting the same state. Avoid hover-only essential actions.
- Toasts and inline messages must identify whether an action succeeded or failed, not merely animate. Loading should remain cancellable where the underlying operation supports cancellation.
- Destructive changes require a specific explanation, explicit confirmation, and unchanged server-side authorization/protection. Cosmetic refactoring never relaxes a security gate.

## Library and Inspector

- List/Covers, density, filters, selection, and saved views retain their current persisted values and single canonical state owners. Single-click inspection and double-click/Enter full detail behavior remain intact.
- An Inspector dismisses using its defined close method and returns focus sensibly, without implicitly altering the selected title. Technical evidence stays readable by keyboard, touch, and screen reader.
- Smart and manual collections are distinguishable before creation, while existing collection content has primary visual priority.

## Acceptance evidence

Add regression tests to the existing Python contracts and Playwright suite for behavioral changes. Test both a fresh empty query and a populated query, input interruption/abort, outside touch, Escape, and successive results arriving out of order. Screenshots are required before broader visual surface migrations. Mobile WebKit on a physical iPhone or Safari device remains an explicit manual acceptance gate for the reported freeze; Chromium emulation alone is insufficient.
