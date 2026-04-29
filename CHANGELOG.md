# Changelog

## 0.1.6 - 2026-04-30

- Fixed production desktop login so a successful account login is not rejected when the follow-up workspace refresh is temporarily unavailable.
- Kept profile refresh for avatars and locale while preserving the signed-in session for local-first tracking.
- Added packaged Electron coverage for the production login fallback path.

## 0.1.5 - 2026-04-29

- Improved the main timer hero with a fixed control dock, tighter elapsed-time typography, and clearer spacing in the compact popup.
- Added a packaged Electron regression spec that checks the elapsed time and timer controls do not overlap.
- Rebuilt Apple Silicon, Intel macOS, Linux, and Windows release ZIPs.

## 0.1.4 - 2026-04-29

- Fixed the main timer hero controls so the timer and extra icon buttons no longer overlap in the compact popup.
- Added separate Apple Silicon and Intel macOS release builds.
- Rebuilt the desktop app from the current verified timer stack and timesheet drill-down code.
- Refreshed macOS, Linux, and Windows release ZIPs with URL-safe asset names.
- Reinstalled and verified the macOS app locally for testing.
- Verified release download links after publishing.

## 0.1.3 - 2026-04-29

- Expanded Electron E2E coverage for Miru API-backed projects, entries, auth, signup, workspace switching, current timer sync, timer save, and manual entry create/edit/resume flows.
- Added detailed entry drill-down from Today, This week, and Entries summary cards.
- Added a paused timer stack so starting a new timer keeps the existing timer resumable instead of discarding it.
- Extended Miru current timer sync to push and pull multiple timer states through the desktop timer API payload.
- Reworked the Playwright Electron harness to launch with isolated per-test user data directories and deterministic teardown.
- Stabilized account menu action tests by scoping interactions to the visible native account dialog.
- Verified the fixed harness leaves no rogue Miru/Electron processes after full test runs.

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
