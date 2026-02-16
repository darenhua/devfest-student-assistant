# SPEC: Module Page Layout — Title, Subheading, and Card

**Source of truth:** `src/app/modules/hello-world/page.tsx`
**Approved by:** Human developer (prototype review)
**Scope:** The visual layout and styling of the page-level UI structure — specifically the title, subheading (description text), and content card.

---

## 1. Requirement (WHAT)

A module page must present a clean, minimal page layout consisting of three visual elements stacked vertically:

1. **Title** — A large, bold heading that names the module. It is the dominant text element on the page.
2. **Subheading** — A quieter, secondary line of text below the title that provides brief context or purpose for the module.
3. **Card** — A visually distinct, bordered container below the header that holds the module's main content. It reads as a "panel" or "surface" that is elevated from the page background.

These three elements together create a **page hierarchy**: the eye moves from title → subheading → card content, top to bottom, with clear visual separation between the header zone and the content zone.

### What the human liked (behavioral observation)

The human approved this because the result **looks and feels** like:
- A clean, professional page that isn't cluttered
- Clear information hierarchy — you instantly know what the page is about (title), what it does (subheading), and where the content lives (card)
- The card feels like a distinct surface — it is visually separated from the page background by a border and a different background color
- There is comfortable whitespace — nothing feels cramped
- The typography scale feels proportional — the title is large enough to command attention, the subheading is clearly subordinate, and body text inside the card is at normal reading size
- Light mode and dark mode both look intentional and consistent

---

## 2. Visual Specification (HOW it looks)

### 2.1 Page Background

The page has a tinted background that is NOT pure white or pure black. This is what makes the card visually "float" above the page.

| Property | Light Mode | Dark Mode |
|----------|-----------|-----------|
| Background color | `zinc-50` (#fafafa) | `zinc-950` (#09090b) |

### 2.2 Page Container

All content is horizontally centered and constrained in width.

| Property | Value |
|----------|-------|
| Max width | `max-w-4xl` (56rem / 896px) |
| Horizontal centering | `mx-auto` |
| Page padding | `p-8` (2rem / 32px on all sides) |
| Full viewport height | `min-h-screen` |

### 2.3 Header Section

The header is a `<header>` element with bottom margin that creates visual separation from the card below.

| Property | Value |
|----------|-------|
| Bottom margin | `mb-8` (2rem / 32px) |

#### 2.3.1 Back Navigation Link

A small text link above the title that navigates back to the modules listing.

| Property | Value |
|----------|-------|
| Text size | `text-sm` (0.875rem) |
| Text color | `text-zinc-500` |
| Hover color | `hover:text-zinc-700` (light), `dark:hover:text-zinc-300` (dark) |
| Content | `← All Modules` (using `&larr;` HTML entity) |
| Destination | `/modules` |

#### 2.3.2 Title (h1)

| Property | Value |
|----------|-------|
| HTML element | `<h1>` |
| Top margin | `mt-2` (0.5rem / 8px) — creates small gap below the back link |
| Font size | `text-3xl` (1.875rem / 30px) |
| Font weight | `font-bold` (700) |
| Text color (light) | `text-zinc-900` (#18181b) |
| Text color (dark) | `dark:text-zinc-100` (#f4f4f5) |
| Text casing | As-is (lowercase "hello world" in the prototype; this is content, not style) |

#### 2.3.3 Subheading (description)

| Property | Value |
|----------|-------|
| HTML element | `<p>` |
| Top margin | `mt-1` (0.25rem / 4px) — sits tightly below the title |
| Text color | `text-zinc-500` (#71717a) — no dark mode override (zinc-500 works in both) |
| Font size | Default body size (1rem / 16px, no size class applied) |
| Font weight | Default (400, no weight class applied) |

**Critical detail:** The subheading uses `mt-1`, NOT `mt-2`. This tight spacing is intentional — the subheading reads as a continuation/annotation of the title, not as a separate section. The title and subheading form a single visual unit.

### 2.4 Content Card

| Property | Value |
|----------|-------|
| HTML element | `<main>` |
| Border radius | `rounded-lg` (0.5rem / 8px) |
| Border | `border border-zinc-200` (light), `dark:border-zinc-800` (dark) |
| Background (light) | `bg-white` (#ffffff) |
| Background (dark) | `dark:bg-zinc-900` (#18181b) |
| Internal padding | `p-6` (1.5rem / 24px) |

**Why the card works visually:** The card background (`white` / `zinc-900`) is lighter/different than the page background (`zinc-50` / `zinc-950`). Combined with the border, this creates a subtle surface elevation effect. The card appears to "sit on top of" the page.

### 2.5 Card Content Text (default)

| Property | Value |
|----------|-------|
| Text color (light) | `text-zinc-600` (#52525b) |
| Text color (dark) | `dark:text-zinc-400` (#a1a1aa) |
| Font size | Default body (1rem / 16px) |

---

## 3. Structural Specification (HOW it's built)

### 3.1 DOM Structure

```
div.page-wrapper          ← min-h-screen, bg, p-8
  div.container           ← mx-auto, max-w-4xl
    header                ← mb-8
      a.back-link         ← ← All Modules
      h1.title            ← Module name
      p.subheading        ← Description
    main.card             ← rounded-lg, border, bg, p-6
      [card content]      ← Whatever the module renders
```

### 3.2 Component Structure

```tsx
"use client";

export default function [ModuleName]Page() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <a href="/modules" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            &larr; All Modules
          </a>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          <p className="mt-1 text-zinc-500">
            {description}
          </p>
        </header>

        <main className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {/* Module content goes here */}
        </main>
      </div>
    </div>
  );
}
```

### 3.3 Technology Constraints

- **Framework:** Next.js App Router (page.tsx file convention)
- **Styling:** Tailwind CSS v4 utility classes only — no custom CSS, no CSS modules, no styled-components
- **Component type:** Client Component (`"use client"` directive) — required for any module that uses interactivity
- **Fonts:** Geist Sans (inherited from root layout via CSS variable `--font-geist-sans`)

---

## 4. Reproduction Steps (for a coding agent)

To reproduce this approved UI in a new module page:

1. Create a `page.tsx` file inside the module directory
2. Add `"use client"` at the top
3. Export a default function component named `[ModuleName]Page`
4. Apply the exact DOM structure from Section 3.2
5. Use the exact Tailwind class strings from Section 2 — do not substitute, simplify, or "improve" them
6. The back link must point to `/modules` and use the `&larr;` entity
7. Set the `<h1>` text to the module name
8. Set the `<p>` subheading to a brief description of the module's purpose
9. Place module-specific content inside the `<main>` card

### What NOT to do

- Do not add extra wrappers, containers, or divs around the structure
- Do not change the spacing values (e.g., don't use `mt-4` instead of `mt-2` on the title)
- Do not add shadows to the card — the border-only treatment is intentional
- Do not add transitions or animations to the card
- Do not use a `<div>` instead of `<main>` for the card — semantic HTML matters
- Do not use a `<div>` instead of `<header>` for the header — semantic HTML matters
- Do not skip the dark mode classes — every color must have a dark variant where specified
- Do not add a `<Link>` component for the back link — the prototype uses a plain `<a>` tag

---

## 5. Definition of Success (behavioral verification)

A reproduction is correct when a human observer would say YES to all of these:

1. **Title dominance:** The title is the first thing the eye is drawn to. It is clearly the largest, boldest text on the page.
2. **Subheading subordination:** The subheading reads as a caption or subtitle — it is visually quieter than the title (lighter color, normal weight) and sits close to the title, not floating separately.
3. **Card as surface:** The content area looks like a distinct panel/card/surface — it has visible boundaries (border) and a different background from the page. Content inside it feels "contained."
4. **Header-card separation:** There is clear visual breathing room between the header section (title + subheading) and the card. They are two distinct zones.
5. **Page feels airy:** Nothing is cramped. There is generous padding on all sides, and the content does not stretch to the edges of the viewport.
6. **Centered and constrained:** Content sits in the center of the page with a comfortable max-width. On wide screens, there is empty space on both sides.
7. **Dark mode parity:** Switching to dark mode produces an equally clean, intentional result — not a broken inversion. Backgrounds are dark, text is light, the card still feels like a distinct surface, borders are visible but subtle.
8. **Back navigation present:** There is a small, unobtrusive "← All Modules" link above the title that clearly offers a way back.

### What is NOT a success criterion

- Whether the page has specific functionality or interactivity
- Whether tests pass or the build succeeds
- Whether the code is "clean" or follows some abstract best practice
- Whether TypeScript types are comprehensive
- The specific text content of the title or subheading (that's per-module)
