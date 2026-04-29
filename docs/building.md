# Build and Compile Guide

Miru Time Tracking is an Electron Forge app. CI builds with Node 24 and npm.

## Install

```bash
npm ci
```

Use `npm install` only when intentionally updating dependencies and `package-lock.json`.

## Run Locally

```bash
npm run start
```

The development build opens an Electron window and a macOS menu bar item.

## Production Miru URL

Production builds default to `https://app.miru.so`. The sign-in UI does not show the Miru URL field unless explicitly enabled.

Development overrides:

```bash
MIRU_API_BASE_URL=http://127.0.0.1:3000 npm run start
MIRU_SHOW_BASE_URL_FIELD=true npm run start
MIRU_ALLOW_BASE_URL_OVERRIDE=true npm run start
```

`MIRU_API_BASE_URL` changes the default host. `MIRU_SHOW_BASE_URL_FIELD` exposes the host field in the renderer. `MIRU_ALLOW_BASE_URL_OVERRIDE` lets the main process use a custom stored or submitted host.

## Compile

```bash
npm run check
npm run test
npm run package
```

`npm run package` creates the unpacked app:

```text
out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app
```

## Release Artifacts

```bash
npm run make
```

The macOS ZIP is created under:

```text
out/make/zip/darwin/arm64/
```

## E2E Verification

```bash
npm run make
npm run test:e2e
```

The Playwright Electron suite uses a temporary `userData` directory and leaves the real desktop session untouched.
