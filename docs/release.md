# Release Checklist

## Repository

- Confirm the repository visibility and access list match the intended release audience.
- Confirm `LICENSE` is present and package metadata points to the GitHub repo and `https://app.miru.so`.
- Confirm `package.json` has the release version that will be tagged.

## Local Verification

```bash
rtk mise exec -- bun run check
rtk mise exec -- bun run test
rtk mise exec -- bun run package
rtk mise exec -- bun run test:e2e
rtk mise exec -- bun run make:mac:release
rtk mise exec -- bun run make:linux
rtk mise exec -- bun run make:windows
rtk mise exec -- bun audit
```

## macOS Signing And Notarization

Public macOS release ZIPs must be built with `MIRU_MAC_RELEASE=true` so Electron Forge signs and notarizes the app before the ZIP is made. Do not use `xattr -cr` for release validation; it only removes local quarantine metadata.

Install a `Developer ID Application` certificate in the keychain that runs the build. Then configure one notarization method:

```bash
# Preferred for local release machines after running xcrun notarytool store-credentials.
export APPLE_NOTARIZE_KEYCHAIN_PROFILE=miru-time-desktop

# Or App Store Connect API key credentials.
export APPLE_API_KEY=/path/to/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=XXXXXXXXXX
export APPLE_API_ISSUER=00000000-0000-0000-0000-000000000000

# Or Apple ID credentials with an app-specific password.
export APPLE_ID=release@example.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=XXXXXXXXXX
```

If multiple `Developer ID Application` certificates are available, pin the one to use:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Saeloun Inc (XXXXXXXXXX)"
```

Build signed and notarized macOS release ZIPs:

```bash
rtk mise exec -- bun run make:mac:release
```

Verify each packaged app before publishing:

```bash
codesign --verify --deep --strict --verbose=2 "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app"
spctl --assess --type execute --verbose=4 "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app"
xcrun stapler validate "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app"

codesign --verify --deep --strict --verbose=2 "out/Miru Time Tracking-darwin-x64/Miru Time Tracking.app"
spctl --assess --type execute --verbose=4 "out/Miru Time Tracking-darwin-x64/Miru Time Tracking.app"
xcrun stapler validate "out/Miru Time Tracking-darwin-x64/Miru Time Tracking.app"
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

The Forge GitHub publisher is configured for `saeloun/miru-time-desktop` as a draft release.

Keep release copy in `CHANGELOG.md` and `docs/releases/<version>.md`. Use the versioned release notes file for GitHub Releases so the website, release page, and docs stay in sync.

```bash
rtk mise exec -- bun run publish
```

The `publish` script also enables `MIRU_MAC_RELEASE=true`, so it requires the same signing and notarization setup as `make:mac:release`.

Use `bun run make:mac:release`, `bun run make:linux`, and `bun run make:windows` first when you only want local release artifacts. `make:mac:release` builds signed and notarized Apple Silicon and Intel ZIPs. The portable ZIPs are generated under `out/make/zip/`.

Manual release fallback:

```bash
gh release create v0.1.7 \
  out/make/zip/darwin/arm64/*0.1.7.zip \
  out/make/zip/darwin/x64/*0.1.7.zip \
  out/make/zip/linux/x64/*0.1.7.zip \
  out/make/zip/win32/x64/*0.1.7.zip \
  --repo saeloun/miru-time-desktop \
  --title "Miru Time Tracking 0.1.7" \
  --notes-file docs/releases/0.1.7.md
```
