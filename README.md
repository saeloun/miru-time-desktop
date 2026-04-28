# Miru Time Desktop

Local-first macOS desktop app for teams that bill by the hour.

Built from [`LuanRoger/electron-shadcn`](https://github.com/LuanRoger/electron-shadcn) with Electron Forge, Vite, React, TypeScript, Tailwind, shadcn/ui-style primitives, TanStack Router, Vitest, and Playwright.

## Product Surface

- Timer with project, client, task, notes, billable flag, and local persistence.
- Day, week, and month timesheet surface.
- Clients, projects, budget burn, hourly rates, and project health.
- Team capacity, submitted hours, and approval workflow.
- Reports for billable time, project budgets, utilization, and profitability.
- Invoices generated from approved time plus expense tracking.
- Workspace, billing, notification, import, integration, and security settings.

## Design Direction

The UI follows the local Miru web and website guidance:

- Operational Calm: dense, scannable, finance-safe.
- Geist typography with tabular numbers for hours and money.
- Tokenized neutral surfaces with Miru violet primary actions.
- Compact tables, clear status labels, visible focus states, and role-aware navigation.

## Development

```bash
npm install
npm run start
```

## Package For macOS

```bash
npm run package
```

The packaged app is created under `out/Miru Time Desktop-darwin-*`.
