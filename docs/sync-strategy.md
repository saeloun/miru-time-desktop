# Miru Current Timer Sync Strategy

Miru Time Tracking treats the local desktop timer as the source of truth while the app is offline. When a Miru session exists, the desktop app can push or pull the current timer through the API bridge exposed as `window.miruApi`.

Production builds connect to Miru web at `https://app.miru.so`. Local and self-hosted endpoints are development overrides through `MIRU_API_BASE_URL`, `MIRU_SHOW_BASE_URL_FIELD`, and `MIRU_ALLOW_BASE_URL_OVERRIDE`.

## Electron Boundary

Renderer calls:

- `window.miruApi.login({ baseUrl, email, password })`
- `window.miruApi.signup({ baseUrl, email, firstName, lastName, password })`
- `window.miruApi.logout()`
- `window.miruApi.switchWorkspace(workspaceId)`
- `window.miruApi.syncCurrentTimer("push" | "pull")`
- `window.miruApi.saveTimerEntry({ projectId, userId })`
- `window.miruTimer.startNew()`, `resumeSlot(timerId)`, and `deleteSlot(timerId)`

Main process responsibilities:

- Stores auth session data in Electron `userData/miru-account.json`.
- Stores desktop timer state in Electron `userData/timer-state.json`.
- Applies API timeouts so the timer remains local-first when Miru web is unavailable.
- Keeps the macOS menu bar timer responsive even when sync fails.

## API Contract

Miru web provides:

```http
GET /api/v1/desktop/current_timer
PUT /api/v1/desktop/current_timer
```

`PUT` payload:

```json
{
  "current_timer": {
    "billable": true,
    "elapsed_ms": 123000,
    "notes": "Build timer UI",
    "project_id": 42,
    "project_name": "Northstar Labs / Platform redesign",
    "running": true,
    "started_at": "2026-04-28T15:30:00.000Z",
    "task_id": "time",
    "task_name": "Development"
  },
  "current_timers": [
    {
      "id": "current",
      "billable": true,
      "elapsed_ms": 123000,
      "notes": "Build timer UI",
      "project_id": 42,
      "project_name": "Northstar Labs / Platform redesign",
      "running": true,
      "started_at": "2026-04-28T15:30:00.000Z",
      "task_id": "time",
      "task_name": "Development"
    },
    {
      "id": "timer-queued",
      "billable": false,
      "elapsed_ms": 1800000,
      "notes": "Queued review",
      "project_id": 42,
      "project_name": "Northstar Labs / Platform redesign",
      "running": false,
      "started_at": null,
      "task_id": "time",
      "task_name": "Development"
    }
  ]
}
```

`GET` response:

```json
{
  "current_timer": {
    "billable": true,
    "elapsed_ms": 123000,
    "notes": "Build timer UI",
    "project_id": 42,
    "project_name": "Northstar Labs / Platform redesign",
    "running": true,
    "started_at": "2026-04-28T15:30:00.000Z",
    "task_id": "time",
    "task_name": "Development"
  },
  "current_timers": []
}
```

## Conflict Rule

- Push when the desktop timer starts, pauses, resets, or changes context.
- Pull on login, workspace switch, or explicit refresh.
- If both sides changed while offline, keep the active running timer and preserve the other timer in the paused timer stack.

The desktop app exposes the bridge, local-first fallback, native tray controls, and a paused timer stack. Miru web owns the `desktop/current_timer` endpoint so active and paused timers can move between the web app and the macOS tracker.
