# Changelog

## 0.1.2 - 2026-04-29

- Moved the canonical repository and release links to `saeloun/miru-time-desktop`.
- Switched the repo workflow to Bun through mise with a repo-local agent guide.
- Updated runtime and development dependencies to their latest compatible releases.
- Added release notes maintenance under `docs/releases/`.
- Expanded Electron E2E coverage for idle recovery UI, RTL locale layout, and live timesheet date switching.
- Cleared the Bun dependency audit with top-level transitive overrides.
- Kept release download links URL-safe for macOS, Linux, and Windows ZIP builds.

## 0.1.1 - 2026-04-29

- Defaulted production Miru sync to `https://app.miru.so`.
- Hid the Miru URL field from production sign-in builds while keeping explicit development overrides.
- Added package metadata, Miru web links, build documentation, and release instructions.
- Polished the signed-in tracker, account menu, and native tray timer controls.
- Added E2E coverage for the production Miru URL default.

## 0.1.0 - 2026-04-28

- Added a Miru-branded Electron desktop app for macOS.
- Added a shared native menu bar timer with Start/Pause, Reset, idle detection, and persistence.
- Added a compact time tracking view with add, edit, delete, and resume flows backed by local storage.
- Added native Electron confirmation for deleting time entries.
- Added Miru API bridge methods for auth, workspace switching, current timer sync, and saving time.
- Added Playwright Electron specs for timer sync, entry creation, resume, idle recovery, and relaunch persistence.
- Added macOS app icon, release checklist, sync strategy, and integration docs.
