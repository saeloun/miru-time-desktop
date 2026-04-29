# Miru Time Tracking

Local-first macOS time tracker for Miru teams. The app is built from [`LuanRoger/electron-shadcn`](https://github.com/LuanRoger/electron-shadcn) with Electron Forge, Vite, React, TypeScript, Tailwind, TanStack Router, Vitest, and Playwright.

## What Ships

- Native macOS menu bar timer with elapsed time, Start/Pause, Reset, idle recovery, and Quit actions.
- Native tray menu with account, workspace, sync status, and Miru time summary.
- In-app timer synchronized with the desktop timer through Electron IPC.
- Harvest-style time entry screen for adding, editing, deleting, and resuming entries.
- Local storage for entries and timer context, plus persisted desktop timer state under Electron `userData`.
- Idle recovery actions: remove idle time and continue, remove idle time and start new, or ignore and continue.
- Native Electron confirmation dialog for destructive time-entry deletion.
- Miru API bridge for login, signup, logout, workspace switching, current timer sync, and saving timer entries.
- Miru-branded macOS app icon and in-app logo.

## Development

```bash
npm install
npm run start
```

## Verification

```bash
npm run test
npm run test:e2e
npm run package
```

The Playwright Electron specs cover the important desktop flows: shared timer sync, local time entry creation, resume into the menu bar timer, idle recovery actions, and timer persistence across app relaunch.

## Package And Install Locally

```bash
npm run package
open "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app"
```

For a distributable artifact:

```bash
npm run make
```

The macOS ZIP is produced under `out/make/zip/darwin/arm64/`.

## Release Prep

- `npm run test`
- `npm run test:e2e`
- `npm run make`
- Verify the packaged app opens and shows the Miru icon in Finder/Dock.
- Create a GitHub release from the generated ZIP or run `npm run publish` when ready to create a draft release.

## Docs

- [Sync strategy](docs/sync-strategy.md)
- [Integration specs](docs/integration-specs.md)
- [Release checklist](docs/release.md)
