# Build and Compile Guide

Miru Time Tracking is an Electron Forge app. CI builds with Node 24 and Bun through mise.

## Install

```bash
rtk mise exec -- bun install
```

Keep `bun.lock` as the package lockfile.

## Run Locally

```bash
rtk mise exec -- bun run start
```

The development build opens an Electron window and a macOS menu bar item.

## Production Miru URL

Production builds default to `https://app.miru.so`. The sign-in UI does not show the Miru URL field unless explicitly enabled.

Development overrides:

```bash
MIRU_API_BASE_URL=http://127.0.0.1:3000 rtk mise exec -- bun run start
MIRU_SHOW_BASE_URL_FIELD=true rtk mise exec -- bun run start
MIRU_ALLOW_BASE_URL_OVERRIDE=true rtk mise exec -- bun run start
```

`MIRU_API_BASE_URL` changes the default host. `MIRU_SHOW_BASE_URL_FIELD` exposes the host field in the renderer. `MIRU_ALLOW_BASE_URL_OVERRIDE` lets the main process use a custom stored or submitted host.

## Compile

```bash
rtk mise exec -- bun run check
rtk mise exec -- bun run test
rtk mise exec -- bun run package
```

`bun run package` creates the unpacked app:

```text
out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app
```

## Release Artifacts

```bash
rtk mise exec -- bun run make
```

The macOS ZIP is created under:

```text
out/make/zip/darwin/arm64/
```

Portable cross-platform ZIP builds:

```bash
rtk mise exec -- bun run make:mac:release
rtk mise exec -- bun run make:linux
rtk mise exec -- bun run make:windows
```

Those commands generate:

```text
out/make/zip/darwin/arm64/
out/make/zip/linux/x64/
out/make/zip/win32/x64/
```

Use `make:mac:release` for public macOS ZIPs. It requires a local `Developer ID Application` certificate and Apple notarization credentials, then signs and notarizes the app before ZIP packaging.

## E2E Verification

```bash
rtk mise exec -- bun run package
rtk mise exec -- bun run test:e2e
```

The Playwright Electron suite uses a temporary `userData` directory and leaves the real desktop session untouched.
