# InfoMancer redesign and theme evaluation

Status: **evaluation proposal and isolated prototype**, not a replacement for root DESIGN.md or UX.md. Branch `design/theme-redesign-evaluation`, based on `5edc455` from the coherent-dark review branch. No production templates, styles, controllers, account records or filesystem workflows are changed.

## Revision 2: Media workbench

The first study overcorrected toward minimalism: generic typography, no brand lockup and flat surfaces made it feel like a wireframe. This revision evaluates a more authored media workspace. Root DESIGN.md remains the accepted production contract; the larger condensed headings and surface treatment below are an intentional proposal for review, not an already approved global change.

- **Identity:** reuse the actual InfoMancer lockup, unmodified. Brand lime remains independent of the customizable action accent.
- **Type:** Barlow Condensed 600 for 44px desktop / 38px phone headings and 25px section labels; Manrope 400/600 for reading, titles and controls; IBM Plex Mono 400 for technical data. Keep all-caps condensed type to short headings, rather than body text.
- **Material:** charcoal surfaces with a restrained directional tonal gradient, inset top edge and soft shadow. Depth clarifies shell, pane and file-evidence layers. Lime marks selection, focus and primary actions.
- **Composition:** Browse gives artwork the full available width. Workbench keeps Library, Inspector and Activity together. Stable cover footprints and 16px horizontal gaps avoid distributed, arbitrary whitespace. Narrow layouts stack the panels with two cover columns.
- **Coherence:** Library, Review and Appearance share the same shell, heading system, panel edges, fields, controls and theme roles. Themes change the palette, not typography or page geometry.

Open `comparison.html` for the first pass alongside the revised Library, Workbench, Appearance and phone concepts. The `studio-*.png` / `.svg` files are **concept illustrations**, not application screenshots. The older `obsidian.png`, `slate.png`, `ember.png`, `appearance.png` and `mobile.png` remain historical first-pass evidence. Both use sample content; the new artwork is original SVG illustration, not provider artwork or official film posters.

### Trellis reference and adoption proposal

The framework shared earlier was [Trellis](https://trellisui.com/). Its official documentation describes a framework-independent TypeScript core, DOM/custom-element/React adapters, nested docking, tabs, floating panels, focus/zoom, JSON layout persistence and CSS custom-property themes. This is a useful structural reference for InfoMancer's media workspace. It should support the product's identity instead of defining it.

**The prototype does not install Trellis or implement freeform docking.** Its two fixed layouts demonstrate the design choice. Recommended next spike: mount the existing Library, Inspector and Activity controllers as persistent Trellis views using the plain-DOM adapter; verify that a panel move or zoom does not duplicate listeners, reset selection or bypass existing permission and request handling. Provide keyboard-accessible layout actions and a fixed mobile arrangement. Keep Browse available as the simpler mode.

Store versioned layout JSON separately from the allowlisted theme preference. Resetting a layout should not reset the palette or density. For production, use the existing account preference transaction and canonical controllers; do not add competing search or Inspector owners. Map Trellis CSS properties to InfoMancer's semantic tokens. Before adopting a dependency, evaluate its exact version and source-available commercial terms for this product.

### Assets and reproducibility

The wordmark is copied from `app/static/infomancer-lockup.svg`. The study bundles Fontsource 5.3.0 Latin font subsets and their OFL licenses under `fonts/`. WOFF2 assets are embedded in `index.html` so the interactive study has no font-network dependency. TTF equivalents support the illustration renderer. Future product adoption needs the appropriate additional glyph subsets and localized fallbacks; this English evaluation does not establish a multilingual type contract.

## What the investigation found

| Evidence | Implication |
| --- | --- |
| `app/static/app.css` defines base `--bg`, `--surface`, `--line`, `--text`, `--muted`, `--lime`, `--cyan`, `--danger`. | There is a useful starting point; no framework rewrite is needed. |
| `app/static/modern.css` independently defines raised/soft surfaces and fixed lime hover/focus colors. | Changing the base accent alone would leave inconsistent interactive states. |
| A search for `#[0-9a-fA-F]{3,8}` or `rgba?\(` in `app/static/*.css` found 1,197 references on 875 matching lines across 46 of 53 CSS files. | Inventory these by semantic role. This count includes legitimate artwork/status/component colors; it is not a count of 1,197 bugs. |
| `header.css` uses `body.high-contrast` to force muted and common text to white, including `!important` overrides. | Accessibility needs to be a palette-aware layer. This rule would fail on a future light theme. |
| `base.html` loads base, enhancement and route styles, with further dynamic loading documented in DESIGN.md. | A last-loaded theme override sheet would conceal ownership problems and produce partial themes. |
| Profile stores `high_contrast` through `main.py`, `auth.py`, database schema/migrations and `profile.js`. | Theme settings can extend the existing account preference path. Server persistence is already available for related preferences. |
| Shared interaction controllers are explicitly owned in AGENTS.md and UX.md. | Theme changes must not add a second owner for search, Library selection, density or Inspector. |

Reproduce the color inventory with:

```bash
rg -n '#[0-9a-fA-F]{3,8}|rgba?\(' app/static --glob '*.css' --stats
```

## Theme scope

| Preset | Character | Accent |
| --- | --- | --- |
| Obsidian | Neutral charcoal, closest to the polished identity | Muted lime `#b9d875` |
| Slate | Cooler blue-gray with clearer panel separation | Soft blue `#8ebee9` |
| Ember | Warm dark surfaces for a less technical feel | Brass `#dfb586` |

Recommended first release: these three dark presets, accent customization, existing density controls and a separate high-contrast preference. Keep the recognizable brand artwork, media posters and semantic warning/danger colors separate from the customizable action accent. Do not allow arbitrary CSS or font/spacing imports in the initial release.

The prototype validates accent contrast of at least 3:1 against background, panel and raised surfaces, chooses black or white action text at at least 4.5:1, and checks preset body/muted text at at least 4.5:1. These are token-pair checks, not a claim of complete WCAG compliance. Disabled, overlapping, translucent, hover and image-backed combinations need rendered acceptance testing.

Later options: a carefully tested light preset, follow-system mode, versioned palette imports and advanced surface customization. Light cannot ship honestly until fixed dark transparencies, logo variants and white high-contrast overrides are migrated. Typography, spacing and motion should remain system decisions; avoid a theme editor that can break every page.

## Implementation architecture

Use a versioned, allowlisted preference object:

```json
{"version":1,"preset":"obsidian","accent":"#b9d875","density":"comfortable","highContrast":false}
```

The prototype stores this under `infomancer-theme-study-v1` in browser storage only. Invalid or unsupported preferences revert to defaults. Unknown properties are stripped. No data is written to the application's user records.

Production migration should use the existing user preference transaction and server validation. Render the effective theme on `<html>` before CSS paints; use a small canonical first-paint bootstrap only for an explicitly chosen device override or guest preference. The server remains authoritative for account settings. Avoid two competing persistence paths or leaking one user's preference to another on a shared browser.

| Role | Proposed token | Existing mapping / owner |
| --- | --- | --- |
| Canvas, panels, raised surfaces | `--bg`, `--surface`, `--surface-raised`, `--surface-soft` | Preserve existing names and canonical app.css/modern.css ownership. |
| Primary/muted text and boundaries | `--text`, `--muted`, `--line`, field/hover border roles | Migrate hardcoded equivalents in their component owner. |
| Customizable action accent | `--accent`, `--accent-hover`, `--on-accent`, `--focus-ring` | Temporarily alias legacy `--lime` where it truly means action/selection; keep brand lime separate. |
| Semantic feedback | Success, warning, information, danger and paired foreground/surface roles | Preserve meaning and readable labels; do not replace these with the action accent. |
| Contrast/motion | Palette-aware contrast overrides; existing reduced-motion policy | Honor forced colors and existing accessibility preferences. |

The prototype uses a smaller, documented token vocabulary to demonstrate the concept. It is not a new production stylesheet to append to base.html. Fold reviewed tokens into the existing owners, retire duplicate definitions, then migrate route-specific literal colors by semantic category. Resolve hover, pressed, selected, disabled, loading, error and focus colors alongside the resting state.

Apply/Discard is the proposed account workflow: changes preview across representative surfaces, Apply validates and saves, Discard restores the saved state, and Restore defaults is reversible. Production must preserve pending preferences across server validation errors and provide the existing dirty-navigation protection before leaving the settings flow. The prototype retains drafts between its three screens and loses unapplied drafts on a full reload; it is not a production unsaved-work contract.

## Rollout and evaluation

1. Approve the visual direction and customization boundaries using this study.
2. Consolidate semantic color owners while retaining Obsidian as the default; capture the existing app for regression evidence.
3. Migrate the shell, shared controls, Library and Inspector together. Keep persisted density/view/selection under their existing controllers.
4. Extend account preferences and add the Appearance page with validated save, failure recovery, discard and reset.
5. Migrate Review/Sources, Settings/account, then remaining details/collections/help. Do not ship a preset while routes still have visibly incompatible fixed surfaces.
6. Check all themes at 1440/768/390/320px, high contrast, reduced motion, forced colors, keyboard, actual 200% zoom, long data, loading/empty/error states, real iPhone/Safari and Windows browsers. Add visual coverage for shared controls and critical operations, not screenshots of every incidental fixture.

Keep migration commits separate from business changes so rollback restores the previous palette without changing user data or filesystem operations. Account theme data needs versioned defaults if a preset is retired.

## Evaluate locally

Open `docs/theme-study/index.html` in a browser. This file is self-contained and uses no external assets. Select Appearance, choose a theme/accent/density, then navigate to Library and Review. Apply persists locally; Discard restores the saved choice; Export downloads the applied allowlisted JSON, not an unsaved draft. Search works on ten sample titles. Click a cover to inspect it, or switch Browse / Workbench. The comparison link opens the before/after concepts. Browsing and operation examples are not connected to a real backend.

Or serve the study folder:

```bash
python -m http.server 8793 --bind 127.0.0.1 --directory docs/theme-study
```

Then open `http://localhost:8793`. If running on Atlas instead of the desktop, use an SSH tunnel, `ssh -L 8793:127.0.0.1:8793 <user>@<atlas-host>`, and open the localhost URL on the desktop. Replace the placeholders with the SSH account and host you normally use.

The committed HTML and PNGs are ready to open. Regeneration requires Node, Inkscape and the bundled TTF fonts installed on the rendering machine. On Linux:

```bash
mkdir -p ~/.local/share/fonts/infomancer-study
cp docs/theme-study/fonts/*.ttf ~/.local/share/fonts/infomancer-study/
fc-cache -f
node docs/theme-study/build.mjs
node docs/theme-study/themes.test.mjs
```

The build produces the self-contained HTML, illustration sources, artwork and PNG concepts. The theme checks require only Node. This study requires neither a production catalog nor Docker.

## Verification and limits

The branch validates preset text, accent and semantic color contrast, invalid preference recovery, schema allowlisting and black/white action text. JavaScript syntax and regeneration are checked. A LinkeDOM smoke check exercises both layouts, title inspection, search / empty / clear, page navigation, theme apply, invalid-accent rejection, discard and default preview. It passes, but does not verify browser rendering, native controls or keyboard focus behavior. Concept images are inspected after rasterization. The scoped premium static audit reported 14 actionless-button findings: seven ID-based controls in each of the source markup and generated HTML. Each has an explicit listener in `prototype.js`; the auditor does not resolve those bindings. These findings are reviewed limitations of that static check, not a claimed clean strict audit. A browser executable is unavailable in this environment, so the functional prototype has not received browser, Safari or responsive acceptance testing; SVG concept rendering does not substitute for it. Production code is unchanged, so prior application test counts are not new evidence for this prototype.
