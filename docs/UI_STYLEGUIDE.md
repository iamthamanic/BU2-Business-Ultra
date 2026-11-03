# UI Styleguide — Business Ultra

<!-- Style tree: tokens → components → patterns. Scaffolded by /project-setup -->

Reference for humans and agents. `@verify-ui` uses this for visual/UX sanity checks.
Primary stylesheet: `apps/web/src/styles/dark-ops.css`.

## Principles

- **One radius system** — soft squares, never mixed pills + sharp corners on the same surface
- **Semantic color** — accent (blue) for actions/focus; green (`--good`) for active/success; warn/bad for risk
- **Product chrome** — page head, tablist, tables, empty states match Marketing / Produkt / CRM
- Every interactive UI: default, hover, focus-visible, disabled, loading, error
- UI copy language: **Deutsch** (EN via i18n keys)

## Design tokens

Defined on `:root` in `dark-ops.css` — no one-off magic numbers in feature CSS.

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` / `--panel` / `--panel2` | near-black / elevated | App / card surfaces |
| `--text` / `--dim` / `--muted` | light / secondary | Typography hierarchy |
| `--border` | low-contrast stroke | Dividers, inputs, tabs |
| `--accent` | blue | Primary buttons, active tab underline, focus |
| `--good` / `--ok` | `#22c55e` | Active / done / success badges |
| `--warn` / `--bad` | amber / red | Warnings / destructive |
| `--radius-xs` | `4px` | Badges, tags, tab corners |
| `--radius-sm` | `6px` | Buttons, inputs, segment toggles, cards |
| `--radius` | `8px` | Panels, modals, larger surfaces |

**Shape rule:** Prefer `--radius-sm` / `--radius-xs`. Do **not** use `border-radius: 999px` for status badges, tab shells, or primary buttons. Pills are reserved for rare chip-only patterns (avatars stay circular).

## Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Page title | Geist / system stack | ~22–28px | 600 |
| Section / table head | same | 13–14px | 500–600 |
| Body | same | 13–14px | 400 |
| Meta / muted | same | 12–13px | 400 |
| Status badge | same | 12px | 500 |

## Components

| Component | Classes / location | Notes |
|-----------|-------------------|-------|
| Button | `.btn`, `.btn.primary` | `--radius-sm`; primary = accent fill |
| Select | `select.input` / `.select` | Custom chevron, `padding-right: 40px`, arrow at `right 12px` |
| Icon select | `CrmIconSelect` | Project glyphs + priority tones (native select cannot show icons) |
| Modal | `.bu-modal` / `.crm-modal` | Cancel only in footer actions — no duplicate header Cancel |
| Segment toggle | `.product-archive-toggle` + `.archive-seg` | Aktiv/Archiv; soft square, not stadium |
| Tab strips (all) | `MktTabs` + `MktTab` | **Always** use this component for tablists — never invent a parallel underline strip |
| Tab level | `level="l1" \| "l2" \| "l3" \| "surface"` | Same segmented chrome; size/weight only differ by level |
| Surface tabs | `level="surface"` | Default for settings, CRM detail, Marketing channel (Instagram/…) |
| Settings subnav | `MktTabs` `level="surface"` + `.co-settings-tabs` | Full-width flex; icons optional via `icon={…}` |
| Status badge | `.crm-status`, `.crm-status--active` | Green for active; `--radius-xs` |
| Label chip | `.crm-tag` | Company labels (customer/project/marketing/product); soft square |
| Priority badge | `.task-prio`, `.task-prio--high` | Soft square; high = `--bad` tone |
| Member avatar | `.member-av` | Initials only (circular exception) |
| Tag | `.crm-tag` | Same radius as status |
| Table | `.product-table*` / CRM tables | Dark header, hover row, open affordance |
| Task table | `TaskTable` + filters | Title / status / prio / assignee / due |
| Board | `.project-board*` | Lane tint, rich cards, HTML5 DnD, scroll-snap mobile |
| Activity | `.project-activity-*` | Timeline dots; structural empty ghosts |
| Attachments | `.task-attach-*` | Dashed empty zone; list + delete |
| Empty | `.crm-empty-*` / blur preview | Structure + CTA, no fake data rows |
| Page head | `.product-page-head`, `.product-page-meta` | Title + status only (no “Area” label) |

## Layout

- Shell: sidebar + main; content padding from product shell
- Max content: fluid within main column
- Breakpoints: mobile ~390px, desktop ~1280px (see `.qa/project.yaml` viewports)

## States (required)

| State | Pattern |
|-------|---------|
| Loading | skeleton (`.crm-skel*`) matching final shape |
| Empty | table headers or board columns + hint + primary CTA |
| Error | `.error` / inline message + retry when applicable |
| Disabled | reduced opacity + no pointer events |

## Accessibility

- Focus visible (`outline` / accent ring) on buttons, tabs, segments
- Tabs: `role="tablist"` / `tab` + `aria-selected`
- Form fields: associated labels (never placeholder-as-label)
- Contrast: WCAG AA on text vs surfaces; status green on dark panel

## Do / Don't

**Do**

- Reuse Dark-Ops tokens and product-shell patterns
- Match Kunden / Projekte / Produkt chrome when adding CRM screens
- Use green for “active” / success status, blue for primary actions

**Don't**

- Label project meta with “Area” — show status badge only
- Stadium / pill tab bars or blue “active” status pills
- Custom settings/CRM tab strips (underline-only `.co-settings-subtab`) — use `MktTabs` `surface`
- Introduce one-off colors or `999px` radii outside documented exceptions
- Ship features without empty / error / loading states

## Tablists (canonical)

Every horizontal tab strip in the app must use:

```tsx
<MktTabs level="surface" label={ariaLabel} className="…optional layout…">
  <MktTab active={…} label="…" icon={OptionalPhosphor} onClick={…} />
</MktTabs>
```

- Marketing channel tabs, CRM detail tabs, Settings company tabs, and nested scope pickers (e.g. Labels: Kunden/Projekt/Marketing/Produkt) share this chrome.
- Prefer `level="surface"` for secondary/tertiary strips; use `l1`/`l2` only in Marketing hierarchy.
- Accessible: `role="tablist"` / `tab` + `aria-selected` (built into `MktTabs` / `MktTab`).

## Design quality skills (pipeline)

- Create: `@ui-ux-craft`, `@frontend-design`, `@ux-design-laws`
- Marketing surfaces only: `@design-taste-frontend`
- Audit: `@web-design-guidelines`; proof: `@verify-ui`
