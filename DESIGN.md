---
name: folderex
description: Share any local folder via a public HTTPS URL with basic auth
colors:
  green: "#3fb950"
  green-light: "#1a7f37"
  accent-dark: "#58a6ff"
  accent-dark-hover: "#79c0ff"
  accent-light: "#0969da"
  accent-light-hover: "#0550ae"
  bg-dark: "#0d1117"
  surface-dark: "#161b22"
  border-dark: "#30363d"
  text-dark: "#e6edf3"
  text-dim-dark: "#8b949e"
  hover-dark: "#1c2129"
  folder-dark: "#e3b341"
  bg-light: "#ffffff"
  surface-light: "#f6f8fa"
  border-light: "#d0d7de"
  text-light: "#1f2328"
  text-dim-light: "#59636e"
  hover-light: "#eef1f4"
  folder-light: "#9a6700"
  danger: "#f85149"
  danger-light: "#cf222e"
  icon-code: "#bc8cff"
  icon-image: "#f778ba"
  icon-doc: "#79c0ff"
  icon-data: "#56d364"
  icon-web: "#ff7b72"
  icon-archive: "#d29922"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.5px"
  logo:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "-0.5px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "48px"
components:
  button-action:
    backgroundColor: "transparent"
    textColor: "{colors.text-dim-dark}"
    rounded: "{rounded.md}"
    size: "30px"
  button-action-hover:
    backgroundColor: "{colors.border-dark}"
    textColor: "{colors.text-dark}"
  button-upload:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dim-dark}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-upload-hover:
    backgroundColor: "{colors.hover-dark}"
    textColor: "{colors.text-dark}"
  button-delete-hover:
    backgroundColor: "rgba(248, 81, 73, 0.1)"
    textColor: "{colors.danger}"
  button-delete-confirm-yes:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "2px 10px"
  button-delete-confirm-no:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.sm}"
    padding: "2px 10px"
  button-kb-shortcuts:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dim-dark}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  button-kb-shortcuts-hover:
    backgroundColor: "{colors.hover-dark}"
    textColor: "{colors.text-dark}"
---

# Design System: folderex

## 1. Overview

**Creative North Star: "The Operator's Console"**

folderex is a precision instrument for file access. The interface inherits the same ethos as the CLI that spawns it: zero ceremony, instant comprehension, absolute reliability. Every pixel serves a function. The design language takes cues from Linear's speed and Arc's opinionated polish - not decorative, but crafted. The system rejects bland OS file managers (Windows Explorer's beige utility) and cheap file-share UIs (WeTransfer clones with gratuitous gradients and ad slots).

The visual system is GitHub-adjacent in token values but stands on its own feet. Dark mode is the default posture (a CLI tool lives in dark terminals), with light mode as an equal-class alternative, not an afterthought. Information density is high; the table is the primary surface, and every row is scannable in under 200ms.

Components are responsive and anticipatory - they feel like they know what you're about to do before you do it. Transitions are fast (100-150ms), easing is exponential out, and hover states provide immediate tactile feedback without movement.

**Key Characteristics:**
- Information-dense without feeling cramped
- Dark-first, dual-theme with full parity
- System font stack (no loading, no FOUT, native speed)
- Monochromatic neutral palette with a single green accent and colored file-type icons
- Tabular data as the primary affordance
- Zero decorative elements

## 2. Colors

The palette is monochromatic neutral with strategic color punctuation. Green is the brand mark; blue is the interactive accent; file-type colors are the only chromatic variety.

### Primary

- **Console Green** (#3fb950 dark / #1a7f37 light): Brand identity color. Used exclusively for the logo, connection status indicator, and success confirmation. Appears on less than 5% of any screen. Its rarity is the signal.

### Secondary

- **Interactive Blue** (#58a6ff dark / #0969da light): Links, file names, breadcrumbs, interactive text. The primary action color for clickable elements. Hover shifts lighter in dark mode (#79c0ff), darker in light mode (#0550ae).

### Tertiary

- **File-type Icons** (code #bc8cff, image #f778ba, doc #79c0ff, data #56d364, web #ff7b72, archive #d29922): Categorical color only. Each maps to a file extension family. Never used for text, backgrounds, or borders.

### Neutral

- **Deep Ink** (#0d1117 dark bg): The void. Page background in dark mode.
- **Surface** (#161b22 dark / #f6f8fa light): Header, table header, clipboard header, button backgrounds. One step above background.
- **Border** (#30363d dark / #d0d7de light): All structural lines. Single weight (1px) everywhere.
- **Primary Text** (#e6edf3 dark / #1f2328 light): Body text, file names, headings.
- **Dim Text** (#8b949e dark / #59636e light): Secondary metadata (sizes, dates, labels). 4.5:1 contrast maintained.
- **Hover** (#1c2129 dark / #eef1f4 light): Row hover background. Subtle, not distracting.
- **Danger Red** (#f85149 dark / #cf222e light): Delete confirmation, danger toast border, undo button. Appears only in destructive action contexts.

### Named Rules

**The Green Scarcity Rule.** Console Green appears in exactly three contexts: the logo, the WebSocket connection dot, and post-action success states. If green starts appearing elsewhere, the brand mark is diluted.

**The No-Decoration Rule.** Color is information, never ornament. If a color doesn't map to a semantic role (link, file type, status, danger), it doesn't belong.

## 3. Typography

**Body Font:** System stack (-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif)
**Mono Font:** SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace

**Character:** Native, invisible, fast. The font stack prioritizes the user's own OS typeface - no network requests, no layout shifts, zero FOUT. The monospace stack appears only in the shared clipboard textarea, reinforcing the tool's terminal lineage.

### Hierarchy

- **Logo** (700, 18px, letter-spacing -0.5px): Product wordmark only. The tight tracking signals density and confidence.
- **Body** (400, 14px, line-height 1.5): File names, breadcrumb text, general content. Optimized for scan speed in tabular layouts.
- **Label** (500, 12px, letter-spacing 0.5px, uppercase): Table column headers, clipboard section title, theme label. Structural markers that recede.
- **Mono** (400, 13px, line-height 1.6): Clipboard textarea. The wider line-height compensates for monospace's denser texture.
- **Meta** (400, 13px): Toast notifications. Slightly smaller than body for secondary messaging.

### Named Rules

**The No-Display Rule.** This system has no display or headline size. The largest text is 18px (the logo). File browsers don't shout; they organize. If a heading larger than 18px ever appears, the hierarchy is broken.

## 4. Elevation

Flat by default. The system uses **tonal layering** (background → surface → hover) to create depth, not shadows. Depth is conveyed through background color steps and border definition.

Two controlled exceptions exist:

1. The **drop overlay** uses `backdrop-filter: blur(1px)` and a translucent background (`color-mix(in srgb, var(--bg) 65%, transparent)`) to separate the upload target from the file listing beneath. This is a functional overlay, not decorative depth.
2. **Actionable toasts** (delete undo, upload conflict) use a single theme-aware shadow (`--shadow-toast`): `0 4px 24px oklch(0 0 0 / 0.4)` in dark mode, `0 4px 24px oklch(0 0 0 / 0.1)` in light mode. This elevates time-critical notifications above the content layer without breaking the flat vocabulary for static elements.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Perceived depth comes from background tone (bg → surface → hover), not from simulated light. Shadows are reserved exclusively for transient, time-critical UI (actionable toasts with countdown). If a new surface "needs" a shadow, it probably needs a tonal step instead.

## 5. Components

### Action Buttons (icon-only)

- **Shape:** Square, 30x30px, gently curved (6px radius)
- **Default:** Transparent background, dim text color
- **Hover:** Border-color background fill, full text color. 150ms ease transition.
- **Delete variant hover:** Danger-tinted background (rgba red at 10%), danger text color. The red signals irreversibility.
- **Titles include keyboard shortcut:** e.g. "Download (d)", "Copy link (c)", "Delete (x)"

### Upload Button (text + icon)

- **Shape:** Pill-adjacent (8px radius), 6px 12px padding
- **Default:** Surface background, dim text, 1px border matching --border
- **Hover:** Hover background, full text, border shifts to dim text color. Feels like it lifts toward you.

### File Table

- **Container:** Full-width, 8px border-radius, 1px border, overflow hidden. Wrapped in `.file-table-wrap` for loading state.
- **Header:** Surface background, label typography (12px uppercase tracked). All `<th>` have `scope="col"`. Empty columns have `aria-label` ("Type", "Actions").
- **Rows:** 8px 12px cell padding, bottom border between rows (last child: none). Each row has `id="file-row-{i}"` for `aria-activedescendant`.
- **Row hover:** Full-width hover background. 100ms transition. Immediate feedback.
- **Row keyboard focus:** Hover background + inset left accent bar (`box-shadow: inset 3px 0 0 var(--accent)`). Roving tabindex: focused row gets `tabindex="0"`, all others `tabindex="-1"`. `aria-selected` tracks keyboard state.
- **Icon column:** Fixed 32px width, centered. Color-coded by file type.
- **Name column:** Interactive blue (links). Directories are semi-bold (500).
- **Size/Date columns:** Dim text, tabular-nums variant for aligned numbers.
- **Actions column:** Fixed 110px, right-aligned. Three icon buttons in a row.
- **Loading state:** `.file-table-wrap.is-loading` shows a 2px indeterminate accent-colored progress bar at the top (animated via `scaleX` + keyframes), tbody fades to 50% opacity with `pointer-events: none`. Table gets `aria-busy="true"`.
- **Empty state:** Folder icon + "No files here yet" + dim helper text. Single `colspan` cell.
- **Accessibility:** `role="grid"`, `aria-label="File listing"`, `aria-activedescendant` pointing to focused row.

### Delete Confirmation (inline)

- **Trigger:** Both keyboard (`x` or `Delete`) and mouse (click delete button) show the confirmation — never immediate deletion.
- **Appearance:** Replaces the file name cell content. Row background tints danger (5% opacity red). Actions column hidden during confirmation.
- **Prompt:** "Delete **filename**? [Yes] [No]" with `y`/`n` keyboard hint in dim text.
- **Yes button:** Danger background, white text, 4px radius. Click or `y` confirms.
- **No button:** Surface background, primary text, border. Click or `n`/`Escape` cancels.
- **Keyboard:** During confirmation, all keys are blocked except `y`, `n`, and `Escape`. This prevents accidental navigation.
- **After confirmation:** Immediate optimistic removal + 8-second undo toast with `z` shortcut.

### Breadcrumbs

- **Separators:** Dim text, 12px
- **Links:** Interactive blue, 2px 6px padding, 4px radius
- **Link hover:** Hover background + accent-hover color
- **Current:** Primary text color, no link behavior

### Toast Notification

- **Position:** Fixed bottom-center, z-index 1000
- **Shape:** 8px radius, 10px 20px padding, surface background, border
- **Animation:** translateY from 12px below + opacity. 200ms cubic-bezier(0.16, 1, 0.3, 1).
- **Duration:** 2500ms default display time
- **Actionable variant:** 12px 20px padding, accent border, theme-aware shadow (`--shadow-toast`), 14px bold. Contains undo/action button with keyboard shortcut badge.
- **Danger variant:** Danger border color instead of accent.
- **Max visible:** 3 toasts at once (column-reverse stacking).

### Shared Clipboard

- **Container:** 8px radius, 1px border, overflow hidden
- **Header:** Surface background, clickable (toggle). Label typography. Connection dot (8px circle, dim → green).
- **Body:** Full-width textarea. Monospace font, bg background color, no border.
- **Collapse:** display:none toggle. Instant, no animation.

### Drop Overlay

- **Position:** Fixed inset 0, z-index 900
- **Background:** 65% opaque bg via color-mix
- **Backdrop:** 1px blur
- **Inner box:** 2px dashed accent border, 16px radius, generous padding (48px 64px)
- **Icon:** 48px accent-colored upload arrow

### Theme Toggle

- **Shape:** 34x34px, 8px radius, 1px border
- **Default:** Surface background, dim text
- **Hover:** Hover background, full text, border shifts
- **Cycle:** dark → light → system. Icon swaps per state.
- **Accessibility:** Dynamic `aria-label` announcing current state: "Theme: Dark. Click to switch."

### Keyboard Shortcuts Button

- **Position:** Footer, always visible alongside "served by folderex" text.
- **Shape:** Inline-flex, 6px radius, 4px 10px padding, 1px border
- **Default:** Surface background, dim text, keyboard icon + "Shortcuts" label
- **Hover:** Hover background, full text, border shifts
- **Click:** Shows the keyboard hint panel (same as pressing `?`)
- **Purpose:** Persistent discoverability of keyboard shortcuts for first-time visitors.

### Keyboard Hint Panel

- **Position:** Fixed bottom-right, z-index 800
- **Shape:** 6px radius, 6px 12px padding, surface background, 1px border
- **Visibility:** Hidden by default (opacity: 0, translateY: 4px). Shown on: keyboard navigation (`j`/`k`/arrows), pressing `?`, or clicking the Shortcuts button. Auto-hides after 10 seconds.
- **Content:** Inline flex row of `<kbd>` + action pairs. Compact 11px text.
- **Mobile:** Hidden entirely below 640px breakpoint (touch devices don't need keyboard hints).

### `kbd` Element

- **Shape:** Inline-block, 4px radius, 1px border
- **Background:** Surface color
- **Typography:** 10px, inherit font-family, line-height 1.4
- **Padding:** 1px 5px

## 6. Do's and Don'ts

### Do:

- **Do** maintain the Green Scarcity Rule - brand green in exactly three places (logo, connection dot, success states).
- **Do** use tabular-nums for any numeric data (sizes, dates, counts) so columns align.
- **Do** keep action buttons at 30x30px minimum touch target.
- **Do** test contrast at 4.5:1 for all body text and 3:1 for all interactive elements in both themes.
- **Do** use 100-150ms transitions for hover states. Faster is better; the tool should feel instant.
- **Do** honor system dark/light preference as the third theme option.
- **Do** use the system font stack everywhere. No web fonts. Speed is the feature.
- **Do** require confirmation before any destructive action. Delete always shows inline "Yes/No" prompt first.
- **Do** provide `aria-label` on all interactive elements, especially icon-only buttons and empty table headers.
- **Do** use roving tabindex (`tabindex="0"` on focused, `tabindex="-1"` on rest) for keyboard navigation within the file table.
- **Do** include keyboard shortcut in button `title` attributes (e.g. "Download (d)").
- **Do** show loading feedback (indeterminate progress bar + opacity fade) for any fetch that may exceed 100ms.

### Don't:

- **Don't** add shadows, glows, or gradients to static surfaces. The single permitted shadow is `--shadow-toast` on actionable toasts only. (Generic OS file managers lean on outdated skeuomorphic shadows; cheap file-share UIs pile on decorative gradients.)
- **Don't** introduce display-size text. The hierarchy ceiling is 18px. File browsers organize, they don't shout.
- **Don't** use green for anything beyond the three sanctioned contexts. Green is scarce by design.
- **Don't** add decorative icons or illustrations. Every visual element carries information.
- **Don't** use rounded corners larger than 16px (the drop overlay ceiling). Larger radii read as playful, not precise.
- **Don't** animate layout properties. Transform, opacity, and scaleX only (the loading bar uses scaleX as a controlled exception).
- **Don't** delete without confirmation. Every destructive action requires an explicit second intent (button click or `y` keypress).
- **Don't** nest containers. The table IS the container. Cards inside cards, borders inside borders - all prohibited.
- **Don't** use `border-radius` values outside the documented scale (4px / 6px / 8px / 16px). The 2px exception is exclusively for the 3px-tall upload progress bar.
