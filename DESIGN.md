---
version: alpha
name: InfoMancer
description: A quiet dark media catalog with a restrained lime identity.
colors:
  background: "#0b0e12"
  surface: "#121820"
  raised: "#141c25"
  soft: "#10171f"
  border: "#27303b"
  text: "#f5f7fa"
  muted: "#9ba9b8"
  primary: "#b9f542"
  information: "#51d6e6"
  danger: "#ff716c"
typography:
  sans:
    fontFamily: 'Inter, "Segoe UI Variable Text", Aptos, system-ui, sans-serif'
    fontSize: "16px"
    lineHeight: "1.5"
  control:
    fontFamily: 'Inter, "Segoe UI Variable Text", Aptos, system-ui, sans-serif'
    fontSize: "14px"
  display:
    fontFamily: '"Segoe UI Variable Display", "Aptos Display", Inter, system-ui, sans-serif'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace'
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button:
    typography: "{typography.control}"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.sm}"
  panel:
    padding: "24px"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
  overlay:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
  secondary:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.muted}"
  divider:
    backgroundColor: "{colors.border}"
  information:
    textColor: "{colors.information}"
  destructive:
    textColor: "{colors.danger}"
---

# InfoMancer production visual system

Status: **authoritative design contract**, refined on `design/coherent-dark-polish-09` from the existing production UI/search foundation. See [UX.md](UX.md) for interaction behavior.

This is a maturity pass on a working application, **not** a rebrand or framework migration. Preserve the existing dark theme, lime identity, media/operations workflows, high-contrast mode, settings, authorization, and persisted user choices. Current CSS is the implementation source of truth until a reviewed change updates it. This document specifies how future changes should use the *existing* owners. Do not introduce a parallel token sheet or a second JS controller.

## Overview

InfoMancer should feel like a personal film archive with the clear structure of a desktop utility. Artwork carries the personality; navigation, settings, and operations stay quiet and predictable. This is a product interface for people managing existing Movie and TV libraries, including permission-sensitive filesystem work. English is the current interface language. System font fallbacks preserve mixed-script media titles without importing an additional typeface.

The signature is the existing bookshelf wordmark. Lime remains recognizable there, on keyboard focus, on a thin selected-state indicator, and on decisive primary actions. Avoid neon dashboard decoration, oversized headings, floating cards, status theater, and conspicuous empty space. The requested refinement approves these system changes across existing owners, with no changes to authorization or file-operation semantics.

### Visual hierarchy

- **Browse** (Library, Collections): artwork leads. Poster artwork remains 2:3, uncropped where image presentation requires it; titles and secondary metadata are consistently placed below it. Density and saved views are functional user controls, not decorative options.
- **Inspect** (quick Inspector, Title Details): identity, health, and primary action precede technical detail; disclose deep metadata progressively without concealing evidence.
- **Operate** (Review, Sources, maintenance): prioritize state, comparisons, timestamps, evidence, consequences, and decisive actions over imagery or decorative graphics.
- **Dashboard**: emphasize actionable findings, activity, and inventory. Distinguish current state from historical activity and label relative times accurately.
- No decorative glows, gradient overlays, attention-seeking pills, oversized status numerals, or movement without a communicated purpose. The reviewed core surfaces now use this treatment; remaining workflow-specific decoration should migrate through its existing owner.

## Colors

Use the exact frontmatter values through the runtime variables. `app.css` owns base palette and spacing; `modern.css` owns raised/soft surfaces, radii, and focus. This document mirrors those runtime owners and does not generate a parallel token sheet.

Default to `--surface` against `--bg` with a 1px `--line` border. Use `--text` for identity and actions, and `--muted` for secondary evidence. Lime marks brand, focus, selection, or the primary action. Informational cyan and destructive red retain their semantic roles. Never use color as the only indication of state. Dark is the base theme; existing higher-contrast preferences and forced-colors support remain available.

## Typography

Body text is 16px with 1.5 line height. The shared page-heading token is `clamp(28px, 2.4vw, 34px)` and section-heading token is 20px. Headings use 600 weight and restrained tracking, rather than display-scale marketing typography. Supporting copy uses 12–14px where density requires it. Technical values wrap or expose their full text. Use tabular numerals for data, sentence case for content, and short uppercase labels only as signposts. The legacy `--serif` token resolves to a sans-serif stack.

## Layout

`app.css` owns `--space-xs/sm/md/lg/xl` at 4/8/16/24/32px, `--page-title-size`, `--section-title-size`, and `--control-height` at 40px. Shell and default panels use 24px padding, with established mobile reductions. Preserve repeated alignment baselines instead of compensating margins.

Desktop covers have stable footprints and a regular 16px column gap. Do not distribute unused row width between posters. A short last row can leave space at its trailing edge. Captions reserve two lines so title length does not shift metadata between neighboring cards. Mobile density retains the existing two- and three-column behavior; controls wrap on narrow phones rather than widening the page. The Inspector remains an overlay and must not resize covers.

Default panels size to their content. Stretch only related comparison or overview cards. Keep settings and profile actions inside their container at 320px. Retain breakpoints at 980px for sidebar adaptation, 760px for mobile shell, and 600px for phone density, plus focused exceptions required by content. Honor safe areas, dynamic viewport height, and 200% zoom.

## Elevation & Depth

Normal cards are flat, with tonal separation and borders. Remove decorative radial gradients, repeated glows, and poster hover lifts. Dialogs, menus, and drawers may retain a shadow to communicate their layer. Hover changes border or surface tone without moving a reading target. Existing Workspace motion stays at `--im-motion: 180ms cubic-bezier(.2,.8,.2,1)` and suppresses nonessential transitions with reduced motion.

## Shapes

Common radii are 6px for small controls, 10px for panels, and 14px for large overlays. `workspace.css` aliases its existing radius names to those shared values. Existing round avatar/favorite controls and semantic status badges remain explicit exceptions. Neutral tabs use a thin lime selected indicator rather than a broad lime fill.

## Components

### Canonical owners

| Concern | Owner today | Contract |
| --- | --- | --- |
| Base colors | `app/static/app.css` `:root` | `--bg #0b0e12`, `--surface #121820`, `--line #27303b`, `--text #f5f7fa`, `--muted #9ba9b8`, `--lime #b9f542`, `--cyan #51d6e6`, `--danger #ff716c`. Reference these, do not copy their hex values into new shared rules. |
| Typography and common radii | `app/static/modern.css` | UI/body text is a system-sans stack headed by Inter; heading/display also resolves to a sans stack via the legacy `--serif` variable. Keep `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 14px`. Avoid introducing a third type family. |
| Elevated/soft surfaces and focus ring | `modern.css` | Reuse `--surface-raised`, `--surface-soft`, `--focus-ring`; focus-visible uses a 2px lime outline with 3px offset. A visible keyboard focus indicator is mandatory. |
| Global shell, buttons, form base, tables | `app.css`, with deliberate common overrides in `modern.css` | Shared component rules live here; surface styles should not restyle every `button`, `input`, `h1`, or `.panel` independently. |
| Workspace motion | `app/static/workspace.css` | Existing `--im-motion: 180ms cubic-bezier(.2,.8,.2,1)`; suppress nonessential transitions at `prefers-reduced-motion: reduce`. No new motion variable without retiring the original. |
| Navigation and global search | `app/static/header.css` + `app/static/app-shell.js` | Shell geometry and search presentation here; `mobile.css` can own mobile-only constraints, not a second base implementation. |
| Popovers, confirmation dialogs, toasts and drawers | `app/static/workspace-ui.css`, `app/static/workspace-ui-core.js` | Use existing Workspace primitives. `dialog-controls.css` owns *only* shared close-mark geometry. |
| Library cards and rows | `app/static/library.css` | Functional density extensions belong to `library-density.css`; selection extensions to `library-selection.css`; responsive exceptions to `mobile.css` only where truly cross-surface. |
| Page-specific UI | Corresponding `dashboard-*`, `detail-*`, `collection-*`, `review.css`, `sources.css`, `settings*.css` | Keep local variants local; reuse shared shell and controls rather than overriding them by high specificity. |

### Visual and interaction states

Enabled controls need a readable label and visible hover/focus treatment. Selected controls use a tonal surface plus an indicator; disabled controls keep their geometry and reduce emphasis. Loading, empty, failure, confirmation, and success states need understandable text, stable geometry, and the existing controller. Preserve native form validation, server authorization, CSRF, and destructive confirmations during visual work. See [UX.md](UX.md) for behavioral ownership.

Keyboard focus uses the existing 2px lime outline and 3px offset. Prominent mobile controls should offer 44 x 44px targets, with a reachable dismiss action. Keep a touch/keyboard route to actions revealed on hover. Textareas retain the common deliberate minimum height rather than arbitrary resize handles.

Scrollbars use base tokens in `app.css`, with both standards-based and WebKit rules for document, drawer, list, table, and modal overflow. Forced-colors uses native scrollbar rendering; higher contrast strengthens the thumb. A scrollable child may retain a stable gutter, but must not force the document wider.

### Surface variants

Browse surfaces prioritize artwork and consistent caption placement. Inspect surfaces show identity and health before technical detail. Operate surfaces prioritize state, evidence, consequences, and clear actions. The dashboard uses the same heading scale and flat panels, separates current inventory from recent activity, and explicitly labels the last analysis time.

## Do's and Don'ts

- Use the current shared owner before introducing a local variant.
- Use lime with purpose and preserve keyboard focus.
- Keep related items aligned and gaps regular at every density.
- Preserve user density, view, filter, selection, accessibility, and profile choices.
- Do not add a new late-loading catch-all stylesheet or competing JS controller.
- Do not hide an overflow problem by clipping essential actions or widening the page.
- Do not restyle permission or destructive behavior as part of cosmetic work.

## CSS overlap inventory and migration ownership

These are **known overlaps**, not a mandate to delete later overrides without visual regression testing.

| Existing overlap | Canonical direction | Review risk |
| --- | --- | --- |
| `app.css` base panels/buttons/headings vs `modern.css` gradients, radius, hover lift and focus | Base semantics, shared colors, spacing and heading sizes stay in `app.css`; radii and focus stay in `modern.css`. Flat shared surfaces and stationary hover are now implemented. | Removing overrides globally could alter onboarding, dialogs and operations. |
| `header.css` mobile search geometry vs `mobile.css` search width, z-order and secondary-header hiding | `header.css` owns search base; `mobile.css` owns iPhone-width constraints. Search state remains solely in `app-shell.js`. | Sticky headers and touch targets can overlap at narrow widths. |
| `library.css` poster hover/overlay vs `library-density.css`, `library-selection.css`, `library-controls.css` and mobile exceptions | Poster geometry/title layout in `library.css`; explicit density and selection features remain separate. | Cover-size, saved view, selection and touch affordance regressions. |
| `workspace-ui.css` dialog chrome vs `dialog-controls.css` X symbols and page-specific dialog CSS | Workspace handles modal structure; `dialog-controls.css` owns only close glyph. | Modal stacking and focus return. |
| `settings.css`, `settings-polish.css`, `settings-round2.css`, `settings-system-nav.css` | `settings.css` owns fields/layout; enhancement files reuse neutral selected states and shared heading sizes. `profile-account-dialogs.css` now references the same heading token and removes preview glow. | Form and permission-sensitive workflow regressions. |
| `release-081-ui-polish.css`, `navigation-paint-stability.css`, dynamic `mobile.css` and route-specific loader styles | Preserve load order while auditing; remove an override only when the canonical owner has absorbed the intent. | Flash of incorrect state, first-paint shifts, Safari and WebView differences. |

The loading boundary is split between `app/templates/base.html` (static links) and `app/static/app-shell-bootstrap.js` / `workspace-ui.js` (conditional and dynamic styles). Do not "fix" specificity by appending another last-loaded catch-all file. Each refinement PR must identify the intended permanent owner and note any redundant declarations removed.

## Review and release gate

Before merging each change: capture desktop (1440px), tablet (768px), phone (390px) and narrow phone (320px) before/after evidence; test keyboard and touch, 200% zoom, high contrast (where available), reduced motion, loading/empty/error states, and applicable automated tests. Do not claim Safari validation from a Chromium-only run. The visual refinement is authorized by the requested design pass. See [docs/DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md) for the scope, evidence, remaining manual gate, and preview instructions.
