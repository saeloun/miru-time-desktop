# Integration Specs

The integration suite uses Playwright to launch the packaged Electron runtime in a temporary `userData` directory. Specs live in `src/tests/e2e/example.test.ts`.

## Covered Flows

- App renders the Miru time tracking shell.
- In-app timer starts and pauses through the shared desktop timer IPC.
- Native tray title and menu expose timer state plus Miru time summary.
- Manual time entry can be added, updated, and deleted from the compact entry dialog.
- Existing entry can be resumed into the current desktop timer.
- Idle recovery supports remove-and-continue, remove-and-start-new, and ignore-and-continue.
- Timer context persists across Electron relaunches.
- Signed-in account menu opens, closes from Escape/outside click, resolves Miru avatar URLs, and logs out.
- Signed-in locale from the Miru user payload drives core app labels.

## Running

```bash
npm run test:e2e
```

The test process sets:

- `MIRU_E2E=true` so test-only idle simulation IPC is available.
- `MIRU_USER_DATA_DIR=<temp-dir>` so persistence tests do not touch the real app profile.

## Native UI Scope

The desktop timer, account menu, idle recovery, and entry editor are renderer-owned Electron UI surfaces. The delete flow still uses an Electron native confirmation in normal app usage. Automated specs avoid destructive confirmation in the happy path and cover the underlying entry creation/resume behavior through the renderer.

## API Sync Scope

The desktop app exposes Miru API IPC methods and syncs against Miru web `GET/PUT /api/v1/desktop/current_timer`. If Miru web is unreachable, current timer sync reports local/offline status and the app continues to track locally.
