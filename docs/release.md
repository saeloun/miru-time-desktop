# Release Checklist

## Local Verification

```bash
npm run test
npm run test:e2e
npm run make
```

## Manual Smoke Test

1. Open `out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app`.
2. Confirm the Miru icon appears in Finder and the Dock.
3. Confirm the menu bar timer appears and shows elapsed time.
4. Start, pause, reset, and resume a timer from the app.
5. Add, edit, resume, and delete a time entry.
6. Trigger idle recovery from the menu bar or the E2E-only IPC path.

## GitHub Release

The Forge GitHub publisher is configured for `vipulnsward/miru-time-desktop` as a draft release.

```bash
npm run publish
```

Use `npm run make` first when you only want local release artifacts. The macOS ZIP is generated at `out/make/zip/darwin/arm64/`.
