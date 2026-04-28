# Integration Specs

The integration suite uses Playwright to launch the packaged Electron runtime in a temporary `userData` directory. Specs live in `src/tests/e2e/example.test.ts`.

## Covered Flows

- App renders the Miru time tracking shell.
- In-app timer starts and pauses through the shared desktop timer IPC.
- Manual time entry can be added from the Harvest-style entry dialog.
- Existing entry can be resumed into the current desktop timer.
- Idle recovery supports remove-and-continue, remove-and-start-new, and ignore-and-continue.
- Timer context persists across Electron relaunches.

## Running

```bash
npm run test:e2e
```

The test process sets:

- `MIRU_E2E=true` so test-only idle simulation IPC is available.
- `MIRU_USER_DATA_DIR=<temp-dir>` so persistence tests do not touch the real app profile.

## Native UI Scope

The delete flow uses an Electron native dialog in normal app usage. Automated specs avoid destructive confirmation in the happy path and cover the underlying entry creation/resume behavior through the renderer.

## API Sync Scope

The desktop app exposes Miru API IPC methods, but the live web sync contract depends on Miru web adding `GET/PUT /api/v1/desktop/current_timer`. Until that endpoint exists, current timer sync reports local/offline status and the app continues to track locally.
