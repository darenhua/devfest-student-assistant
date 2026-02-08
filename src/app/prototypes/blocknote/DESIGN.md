# BlockNote Editor — Design System

## Core Feeling

Notion-like. The editor should feel like a calm, focused workspace — not a traditional form or rich text toolbar. Content is front and center. Chrome is minimal and appears only on interaction. The overall impression is: clean, modern, quiet confidence.

## Visual Principles

- **Light-themed only** — pure white background (`#ffffff`), no dark mode toggle
- **Content-first** — generous whitespace, no visual clutter, no decorative elements
- **Progressive disclosure** — toolbars, menus, and AI controls surface on hover/selection, not always visible
- **Soft boundaries** — rounded corners, subtle borders (`#d1d5db`), no harsh lines
- **Muted accents** — grays for secondary text (`#6b7280`, `#9ca3af`), blue for interactive/AI elements (`#3b82f6`)

## Typography

- **Font**: Inter (loaded via `@blocknote/core/fonts/inter.css`)
- **Body text**: 16px, `#171717` on white — high contrast, easy to read
- **Headings**: bold weight, no color change, hierarchy through size alone
- **Secondary/meta text**: 12–14px, `#6b7280` or `#9ca3af`

## Layout

- Max content width: `720px`, centered with `margin: 0 auto`
- Container padding: `24px`
- Bottom padding on editor: `300px` (generous scroll breathing room)
- No sidebar, no fixed header — single-column document flow

## Color Palette

| Token         | Value     | Usage                                  |
|---------------|-----------|----------------------------------------|
| `background`  | `#ffffff` | Page and editor background             |
| `foreground`  | `#171717` | Primary text                           |
| `gray-300`    | `#d1d5db` | Borders (select, dividers)             |
| `gray-400`    | `#9ca3af` | Placeholder text, loading states       |
| `gray-500`    | `#6b7280` | Secondary/meta text                    |
| `gray-50`     | `#f9fafb` | Subtle surface backgrounds             |
| `blue-100`    | `#f0f7ff` | AI response background                 |
| `blue-500`    | `#3b82f6` | AI accent, interactive highlights      |

## Tailwind Mapping

When migrating inline styles to Tailwind classes:

```
max-w-[720px] mx-auto p-6          → container
mb-4                                → selector spacing
px-3 py-1.5 rounded-md border      → select/input controls
border-gray-300 text-sm bg-white
cursor-pointer
text-gray-400                       → loading / placeholder
text-gray-500 text-xs              → meta labels
pb-[300px]                          → editor scroll room
```

## Component Patterns

### Controls (select, inputs)
- `padding: 6px 12px` → `px-3 py-1.5`
- `border-radius: 6px` → `rounded-md`
- `border: 1px solid #d1d5db` → `border border-gray-300`
- `font-size: 14px` → `text-sm`
- White background, pointer cursor

### BlockNote / Mantine Theming
- Uses Mantine's default light theme via `@blocknote/mantine/style.css`
- Formatting toolbar appears on text selection (hidden by default, replaced with custom `FormattingToolbarWithAI`)
- Slash menu appears on `/` (hidden by default, replaced with custom `SuggestionMenuWithAI`)
- AI menu and toolbar button come from `@blocknote/xl-ai/style.css` — inherits Mantine's light surface styling

### AI UI Elements
- `AIMenuController` — command palette that appears inline for AI prompts
- `AIToolbarButton` — added to the end of the formatting toolbar
- AI slash menu items — appended to the default `/` menu
- All styled by `@blocknote/xl-ai/style.css`, consistent with Mantine light theme

## Interaction Model

1. **Typing** — clean, distraction-free. No visible toolbar until text is selected.
2. **Selecting text** — formatting toolbar slides in with standard controls + AI button on the right.
3. **Slash command** — typing `/` opens suggestion menu. AI options ("Ask AI") appear alongside standard block types.
4. **AI interaction** — selecting an AI action opens the AI menu inline. Responses stream directly into the document.
5. **Briefing selector** — simple `<select>` dropdown above the editor. Switching re-renders the entire editor with new parsed markdown content.

## File Dependencies

```
@blocknote/core/fonts/inter.css    → Inter font
@blocknote/mantine/style.css       → Mantine light theme for BlockNote
@blocknote/xl-ai/style.css         → AI extension styles
```

No custom CSS files. All current styling is inline. Migration path is to Tailwind utility classes using the mappings above.
