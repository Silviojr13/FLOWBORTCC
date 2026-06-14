# CHAT REDESIGN PLAN — FLOWBOT

## 1. Project Analysis Summary

### 1.1 Route Structure

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Main chat page (root) |
| `/dashboard` | `app/dashboard/page.tsx` | Dashboard (identical to `/`) |
| `/api/chat` | `app/api/chat/route.ts` | Gemini API streaming endpoint |
| `/api/models` | `app/api/models/route.ts` | Available models list |

**Note:** Both `app/page.tsx` and `app/dashboard/page.tsx` are identical — they render `AppSidebar` + `SiteHeader` + `ChatPage`.

### 1.2 Layout Structure

```
RootLayout (app/layout.tsx)
├── Geist / Geist_Mono fonts
├── TooltipProvider
└── {children}

Page (app/page.tsx)
├── SidebarProvider
│   ├── AppSidebar (variant="inset")
│   └── SidebarInset
│       ├── SiteHeader
│       └── ChatPage (chatbot.tsx)
```

### 1.3 Identified Components

| Component | File | Role |
|-----------|------|------|
| **Sidebar** | `components/app-sidebar.tsx` | Left sidebar with nav, logo, user area |
| **NavMain** | `components/nav-main.tsx` | Main navigation items + Quick Create |
| **NavDocuments** | `components/nav-documents.tsx` | Documents section with dropdown actions |
| **NavSecondary** | `components/nav-secondary.tsx` | Settings, Help, Search links |
| **NavUser** | `components/nav-user.tsx` | User avatar, name, email, dropdown menu |
| **SiteHeader** | `components/site-header.tsx` | Top header bar with sidebar trigger + title |
| **ChatPage** | `components/chatbot.tsx` | Full chat UI (messages, input, welcome) |
| **SectionCards** | `components/section-cards.tsx` | Dashboard metric cards (not used in chat) |
| **DataTable** | `components/data-table.tsx` | Data table (not used in chat) |
| **ChartAreaInteractive** | `components/chart-area-interactive.tsx` | Charts (not used in chat) |

### 1.4 Shadcn/UI Components Available

| Component | File | Used In |
|-----------|------|---------|
| Avatar | `components/ui/avatar.tsx` | NavUser |
| Badge | `components/ui/badge.tsx` | SectionCards, DataTable |
| Breadcrumb | `components/ui/breadcrumb.tsx` | Not used |
| Button | `components/ui/button.tsx` | ChatPage, NavMain, DataTable |
| Card | `components/ui/card.tsx` | SectionCards, ChartAreaInteractive |
| Chart | `components/ui/chart.tsx` | ChartAreaInteractive, DataTable |
| Checkbox | `components/ui/checkbox.tsx` | DataTable |
| Drawer | `components/ui/drawer.tsx` | DataTable |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | NavUser, NavDocuments, DataTable |
| Input | `components/ui/input.tsx` | DataTable |
| Label | `components/ui/label.tsx` | DataTable |
| Select | `components/ui/select.tsx` | ChartAreaInteractive, DataTable |
| Separator | `components/ui/separator.tsx` | SiteHeader |
| Sheet | `components/ui/sheet.tsx` | Not used |
| Sidebar | `components/ui/sidebar.tsx` | AppSidebar, Page |
| Skeleton | `components/ui/skeleton.tsx` | Not used |
| Sonner | `components/ui/sonner.tsx` | Toast (via `sonner`) |
| Table | `components/ui/table.tsx` | DataTable |
| Tabs | `components/ui/tabs.tsx` | DataTable |
| ToggleGroup | `components/ui/toggle-group.tsx` | ChartAreaInteractive |
| Toggle | `components/ui/toggle.tsx` | Not used |
| Tooltip | `components/ui/tooltip.tsx` | RootLayout |

### 1.5 Current Color Theme

- **Light theme (default):** White backgrounds, gray borders, dark text — `oklch` color space
- **Dark theme (`.dark` class):** Dark gray backgrounds, light text, blue sidebar primary (`oklch(0.488 0.243 264.376)`)
- **Chat accent:** `#7c6af7` (purple) used inline in `chatbot.tsx` for user bubbles and send button
- **CSS variables:** Full set of Shadcn variables (`--background`, `--foreground`, `--sidebar-*`, etc.)

### 1.6 Authentication System

- **No real auth implemented.** User data is hardcoded in `app-sidebar.tsx`:
  ```ts
  user: { name: "shadcn", email: "m@example.com", avatar: "/avatars/shadcn.jpg" }
  ```
- `NavUser` displays name, email, avatar with dropdown (Account, Billing, Notifications, Log out)

### 1.7 Components That Can Be Reused

| Component | Reuse Plan |
|-----------|-----------|
| `Sidebar` (Shadcn) | Keep as-is, restyle colors |
| `Button` (Shadcn) | Keep for suggestion chips and send button |
| `Badge` (Shadcn) | Use for suggestion chips |
| `Avatar` (Shadcn) | Keep in NavUser |
| `DropdownMenu` (Shadcn) | Keep in NavUser |
| `Separator` (Shadcn) | Keep in SiteHeader |
| `SidebarTrigger` (Shadcn) | Keep for mobile sidebar toggle |
| `Lucide Icons` | Keep for action buttons |

---

## 2. What Will Be Maintained

- **`AppSidebar`** — Full structure, navigation, menus, user section
- **`NavMain`** — Navigation items and Quick Create button
- **`NavDocuments`** — Documents section with context menus
- **`NavSecondary`** — Settings, Help, Search
- **`NavUser`** — User avatar, name, email, dropdown actions
- **`SidebarProvider` / `SidebarInset`** — Layout shell
- **Chat logic** — All streaming, conversation management, API calls in `chatbot.tsx`
- **API routes** — `/api/chat` and `/api/models` unchanged
- **Root layout** — Font loading, `TooltipProvider`

## 3. What Will Be Changed

| File | Change |
|------|--------|
| `app/globals.css` | Add dark theme as default, new CSS variables for deep blue/navy palette, starfield background styles |
| `app/layout.tsx` | Add `class="dark"` to `<html>` to force dark mode by default |
| `app/page.tsx` | Simplify wrapper, remove extra padding, let ChatPage control layout |
| `components/site-header.tsx` | Make sticky/fixed, add backdrop-blur, semi-transparent dark bg, update title |
| `components/chatbot.tsx` | Major visual overhaul: welcome screen, suggestion chips, sticky input, conversation view with max-width, dark theme styling |
| `components/app-sidebar.tsx` | Color adjustments to match dark theme (minimal CSS changes, mostly via CSS variables) |

## 4. What Will Be Created

| File | Purpose |
|------|---------|
| `components/starfield-background.tsx` | Lightweight CSS-based starfield/particle background component |
| `components/welcome-screen.tsx` | Central welcome area with image placeholder, title, subtitle, suggestion chips |
| `components/chat-input.tsx` | Extracted sticky message input component with action buttons |

## 5. Possible Risks

| Risk | Mitigation |
|------|-----------|
| Dark mode breaking existing dashboard components | Dashboard components (`SectionCards`, `DataTable`, `ChartAreaInteractive`) already have dark theme support via CSS variables |
| Inline styles in `chatbot.tsx` conflict with Tailwind | Gradually replace inline styles with Tailwind classes during refactoring |
| Sticky input overlapping content on mobile | Use `position: sticky` with proper `safe-area-inset` and test on multiple viewports |
| Performance of starfield effect | Pure CSS with `radial-gradient` dots, no canvas or JS animation |
| Breaking chat streaming logic | Keep all state/API logic untouched, only modify JSX/rendering |

## 6. Dependencies

- **No new dependencies required.** Everything achievable with:
  - Tailwind CSS v4
  - Shadcn/UI components (already installed)
  - Lucide React icons (already installed)
  - CSS custom properties (already set up)

---

## 7. Implementation Stages

### Task 1 — Main Layout Adjustment
**Files:** `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

**Changes:**
- Set `<html class="dark">` as default dark mode
- Add new CSS variables for the deep blue/navy palette in `globals.css`:
  - `--bg-deep`: very dark navy/space blue
  - `--bg-surface`: slightly lighter surface for cards/inputs
  - `--accent-blue`: vibrant blue for CTAs
  - `--text-primary`, `--text-secondary`: light text tones
  - `--glow`: subtle glow color for borders
- Add starfield CSS (radial-gradient dots on body/main background)
- Simplify `app/page.tsx` wrapper to give full height to ChatPage
- Ensure `body` fills viewport with dark background

**Validation:** App loads with dark background, sidebar renders correctly.

---

### Task 2 — Starfield Background
**Files:** `components/starfield-background.tsx`, `app/page.tsx`

**Changes:**
- Create lightweight `StarfieldBackground` component:
  - Pure CSS radial-gradient dots (no canvas, no JS animation)
  - Positioned as fixed/absolute background layer
  - Very subtle, low opacity dots
  - Optional: faint radial gradient for depth/spatial feel
- Render it behind the main content area in `app/page.tsx`

**Validation:** Dark background with subtle star-like dots visible, no performance impact.

---

### Task 3 — Fixed Topbar
**Files:** `components/site-header.tsx`

**Changes:**
- Add `position: sticky; top: 0; z-index: 50`
- Add `backdrop-filter: blur(12px)`
- Add semi-transparent dark background (`bg-background/80`)
- Add subtle bottom border (`border-b border-white/5`)
- Update title text to match FLOWBOT branding
- Ensure consistent height

**Validation:** Header stays visible on scroll, blur effect works, matches dark theme.

---

### Task 4 — Sticky Message Input
**Files:** `components/chat-input.tsx`, `components/chatbot.tsx`

**Changes:**
- Extract input area into `ChatInput` component
- Apply `position: sticky; bottom: 0` within the chat area
- Dark container styling:
  - Near-black background with slight transparency
  - Soft border, rounded corners (`rounded-2xl`)
  - Subtle backdrop blur
- Add action button area (file upload, mic, tools — icons only, reserved)
- Primary "Send" button with vibrant blue (`--accent-blue`)
- Keep textarea auto-resize and Enter/Shift+Enter behavior
- Keep streaming abort button

**Validation:** Input always visible, dark styled, send button works, streaming unaffected.

---

### Task 5 — Welcome Screen (Central Area)
**Files:** `components/welcome-screen.tsx`, `components/chatbot.tsx`

**Changes:**
- Extract welcome state into `WelcomeScreen` component
- Shown when `messages.length === 0`
- Centered vertically and horizontally with flexbox
- Elements:
  - `<ImagePlaceholder />` — 140-180px container, rounded, subtle border/glow
  - Title: "O que você deseja criar?" — large, medium weight, centered
  - Subtitle: "Descreva sua ideia de projeto." — smaller, muted color
  - Suggestion chips using Shadcn `Badge`/`Button`:
    - "Robô Autônomo", "Monitoramento IoT", "Estufa Inteligente", "Veículo Robótico"
    - Dark bg, soft borders, hover glow
    - Clicking fills the input field
- Responsive: stack chips on mobile

**Validation:** Welcome screen appears centered, chips are clickable, responsive on mobile.

---

### Task 6 — Conversation Area Styling
**Files:** `components/chatbot.tsx`

**Changes:**
- When conversation is active, messages area:
  - `max-width: 900px` centered
  - Proper spacing between messages (gap: 16-20px)
  - Message bubbles restyled for dark theme:
    - User: vibrant blue/purple gradient
    - Assistant: dark surface with subtle border
  - Typing indicator adapted to dark theme
- Scroll area fills space between header and sticky input
- Smooth scroll to bottom maintained

**Validation:** Messages render in centered column, readable, dark themed, scroll works.

---

### Task 7 — Responsiveness & Visual Refinements
**Files:** `components/chatbot.tsx`, `components/site-header.tsx`, `app/page.tsx`

**Changes:**
- Mobile: sidebar collapses (already supported via `collapsible="offcanvas"`)
- Input always accessible on mobile (sticky bottom)
- Topbar fixed on all viewports
- Welcome screen content scales down on small screens
- Add generous padding/spacing throughout
- Fine-tune:
  - Border opacities
  - Hover states
  - Transition animations (150-200ms, ease)
  - Glow effects on focus
  - Consistent border-radius

**Validation:** Test on desktop (1920px), notebook (1366px), tablet (768px), mobile (375px). All elements functional and visually coherent.

---

## 8. File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `app/globals.css` | Modify — add dark palette, starfield CSS |
| 2 | `app/layout.tsx` | Modify — force dark class |
| 3 | `app/page.tsx` | Modify — simplify wrapper, add starfield |
| 4 | `components/site-header.tsx` | Modify — sticky, blur, dark styling |
| 5 | `components/chatbot.tsx` | Modify — major visual overhaul, extract sub-components |
| 6 | `components/starfield-background.tsx` | Create — CSS starfield effect |
| 7 | `components/welcome-screen.tsx` | Create — welcome/landing screen |
| 8 | `components/chat-input.tsx` | Create — sticky input component |

**Files NOT modified:** `app-sidebar.tsx`, `nav-main.tsx`, `nav-documents.tsx`, `nav-secondary.tsx`, `nav-user.tsx`, `api/*`, `section-cards.tsx`, `data-table.tsx`, `chart-area-interactive.tsx`
