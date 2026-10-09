# InfoMancer redesign and theme evaluation

Status: **evaluation proposal and isolated prototype**, not a replacement for root DESIGN.md or UX.md. Branch `design/theme-redesign-evaluation`, based on `5edc455` from the coherent-dark review branch. No production templates, styles, controllers, account records or filesystem workflows are changed.

## Design recommendation

Make InfoMancer a personal archive with a clear utility shell. Artwork carries atmosphere. Navigation, evidence and account settings use one hierarchy, regular spacing and restrained accent color. A theme changes this palette rather than inventing another layout.

- Keep shared 28–34px page headings, 20px section headings, 16px body text and 44px prominent controls.
- Simplify the shell into browse, review/operations and account groups. The prototype illustrates this, but does not authorize changing routes or permissions.
- Put Appearance under the account, accessible to ordinary users, rather than under librarian-only server settings.
- Give browsing a consistent search/filter/view toolbar and stable poster footprints with 16px gaps. A short last row can have trailing space. Do not distribute that space between posters.
- Treat operational pages as evidence: labels, timestamps, consequences and actions. Avoid glowing score cards, repeated pills and grandiose assistant copy.
- Reuse shared panels, tables, fields, buttons, focus and error presentation across routes. Forms size to content; only related comparison cards align in height.
- Make narrow layouts purposeful: two cover columns, wrapped filters and reachable actions. Keep Inspector an overlay so opening it does not shrink posters.

The SVG/PNG images are **concept illustrations**, not rendered application screenshots. They use synthetic poster artwork, sample content and a simplified shell. The functional HTML is a separate evaluation prototype with Library, Review and Appearance; it does not expose actual catalog operations. Static illustrations show the intended fuller shell, while the prototype navigates only its three implemented screens.

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

Open `docs/theme-study/index.html` in a browser. This file is self-contained and uses no external assets. Select Appearance, choose a theme/accent/density, then navigate to Library and Review. Apply persists locally; Discard restores the saved choice; Export downloads the applied allowlisted JSON, not an unsaved draft. Search works on ten sample titles. Browsing and operation examples are not connected to a real backend.

Or serve the study folder:

```bash
python -m http.server 8793 --bind 127.0.0.1 --directory docs/theme-study
```

Then open `http://localhost:8793`. If running on Atlas instead of the desktop, use an SSH tunnel, `ssh -L 8793:127.0.0.1:8793 <user>@<atlas-host>`, and open the localhost URL on the desktop. Replace the placeholders with the SSH account and host you normally use.

Regenerate the HTML and SVG concepts with `node docs/theme-study/build.mjs`. Run the dependency-free validation checks with `node docs/theme-study/themes.test.mjs`. PNG concepts are rasterized from SVG with Inkscape. This study requires neither a production catalog nor Docker.

## Verification and limits

The branch validates preset text, accent and semantic color contrast, invalid preference recovery, schema allowlisting and black/white action text. JavaScript syntax and regeneration are checked. Concept images are inspected after rasterization. A browser executable is unavailable in this environment, so the functional prototype has not received browser, Safari or responsive acceptance testing; SVG concept rendering does not substitute for it. Production code is unchanged, so prior application test counts are not new evidence for this prototype.
