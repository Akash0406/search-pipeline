# Third-Party Components

This file is the repo-root log of community/open-source UI components that were
copied into the CareerStack codebase (as opposed to consumed as opaque runtime
dependencies), together with their source, licence, any modifications, and the
date logged. It exists to satisfy attribution requirements for copied source.

> Package-local detail lives alongside the code in
> [`packages/ui/THIRD_PARTY_COMPONENTS.md`](./packages/ui/THIRD_PARTY_COMPONENTS.md).
> This root file summarises and points to it.

## `@careerstack/ui` — shadcn/ui primitives

All files under `packages/ui/src/components/*` are adapted from
**[shadcn/ui](https://ui.shadcn.com)**, distributed under the **MIT License**.
shadcn/ui is intentionally *not* an installed dependency — its model is to copy
component source into the repository, where we own and maintain it. Each
component builds on Radix UI primitives (also MIT) and the design system's
Tailwind tokens.

| Component | Source | Underlying library | Licence | Modifications | Date |
|---|---|---|---|---|---|
| `button` | shadcn/ui `button` | `@radix-ui/react-slot`, `class-variance-authority` | MIT | Relative import; explicit WCAG focus-visible ring. | 2025-06 |
| `card` | shadcn/ui `card` | — | MIT | Rounded-xl + subtle shadow per design direction. | 2025-06 |
| `input` | shadcn/ui `input` | — | MIT | Strengthened focus-visible ring. | 2025-06 |
| `label` | shadcn/ui `label` | `@radix-ui/react-label` | MIT | Relative import only. | 2025-06 |
| `badge` | shadcn/ui `badge` | `class-variance-authority` | MIT | Added `success`/`warning`/`muted` design-token variants. | 2025-06 |
| `skeleton` | shadcn/ui `skeleton` | — | MIT | Added `role="status"`/`aria-busy` for accessible loading. | 2025-06 |
| `separator` | shadcn/ui `separator` | `@radix-ui/react-separator` | MIT | Relative import only. | 2025-06 |
| `avatar` | shadcn/ui `avatar` | `@radix-ui/react-avatar` | MIT | Relative import only. | 2025-06 |
| `tabs` | shadcn/ui `tabs` | `@radix-ui/react-tabs` | MIT | Relative import only. | 2025-06 |
| `dialog` | shadcn/ui `dialog` | `@radix-ui/react-dialog` | MIT | Backdrop blur; `sm:rounded-xl`. | 2025-06 |
| `sheet` | shadcn/ui `sheet` | `@radix-ui/react-dialog` | MIT | Relative import only. | 2025-06 |
| `dropdown-menu` | shadcn/ui `dropdown-menu` | `@radix-ui/react-dropdown-menu` | MIT | `cursor-pointer` on items. | 2025-06 |
| `tooltip` | shadcn/ui `tooltip` | `@radix-ui/react-tooltip` | MIT | Relative import only. | 2025-06 |
| `command` | shadcn/ui `command` | `cmdk` | MIT | Accessible `DialogTitle`/`DialogDescription` for the command palette. | 2025-06 |
| `sonner` | shadcn/ui `sonner` | `sonner`, `next-themes` | MIT | Toast classes mapped to design tokens. | 2025-06 |
| `theme-provider` | shadcn/ui dark-mode guide | `next-themes` | MIT | Thin wrapper only. | 2025-06 |

## Design tokens

`packages/ui/src/styles/globals.css` follows the shadcn/ui Tailwind v4
CSS-variable convention (MIT). The concrete OKLCH colour values are original to
CareerStack and implement the design's visual direction (electric-indigo
primary, cyan-blue secondary, emerald/amber/red state colours, slate neutrals,
warm-white light background, deep navy-charcoal dark background).

## Custom components (not third-party)

The application-shell and marketing components under `apps/web/src/components/*`
(hero, feature bento, sidebar, bottom nav, command palette wiring, active-profile
indicator, status badge, etc.) are original CareerStack code built *on top of*
the shadcn/ui primitives above, inspired by common 21st.dev-style layout
patterns. No third-party source was copied for them.

_Last updated: 2025-06 — foundation UI slice (tasks 15.1–15.3, 11.6)._
