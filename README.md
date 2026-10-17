# Financial System

An Angular 22 finance and procurement system with three pages: a login page, a dashboard, and a purchase orders page. It uses Bootstrap 5.3, has Dark/Light mode, and supports Arabic (RTL) and English (LTR).

## Quick start

```bash
npm install
npm start          # http://localhost:4200
```

**Demo login:** `admin` (or `admin@demo.com`) with the password `Admin@123`. You can also create a new account on the login page.

---

## Part 1: 

### General requirements

| Requirement | Done | How |
| --- | --- | --- |
| Angular (latest) | ✅ | Angular 22: standalone components, signals for state, and each page loads only when first visited ([app.routes.ts](src/app/app.routes.ts)) |
| Bootstrap 5+ and the grid | ✅ | Bootstrap 5.3. Layouts use `row` / `col-*`, and forms, buttons, tables and dropdowns use Bootstrap classes |
| HTML5 / CSS3 / TypeScript | ✅ | Strict TypeScript, SCSS, and semantic HTML (`header`, `main`, `nav`, `aside`) |
| Responsive (mobile, tablet, desktop) | ✅ | Bootstrap breakpoints. On phones and tablets the sidebar becomes a slide-in drawer and the navbar shrinks. Tables scroll sideways |
| Clean code with comments | ✅ | Every component and service starts with a comment explaining its role, and each major section is commented |
| Dark / Light mode toggle | ✅ | [ThemeService](src/app/core/services/theme.service.ts) sets `<html data-bs-theme>`, which Bootstrap and the app's color variables both follow. The choice is saved. Without a saved choice, the OS setting is used |
| RTL / LTR, switched by language | ✅ | [LanguageService](src/app/core/services/language.service.ts): choosing Arabic switches to RTL and English to LTR. It sets `<html dir lang>` and loads Bootstrap's RTL stylesheet. Component styles use start/end instead of left/right, so they mirror automatically |

### 1. Login page: [LoginComponent](src/app/features/auth/login/login.component.ts)

| Requirement | Done | How |
| --- | --- | --- |
| Email or username field | ✅ | One field that accepts either, checked by a custom validator |
| Password field | ✅ | With a show/hide button |
| Login button | ✅ | Shows a spinner and is disabled while signing in |
| "Forgot Password?" link | ✅ | Opens a working reset form |
| "Create New Account" link (optional) | ✅ | Opens a working registration form. New accounts can sign in straight away |
| Reactive Forms validation | ✅ | Required fields, email/username format, minimum password length, and a password-strength rule and "passwords match" check on registration |
| Bootstrap, responsive design | ✅ | Two columns on desktop (form and image). On smaller screens the image becomes a banner above the form |
| Dark/Light mode through a ThemeService | ✅ | Theme toggle and language switcher at the top of the form |

### 2. Dashboard page: [DashboardComponent](src/app/features/dashboard/dashboard.component.ts)

| Requirement | Done | How |
| --- | --- | --- |
| Sidebar navigation | ✅ | [SidebarComponent](src/app/features/layout/sidebar/sidebar.component.ts): a multi-level menu that opens the group containing the current page |
| Navbar: logo, user picture, theme toggle | ✅ | [NavbarComponent](src/app/features/layout/navbar/navbar.component.ts), which also holds the language switcher and notifications |
| Main content area | ✅ | [MainLayoutComponent](src/app/features/layout/main-layout/main-layout.component.ts) places the pages next to the sidebar and below the navbar |
| Statistics cards with dynamic data | ✅ | Five cards calculated from the purchase orders ([DashboardDataService](src/app/core/services/dashboard-data.service.ts)). Approving, rejecting or deleting an order changes them, and the % change compares this month with last month |
| Charts (ApexCharts) | ✅ | A procurement status donut chart and a budget items stacked bar chart. Both change colors with the theme and fonts with the language |
| Fully responsive | ✅ | Widgets are full width on smaller screens and two per row on large screens |

### 3. Purchase orders page: [PurchaseOrdersComponent](src/app/features/purchase-orders/purchase-orders.component.ts)

| Requirement | Done | How |
| --- | --- | --- |
| Formatted table of purchase orders | ✅ | A Bootstrap table with sortable columns and pagination |
| Search | ✅ | Searches the order number, description, budget item and creator |
| Filter by status (Under review, Approved, Rejected, Delivered…) | ✅ | Status tabs plus an exact-status dropdown with all 14 statuses |
| Actions: View, Approve, Delete | ✅ | Row menu. **View** opens a details panel. **Approve** is disabled for finished orders. **Delete** asks for confirmation |
| `.table-responsive` | ✅ | The table scrolls sideways on narrow screens |
| Dark/Light mode on all components | ✅ | Every color comes from theme variables |
| Organized, commented code | ✅ | The page, its details panel, the data service and the models are separate files |

> The Figma design titles this screen **Purchase requests (طلب مشتريات)**, so the page title and URL (`/procurement/purchase-requests`) use that name. `/purchase-orders` redirects to it.

---

## Part 2: Advanced and enhanced features

These go beyond the brief.

### AI finance assistant (Claude)
- A chat button on every page opens an assistant that answers questions about the purchase orders, such as "How much is pending review?" or "Which budget item has spent the most?".
- It reads the live data in the app, so answers include changes made in this session. Order numbers in its answers open that order.
- Replies stream in as they're written. A reply can be stopped, copied or retried.
- The API key stays on a small Node server and never reaches the browser. Each visitor's requests are rate-limited. Setup steps are [below](#ai-assistant-setup).

### Browser-style workspace tabs
- Every page and every opened purchase order gets its own tab, like tabs in a browser. The Dashboard tab is always open.
- Each tab remembers its filters, sorting, page number, selection and scroll position.
- Tabs can be closed with ×, a middle-click or Alt+W. A right-click menu offers Close others, Close to the right and Close all, and Alt+Shift+T reopens a closed tab. Alt+1…9 jumps to a tab.
- The open tabs are remembered for each user between visits.
- A breadcrumb above the tabs shows where you are.

### Purchase orders
- **Details side panel**: the order's fields, approval timeline, activity log, the creator's contact details and attachments. Its link can be shared (`?view=<id>`) and works with refresh and the browser's Back button.
- **Bulk actions**: select rows to Approve, Delete or Send them together. Bulk approve skips finished orders and says how many it skipped.
- **Summary cards** that filter the table when clicked.
- **Print report**: a print layout of every order matching the filters, or only the selected ones.
- **Full-screen table** mode.

### Dashboard widgets
Each widget has its own filters and actions:
- **My tasks**: Approve, Return and Reject actions, with confirmation dialogs.
- **Recent activities**: a timeline grouped by day, with a Today / Week / Month filter.
- **Procurement status**: a donut chart with a category filter and a month picker.
- **Recent transactions**: search, type filter and sorting.
- **Warehouses**: high or low stock view, and Restock.
- **Contracts**: progress bars and a progress filter.
- **Budget items**: a chart with a year selector and a filter for which series are shown.

The row menus also offer "copy number", and every dangerous action asks for confirmation first.

### Login and security
- After signing in, users go back to the page they originally asked for. Only addresses inside the app are allowed, which prevents open-redirect attacks.
- A **Remember me** option keeps the session after the browser closes. Without it, the session ends when the tab closes.
- The forgot-password form gives the same answer whether or not the email exists, so it can't be used to discover accounts.
- A Caps Lock warning appears while typing the password. After a failed submit, focus moves to the first invalid field.

### Navigation and productivity
- **Menu search** in the sidebar (Ctrl/⌘ + K).
- **Notifications** dropdown with an unread badge and Approve/Reject actions.
- A sidebar that collapses to icons only, and remembers that choice.
- Toast messages to confirm every action.

### Full Arabic support
- Every label is translated, and so is the mock data: names, descriptions and budget items.
- Dates and numbers use the language's format, for example "50 million riyals" / "50 مليون ريال".
- Arrows and icons flip to point the right way in RTL.
- The design's **Lusail** font, which covers both English and Arabic. It ships with the app as WOFF2 files in `public/fonts/` (Light, Regular, Medium and Bold). DM Sans (English) and IBM Plex Sans Arabic (Arabic) are the fallbacks.

### Animations
Subtle motion that guides the eye without slowing anyone down:
- **Page changes** cross-fade between routes (Angular's View Transitions).
- **Login page**: the hero photo slowly zooms in, and the sparkle icon floats gently.
- **Dashboard**: the statistics cards and then the widgets rise in one after another.
- **AI assistant**: the chat button pulses softly, the panel rises in, and three bouncing dots show while a reply is coming.
- Everything turns off when the system's "reduce motion" setting is on.

### Accessibility
- Full keyboard use: visible focus, and Esc closes the top-most dialog or menu. Dialogs move focus inside and keep it there.
- ARIA roles and labels on menus, tabs, dialogs and icon-only buttons. Form errors are announced by screen readers.
- Respects the system's "reduce motion" setting.

### Quality and performance
- **441 unit tests** (Vitest) across 38 test files, plus tests for the server.
- The saved theme and language are applied before Angular starts, so the page never flashes the wrong theme or direction.
- Each page's code is downloaded only when it's first visited.
- Data lives in services that could be switched to a real API without changing any component.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Development server at http://localhost:4200 |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Unit tests with a coverage report in `coverage/` |
| `npm run server` | Node server for the AI assistant (port 3000), restarts on changes |
| `npm run test:server` | Server tests (Node test runner, no API key needed) |

## AI assistant setup

The assistant answers with the Claude API. The browser never sees the API key. A small Node/Express server in [`server/`](server/) holds the key, calls Claude, and streams the answer back.

```
Angular chat panel ──POST /api/chat──► Node server ──► Claude API
                   ◄── streamed text ──  (API key)  ◄──
```

To run it locally:

1. Create an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys) and add credit. Set a monthly spend limit there too.
2. Copy `.env.example` to `.env` and paste the key after `ANTHROPIC_API_KEY=`. `.env` is git-ignored.
3. Run `npm run server` in one terminal and `npm start` in another. `ng serve` forwards `/api` calls to the server ([proxy.conf.json](proxy.conf.json)).

Without a key the app still works, and the assistant shows "not available".

The model is set with `CLAUDE_MODEL` in `.env`. The default is `claude-opus-5-5`. `claude-haiku-5-5` is about 40 times cheaper and works well for development. The server prints the model it uses when it starts.

In production, `npm run build` followed by `npm run server:prod` serves the built app and the API from one Node process. Each visitor can make 60 chat requests per 10 minutes (a question takes one per tool round), and messages are capped at 2,000 characters.

### Deploy (Render)

[render.yaml](render.yaml) describes one Node web service. It builds the Angular app, then `npm run server:prod` serves both the app and `/api/chat`.

1. In Render, choose **New → Blueprint** and pick this GitHub repository.
2. When asked, paste the API key for `ANTHROPIC_API_KEY`. Render stores it in the service's Environment settings, never in the repo.
3. Every push to `main` redeploys. `CLAUDE_MODEL` (Haiku by default here) can be changed in the same settings.

On the free plan the service sleeps when idle, so the first visit after a while takes about a minute to load.

### How it answers from your data

The purchase requests live in the browser session, so Claude's tools run in the browser, not on the server. The answers then match what's on screen, including requests approved, rejected or deleted in this session.

1. The browser sends the conversation to `/api/chat`.
2. The server adds the system prompt and the tool definitions ([chat-tools.ts](src/app/core/models/chat-tools.ts)) and streams Claude's turn back.
3. If Claude asks for a tool, [ChatToolsService](src/app/core/services/chat-tools.service.ts) validates the input, runs it on the session's data, and the browser sends the result back. This repeats until Claude answers, for at most 6 rounds per question.

| Tool | What it does |
| --- | --- |
| `get_overview` | Today's date, budget, committed amount, available balance, and totals per status and stage |
| `search_purchase_requests` | Filters requests by text, status, stage, budget item, amount and date |
| `get_purchase_request` | One request's details, workflow and recent activity |
| `spending_breakdown` | Totals by budget item, creator, status, stage or month |
| `open_purchase_request` | Opens a request's details panel in the app |

The browser keeps the conversation append-only, including Claude's reasoning blocks, which are tied to the exact conversation that produced them. The system prompt and tool list never change during a conversation. Very long conversations ask the user to start a new one instead of trimming the history.

## Project structure

```
src/app/
  core/        services (auth, theme, language, data, chat), guards, models, i18n dictionaries (en / ar)
  features/    auth/login, dashboard (+ widgets), purchase-orders (+ details panel), layout (shell, navbar, sidebar, tabs, chat)
  shared/      reusable components (chart, stat cards, filters, theme toggle, language switcher, icons), pipes, utils
server/        Node/Express server for the AI assistant
```

## Notes

- All app data is mock data, served by services in `core/services`. Each service is the only place that would change to call a real API.
- New accounts are kept in `localStorage`, because this demo has no real backend for accounts.
- Sidebar entries without a page (warehouses, accounting, …) are outside the scope of this task. Clicking one shows a "This feature is not available." message.
