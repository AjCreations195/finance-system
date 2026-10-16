# Financial System

An Angular 22 finance and procurement dashboard. It has a login page, a dashboard, and a purchase requests page. It is styled with Bootstrap 5.3 and supports Dark/Light mode and Arabic (RTL) / English (LTR).

## Run it

```bash
npm install
npm start          # http://localhost:4200
```

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Unit tests with a coverage report in `coverage/` |

## Demo login

| Field | Value |
| --- | --- |
| Email **or** username | `admin@demo.com` or `admin` |
| Password | `Admin@123` |

You can also click **Create an account** on the login page. New accounts are kept in `localStorage` (this is a mock backend with no server).

## Where each requirement lives

### General

| Requirement | Implementation |
| --- | --- |
| Angular (latest) | Angular 22: standalone components, signals, lazy-loaded routes ([app.routes.ts](src/app/app.routes.ts)) |
| Bootstrap 5 + grid | Bootstrap 5.3 grid (`row` / `col-*`), utilities, form controls and dropdowns throughout |
| Responsive | Bootstrap breakpoints. Below `lg` the sidebar becomes a slide-in drawer, and tables use `.table-responsive` |
| Dark / Light mode | [ThemeService](src/app/core/services/theme.service.ts) sets `<html data-bs-theme>`, which Bootstrap and the CSS tokens in [styles.scss](src/styles.scss) both read. The choice is saved. Without a saved choice, the OS setting is used |
| RTL / LTR | [LanguageService](src/app/core/services/language.service.ts) takes the direction from the language (Arabic → RTL, English → LTR). It sets `<html dir lang>` and switches to Bootstrap's RTL stylesheet. Component CSS uses logical properties (`margin-inline-start`, `inset-inline-end`, …) |
| Comments | Every service and component has a header comment that explains its role, and each major section is commented |

### 1. Login page: [LoginComponent](src/app/features/auth/login/login.component.ts)

- Email-or-username field, password field, Login button, **Forgot password?** link and **Create an account** link.
- Reactive Forms validation: required fields, an email-or-username format check, a minimum password length, and on the registration form a password strength rule and a "passwords match" check.
- Errors appear after the user leaves a field or submits. Focus moves to the first invalid field. The button shows a loading spinner. A Caps Lock warning appears.
- After login the user returns to the page they first asked for (`returnUrl`), and only links inside the app are allowed.
- The theme toggle and language switcher sit at the top of the form.

### 2. Dashboard: [DashboardComponent](src/app/features/dashboard/dashboard.component.ts)

- **Layout** ([MainLayoutComponent](src/app/features/layout/main-layout/main-layout.component.ts)): a [sidebar](src/app/features/layout/sidebar/sidebar.component.ts) with a multi-level menu and menu search (Ctrl/⌘ + K), and a [navbar](src/app/features/layout/navbar/navbar.component.ts) with the logo, user picture and menu, theme toggle, language switcher and notifications. The main content area sits next to them.
- **Statistics cards**: [StatCarouselComponent](src/app/shared/components/stat-carousel/stat-carousel.component.ts). It is driven by signal data and shows numbers in the active language's format.
- **Charts**: ApexCharts. The [ChartComponent](src/app/shared/components/chart/chart.component.ts) wrapper re-colors charts when the theme changes and switches their font when the language changes. The dashboard has a donut chart ([procurement status](src/app/features/dashboard/widgets/procurement-status)) and a stacked bar chart ([budget items](src/app/features/dashboard/widgets/budget-items)).
- Other widgets: my tasks, recent activities, transactions, warehouses and contracts. Each is a separate component under [widgets/](src/app/features/dashboard/widgets).

### 3. Purchase orders page: [PurchaseOrdersComponent](src/app/features/purchase-orders/purchase-orders.component.ts)

The Figma design titles this screen **Purchase requests (طلب مشتريات)**, so the page title, data model and URL (`/procurement/purchase-requests`) use that name. `/purchase-orders` redirects to it.

- Bootstrap table inside `.table-responsive`, with sortable columns, row selection and pagination.
- **Search** across the number, description, budget item and creator.
- **Status filter**: status tabs (All / Fully completed / Partially completed / In progress / Rejected) and an exact-status dropdown. The statuses include *Under review*, *Approved*, *Rejected*, *Delivered*, *In progress*, *Completed* and others.
- **Actions** in each row's menu:
  - **View** opens a details side panel. Its URL can be shared (`?view=<id>`).
  - **Approve** is disabled for requests that are already finished.
  - **Delete** asks for confirmation first.
- Bulk Approve, Delete and Send act on the selected rows. Print produces a print-friendly report.

## Project structure

```
src/app/
  core/        services (auth, theme, language, data), guards, models, i18n dictionaries (en / ar)
  features/    auth/login, dashboard (+ widgets), purchase-requests, layout (shell, navbar, sidebar)
  shared/      reusable components (chart, stat cards, filters, theme toggle, language switcher), pipes, utils
```

## Notes

- All data is mock data, served by services in `core/services`. Each service is the only place that would change to call a real API.
- Sidebar entries without a page (warehouses, accounting, …) are outside the scope of this task. Clicking one shows a "This feature is not available." message.
