# Miru Time Tracking

Miru Time Tracking is a local-first macOS menu bar app for employees who need a fast, focused way to track work in Miru. It keeps the timer visible in the system menu bar, opens into a compact desktop tracker, and syncs the current timer with Miru web when an account is connected.

Built from [`LuanRoger/electron-shadcn`](https://github.com/LuanRoger/electron-shadcn) with Electron Forge, Vite, React, TypeScript, Tailwind, TanStack Router, Vitest, and Playwright.

Miru Time Tracking is MIT-licensed software.

- Miru web app: <https://app.miru.so>
- Miru product site: <https://miru.so>
- Miru web source: <https://github.com/saeloun/miru-web>
- Desktop source: <https://github.com/saeloun/miru-time-desktop>

## Screenshots

<p align="center">
  <img src="docs/assets/screenshots/timer-running.png" alt="Miru Time Tracking running timer" width="260">
  <img src="docs/assets/screenshots/account-settings.png" alt="Miru Time Tracking account and settings popover" width="260">
  <img src="docs/assets/screenshots/idle-recovery.png" alt="Miru Time Tracking idle recovery modal" width="260">
  <img src="docs/assets/screenshots/profile-avatar.png" alt="Miru Time Tracking profile avatar in the timer window" width="260">
</p>

These screenshots are generated from the packaged Electron app flow used by the integration specs: signed-in timer, account/sync menu, idle recovery, and a sanitized profile-avatar preview. The avatar preview uses generic local work data and does not expose email, tokens, workspace, client, project, or entry details.

## Downloads

Latest release: <https://github.com/saeloun/miru-time-desktop/releases/tag/v0.1.5>

- [macOS Apple Silicon ZIP](https://github.com/saeloun/miru-time-desktop/releases/download/v0.1.5/Miru.Time.Tracking-darwin-arm64-0.1.5.zip)
- [macOS Intel ZIP](https://github.com/saeloun/miru-time-desktop/releases/download/v0.1.5/Miru.Time.Tracking-darwin-x64-0.1.5.zip)
- [Linux x64 ZIP](https://github.com/saeloun/miru-time-desktop/releases/download/v0.1.5/Miru.Time.Tracking-linux-x64-0.1.5.zip)
- [Windows x64 ZIP](https://github.com/saeloun/miru-time-desktop/releases/download/v0.1.5/Miru.Time.Tracking-win32-x64-0.1.5.zip)

## Highlights

- **Native macOS menu bar timer** with a stable-width time label and stateful tray icon colors for ready, running, paused, and idle.
- **Compact time tracker window** positioned below the menu bar, with high-contrast timer controls, fixed-width icon dock, and a Miru-styled command surface.
- **Local-first tracking** through renderer local storage plus persisted Electron `userData` timer state, so timers survive app relaunches.
- **Resumable timer stack** so starting a new timer keeps the previous timer available to resume or remove.
- **Timesheet drill-down** from Today, This week, and Entries summary cards into detailed time entries.
- **Miru account bridge** for login, signup handoff, logout, workspace switching, current timer pull/push, and saving, editing, or deleting time entries.
- **Current timer sync** with Miru web through `GET/PUT /api/v1/desktop/current_timer`, including multiple desktop timer states.
- **Idle recovery** with a custom in-app modal: trim and continue, trim and restart, or keep idle time.
- **Employee-focused UI** with no billing, rates, invoice, admin, or dashboard surfaces.
- **Profile-aware settings** showing the Miru user avatar when available, workspace, sync status, idle threshold, and locale.
- **Miru locale support** that reads `user.locale` or user settings first, then falls back to stored/browser locale and English strings.
- **Integration coverage** for the desktop timer, tray title, idle recovery, persistence, account menu behavior, and locale rendering.

## Product Shape

The app intentionally behaves like a small desktop utility, not a full web dashboard.

- The first screen is login/signup when no Miru session exists.
- The primary surface is the timer, project/task notes, summary, and timesheet entries.
- Account and sync controls live in a focused popover from the profile button.
- The tray icon carries state visually; the tray title stays width-stable to avoid menu bar jitter.

## Local Development

```bash
rtk mise exec -- bun install
rtk mise exec -- bun run start
```

The app opens an Electron window and creates a macOS menu bar item. During normal development it stores app data in Electron `userData`.

## Miru Web Connection

Production builds connect to Miru web at `https://app.miru.so` by default and do not show a Miru URL field in the sign-in flow.

Useful development overrides:

```bash
MIRU_API_BASE_URL=http://127.0.0.1:3000 rtk mise exec -- bun run start
MIRU_SHOW_BASE_URL_FIELD=true rtk mise exec -- bun run start
MIRU_ALLOW_BASE_URL_OVERRIDE=true rtk mise exec -- bun run start
```

`MIRU_API_BASE_URL` changes the default API host. `MIRU_SHOW_BASE_URL_FIELD` exposes the sign-in URL field. `MIRU_ALLOW_BASE_URL_OVERRIDE` lets the main process honor stored or submitted custom hosts.

## Build From Source

Use Node 24, matching CI.

```bash
rtk mise exec -- bun install
rtk mise exec -- bun run check
rtk mise exec -- bun run test
rtk mise exec -- bun run package
```

`bun run package` creates an unpacked macOS app under `out/`. `bun run make` creates distributable release artifacts under `out/make/`.

Portable ZIP builds for release:

```bash
rtk mise exec -- bun run make:mac
rtk mise exec -- bun run make:mac:apple
rtk mise exec -- bun run make:mac:intel
rtk mise exec -- bun run make:linux
rtk mise exec -- bun run make:windows
```

## Verification

```bash
rtk mise exec -- bun run check
rtk mise exec -- bun run test
rtk mise exec -- bun run test:e2e
rtk mise exec -- bun run package
```

Useful full release check:

```bash
rtk mise exec -- bun run check
rtk mise exec -- bun run test
rtk mise exec -- bun run test:e2e
rtk mise exec -- bun run make
rtk mise exec -- bun audit
```

The Playwright Electron specs launch the packaged app in a temporary profile so tests do not touch your real timer or Miru session.

## Package and Install Locally

Package the macOS app:

```bash
rtk mise exec -- bun run package
```

Open the packaged app:

```bash
open "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app"
```

Install it into `/Applications`:

```bash
ditto "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app" "/Applications/Miru Time Tracking.app"
open "/Applications/Miru Time Tracking.app"
```

Build a distributable ZIP:

```bash
rtk mise exec -- bun run make
```

The ZIP is generated under:

```text
out/make/zip/darwin/arm64/
```

## Miru Sync

Renderer calls are exposed through `window.miruApi`:

- `login`, `signup`, `logout`
- `switchWorkspace`
- `syncCurrentTimer("pull" | "push")`
- `saveTimerEntry`, `updateTimerEntry`, `deleteTimerEntry`

The main process owns API calls, local account persistence, timer persistence, tray updates, and offline fallback. Email/password login completes a desktop session today. Signup returns users to the login form after Miru creates the account, and Google opens Miru web sign-in until Miru web exposes a native desktop token callback. See [Sync strategy](docs/sync-strategy.md) for the API contract and conflict rules.

## Testing Scope

See [Integration specs](docs/integration-specs.md) for the current e2e coverage.

Covered flows include:

- Signed-out onboarding.
- Shared desktop timer behind the renderer.
- Native tray title and icon state.
- Idle recovery actions.
- Timer hero layout guard so elapsed time and controls do not overlap.
- Start-new-timer and paused timer resume flows.
- Timer context persistence across relaunch.
- Account menu close/logout behavior.
- Miru user locale rendering.
- RTL locale layout.
- Live timesheet history, date switching, and summary-card drill-down.
- Miru current timer push/pull with multiple timer states.

## Release Prep

1. Run `rtk mise exec -- bun run check`.
2. Run `rtk mise exec -- bun run test`.
3. Run `rtk mise exec -- bun run test:e2e`.
4. Run `rtk mise exec -- bun run make`.
5. Open the packaged app and confirm the Miru icon, tray timer, account popover, and idle modal render correctly.
6. Publish the generated ZIP manually or run `rtk mise exec -- bun run publish` when ready for a draft GitHub release.

Additional release notes live in [Release checklist](docs/release.md).

## Docs

- [Build and compile guide](docs/building.md)
- [Sync strategy](docs/sync-strategy.md)
- [Integration specs](docs/integration-specs.md)
- [Release checklist](docs/release.md)
