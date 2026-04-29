# Release Checklist

## Repository

- Confirm the repository visibility and access list match the intended release audience.
- Confirm `LICENSE` is present and package metadata points to the GitHub repo and `https://app.miru.so`.
- Confirm `package.json` has the release version that will be tagged.

## Local Verification

```bash
npm run check
npm run test
npm run make
npm run test:e2e
```

## Manual Smoke Test

1. Open `out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app`.
2. Confirm the Miru icon appears in Finder and the Dock.
3. Confirm the menu bar timer appears and shows elapsed time.
4. Start, pause, reset, and resume a timer from the app.
5. Add, edit, resume, and delete a time entry.
6. Trigger idle recovery from the menu bar or the E2E-only IPC path.
7. Confirm signed-out production builds do not show a Miru URL field.
8. Confirm Miru sync points to `https://app.miru.so`.

## Miru Account Smoke Test

Use a temporary Electron `userData` directory when testing with a real Miru token. Do not commit or print tokens.

1. Create a temporary `miru-account.json` with a valid `authEmail`, `authToken`, and `baseUrl` set to `https://app.miru.so`.
2. Launch the packaged app with `MIRU_USER_DATA_DIR` pointing to that directory.
3. Confirm the account avatar/menu renders, workspace state loads, and timer sync actions do not crash.

## GitHub Release

The Forge GitHub publisher is configured for `vipulnsward/miru-time-desktop` as a draft release.

```bash
npm run publish
```

Use `npm run make` first when you only want local release artifacts. The macOS ZIP is generated at `out/make/zip/darwin/arm64/`.

Manual release fallback:

```bash
gh release create v0.1.1 out/make/zip/darwin/arm64/*.zip \
  --repo vipulnsward/miru-time-desktop \
  --title "Miru Time Tracking 0.1.1" \
  --notes-file /tmp/miru-time-desktop-release-notes.md
```
