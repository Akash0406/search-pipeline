# Third-Party Components

This file documents UI components in `@careerstack/ui` that were adapted from
external open-source projects, per the project's attribution requirements.

## shadcn/ui primitives

All files under `src/components/*` are adapted from **shadcn/ui**
(https://ui.shadcn.com), which distributes component source under the **MIT
License**. shadcn/ui is not an installed dependency — components are copied into
the repository and owned/maintained here (that is the shadcn model).

| Component file | shadcn source | Underlying library | License | Modifications |
|---|---|---|---|---|
| `button.tsx` | shadcn `button` | `@radix-ui/react-slot`, `class-variance-authority` | MIT | Relative `../lib/utils` import; explicit focus-visible ring offset for WCAG focus visibility. |
| `card.tsx` | shadcn `card` | — | MIT | Relative import; `rounded-xl` + `transition-shadow` for the design's rounded-card direction. |
| `input.tsx` | shadcn `input` | — | MIT | Relative import; strengthened focus-visible ring. |
| `label.tsx` | shadcn `label` | `@radix-ui/react-label` | MIT | Relative import only. |
| `badge.tsx` | shadcn `badge` | `class-variance-authority` | MIT | Added `success`, `warning`, `muted` variants mapped to design tokens. |
| `skeleton.tsx` | shadcn `skeleton` | — | MIT | Added `role="status"` / `aria-busy` / `aria-live` for accessible loading (Req 57). |
| `separator.tsx` | shadcn `separator` | `@radix-ui/react-separator` | MIT | Relative import only. |
| `avatar.tsx` | shadcn `avatar` | `@radix-ui/react-avatar` | MIT | Relative import only. |
| `tabs.tsx` | shadcn `tabs` | `@radix-ui/react-tabs` | MIT | Relative import only. |
| `dialog.tsx` | shadcn `dialog` | `@radix-ui/react-dialog` | MIT | Relative import; backdrop blur; `sm:rounded-xl`. |
| `sheet.tsx` | shadcn `sheet` | `@radix-ui/react-dialog` | MIT | Relative import only. |
| `dropdown-menu.tsx` | shadcn `dropdown-menu` | `@radix-ui/react-dropdown-menu` | MIT | Relative import; `cursor-pointer` on items. |
| `tooltip.tsx` | shadcn `tooltip` | `@radix-ui/react-tooltip` | MIT | Relative import only. |
| `command.tsx` | shadcn `command` | `cmdk` | MIT | Relative imports; accessible `DialogTitle`/`DialogDescription` in `sr-only` header for the command palette (Req 57.4). |
| `sonner.tsx` | shadcn `sonner` | `sonner`, `next-themes` | MIT | Relative import; toast classes mapped to design tokens. |
| `theme-provider.tsx` | next-themes wrapper (shadcn dark-mode guide) | `next-themes` | MIT | Thin wrapper only. |

## Design tokens

`src/styles/globals.css` follows the shadcn/ui Tailwind v4 CSS-variable
convention (MIT). The concrete OKLCH color values are original to CareerStack
and implement the design document's "UI/visual direction" palette (electric
indigo primary, cyan-blue secondary, emerald/amber/red states, slate neutrals,
warm-white light background, deep navy-charcoal dark background).

_Last updated: 2025-06 (initial foundation UI slice, tasks 15.1–15.3)._
