# InfoMancer production visual system

Status: **authoritative design contract**, based on `testing/0.9-alpha` at `9427f6186377318599207c05ef9ad49e77a3a81a`. See [UX.md](UX.md) for interaction behavior.

This is a maturity pass on a working application, **not** a rebrand or framework migration. Preserve the existing dark theme, lime identity, media/operations workflows, high-contrast mode, settings, authorization, and persisted user choices. Current CSS is the implementation source of truth until a reviewed change updates it. This document specifies how future changes should use the *existing* owners. Do not introduce a parallel token sheet or a second JS controller.

## Visual hierarchy

- **Browse** (Library, Collections): artwork leads. Poster artwork remains 2:3, uncropped where image presentation requires it; titles and secondary metadata are consistently placed below it. Density and saved views are functional user controls, not decorative options.
- **Inspect** (quick Inspector, Title Details): identity, health, and primary action precede technical detail; disclose deep metadata progressively without concealing evidence.
- **Operate** (Review, Sources, maintenance): prioritize state, comparisons, timestamps, evidence, consequences, and decisive actions over imagery or decorative graphics.
- **Dashboard**: emphasize actionable findings, activity, and inventory. Distinguish current state from historical activity and label relative times accurately.
- No decorative glows, gradient overlays, attention-seeking pills, oversized status numerals, or movement without a communicated purpose. Do not globally strip existing effects before a reviewed surface migration.

## Existing tokens and canonical owners

| Concern | Owner today | Contract |
| --- | --- | --- |
| Base colors | `app/static/app.css` `:root` | `--bg #0b0e12`, `--surface #121820`, `--line #27303b`, `--text #edf2f6`, `--muted #8996a5`, `--lime #b9f542`, `--cyan #51d6e6`, `--danger #ff716c`. Reference these, do not copy their hex values into new shared rules. |
| Typography and common radii | `app/static/modern.css` | UI/body text is a system-sans stack headed by Inter; heading/display also resolves to a sans stack via the legacy `--serif` variable. Keep `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 14px`. Avoid introducing a third type family. |
| Elevated/soft surfaces and focus ring | `modern.css` | Reuse `--surface-raised`, `--surface-soft`, `--focus-ring`; focus-visible uses a 2px lime outline with 3px offset. A visible keyboard focus indicator is mandatory. |
| Global shell, buttons, form base, tables | `app.css`, with deliberate common overrides in `modern.css` | Shared component rules live here; surface styles should not restyle every `button`, `input`, `h1`, or `.panel` independently. |
| Workspace motion | `app/static/workspace.css` | Existing `--im-motion: 180ms cubic-bezier(.2,.8,.2,1)`; suppress nonessential transitions at `prefers-reduced-motion: reduce`. No new motion variable without retiring the original. |
| Navigation and global search | `app/static/header.css` + `app/static/app-shell.js` | Shell geometry and search presentation here; `mobile.css` can own mobile-only constraints, not a second base implementation. |
| Popovers, confirmation dialogs, toasts and drawers | `app/static/workspace-ui.css`, `app/static/workspace-ui-core.js` | Use existing Workspace primitives. `dialog-controls.css` owns *only* shared close-mark geometry. |
| Library cards and rows | `app/static/library.css` | Functional density extensions belong to `library-density.css`; selection extensions to `library-selection.css`; responsive exceptions to `mobile.css` only where truly cross-surface. |
| Page-specific UI | Corresponding `dashboard-*`, `detail-*`, `collection-*`, `review.css`, `sources.css`, `settings*.css` | Keep local variants local; reuse shared shell and controls rather than overriding them by high specificity. |

### Rhythm, scale, and alignment

There is **no canonical spacing-token scale** in the inspected root styles. Do not add a second set of arbitrary `--space-*` values while this remains true. Until spacing consolidation is approved, use the existing 4px-based rhythm: 4/8px for icon and inline gaps, 12/16px for fields, controls and card internals, 24/32px for related sections, with responsive reduction when necessary. Favor repeated alignment baselines over compensating margins. Use the existing typography scale: body ~15px with 1.5 line height, 12–13px for supporting labels, clear heading hierarchy, tabular numerals for data. Avoid caps and letter spacing on running content or technical values.

### Surface, elevation, borders

Default to `--surface` against `--bg` and a 1px `--line` border. Raised surfaces exist to establish layering (dialogs, popovers), not for every card. Prefer borders, spacing and content hierarchy to gradients and shadows. Use the lime accent for brand identity, focus, selection, and the *primary* action. Use cyan sparingly for distinct informational/link status, danger for destructive/error states, and plain muted text for secondary metadata. Never use color as the only indication of state.

### Interaction and responsive conventions

- Minimum comfortable touch hit area: **44 x 44 CSS px** for prominent mobile controls, including a reachable dismiss action; smaller dense desktop controls require a clear accessible equivalent.
- Breakpoints currently in use: **980px** for sidebar/shell adaptation, **760px** for mobile shell, **600px** for portrait-phone cover-density semantics. Preserve those boundaries unless a focused change demonstrates a genuine layout issue.
- Honor `viewport-fit=cover`, safe-area insets, narrow landscape, dynamic viewport height, 200% browser zoom, visible focus, and `prefers-reduced-motion`.
- Loading, empty, failure, disabled, confirmation and success states must have understandable text and stable geometry. Timestamps require an explicit meaning (last completed, started, last checked, etc.).
- Use one consistent place for actions within a repeated pattern. No hidden-only-on-hover primary action without a touch and keyboard route.
- Preserve server-first painting and progressively enhanced JS; do not add another spinner or mask to hide layout shifts.

## CSS overlap inventory and migration ownership

These are **known overlaps**, not a mandate to delete later overrides without visual regression testing.

| Existing overlap | Canonical direction | Review risk |
| --- | --- | --- |
| `app.css` base panels/buttons/headings vs `modern.css` gradients, radius, hover lift and focus | Base semantics stay in `app.css`; reviewed tokens/radius and focus styles in `modern.css`. Reduce decorative effects through narrowly scoped surface PRs. | Removing overrides globally could alter onboarding, dialogs and operations. |
| `header.css` mobile search geometry vs `mobile.css` search width, z-order and secondary-header hiding | `header.css` owns search base; `mobile.css` owns iPhone-width constraints. Search state remains solely in `app-shell.js`. | Sticky headers and touch targets can overlap at narrow widths. |
| `library.css` poster hover/overlay vs `library-density.css`, `library-selection.css`, `library-controls.css` and mobile exceptions | Poster geometry/title layout in `library.css`; explicit density and selection features remain separate. | Cover-size, saved view, selection and touch affordance regressions. |
| `workspace-ui.css` dialog chrome vs `dialog-controls.css` X symbols and page-specific dialog CSS | Workspace handles modal structure; `dialog-controls.css` owns only close glyph. | Modal stacking and focus return. |
| `settings.css`, `settings-polish.css`, `settings-round2.css`, `settings-system-nav.css` | `settings.css` owns fields/layout, focused enhancement files own scoped exceptions; reconcile overrides before visual migration. | Form and permission-sensitive workflow regressions. |
| `release-081-ui-polish.css`, `navigation-paint-stability.css`, dynamic `mobile.css` and route-specific loader styles | Preserve load order while auditing; remove an override only when the canonical owner has absorbed the intent. | Flash of incorrect state, first-paint shifts, Safari and WebView differences. |

The loading boundary is split between `app/templates/base.html` (static links) and `app/static/app-shell-bootstrap.js` / `workspace-ui.js` (conditional and dynamic styles). Do not "fix" specificity by appending another last-loaded catch-all file. Each refinement PR must identify the intended permanent owner and note any redundant declarations removed.

## Review and release gate

Before merging each change: capture desktop (1440px), tablet (768px), phone (390px) and narrow phone (320px) before/after evidence; test keyboard and touch, 200% zoom, high contrast (where available), reduced motion, loading/empty/error states, and applicable automated tests. Do not claim Safari validation from a Chromium-only run. The initial audit and search-reliability change do **not** constitute approval for the larger visual migration.
