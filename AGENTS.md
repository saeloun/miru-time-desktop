# AGENTS.md

Scope: entire repository.

This is the source of truth for AI assistant behavior in `saeloun/miru-time-desktop`.

## Core Rules

1. Never fake results. Do not claim a fix, test pass, release, or download check unless you verified it.
2. Use Bun through mise for this repo: `rtk mise exec -- bun ...`.
3. Keep `bun.lock` as the package lockfile. Do not reintroduce `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.
4. Use `apply_patch` for manual source and doc edits.
5. Preserve unrelated user work in a dirty tree.
6. Keep the app employee-focused: no admin, billing, invoice, rate, dashboard, or competitor-copy surfaces.
7. Do not mention competitor products in app copy, docs, release notes, or marketing copy.

## Expert Lens

Apply Sward/gbrain defaults silently on non-trivial work:

- Favor small, shippable changes over speculative rewrites.
- Treat desktop app APIs, IPC contracts, release links, and storage keys as promises.
- Keep the local-first timer path working without network access.
- Prefer simple, explicit Electron patterns over clever abstractions.
- Review UI changes with a product/design pass: contrast, spacing, stable tray width, state clarity, keyboard and screen-reader labels.

Useful gbrain commands when a decision needs a second lens:

```bash
rtk mise exec -- bun run ~/.gbrain/src/cli.ts query "<question>" --synth true
rtk mise exec -- bun run ~/.gbrain/src/cli.ts mentor dhh "<question>"
rtk mise exec -- bun run ~/.gbrain/src/cli.ts mentor fxn "<question>"
rtk mise exec -- bun run ~/.gbrain/src/cli.ts mentor tenderlove "<question>"
```

## Local Commands

Use these forms:

```bash
rtk mise exec -- bun install
rtk mise exec -- bun run check
rtk mise exec -- bun run test
rtk mise exec -- bun run test:e2e
rtk mise exec -- bun run package
rtk mise exec -- bun run make:mac
rtk mise exec -- bun run make:linux
rtk mise exec -- bun run make:windows
```

## Verification

For code changes, run at least:

```bash
rtk mise exec -- bun run check
rtk mise exec -- bun run test
```

For Electron, timer, tray, storage, auth, release, or dependency changes, also run:

```bash
rtk mise exec -- bun run package
rtk mise exec -- bun run test:e2e
```

For a release, additionally build all ZIPs and verify GitHub download URLs resolve to `302 -> 200`:

```bash
rtk mise exec -- bun run make:mac
rtk mise exec -- bun run make:linux
rtk mise exec -- bun run make:windows
```

Install the macOS build locally when the user asks to test it:

```bash
ditto "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app" "/Applications/Miru Time Tracking.app"
open "/Applications/Miru Time Tracking.app"
```

## Production Smoke Account

- For production-connected smoke checks, use Miru production at `https://app.miru.so`.
- Use the `vipul@saeloun.com` account when an authenticated local session already exists.
- Do not store, print, or commit passwords, tokens, cookies, or session files.
- If the local session is missing or expired, ask the user to log in; never fake production auth.
- Prefer read-only checks for production. Only create, update, delete, start, stop, or sync real production timers when the user explicitly asks for that action.

## GitHub And Release

- Canonical repository: `saeloun/miru-time-desktop`.
- Push the current checked-out branch unless explicitly asked otherwise.
- Release assets must use URL-safe filenames:
  - `Miru.Time.Tracking-darwin-arm64-<version>.zip`
  - `Miru.Time.Tracking-linux-x64-<version>.zip`
  - `Miru.Time.Tracking-win32-x64-<version>.zip`
- After creating or editing a release, verify:
  - release page returns `200`
  - each asset redirects to a downloadable file
  - README links point to `github.com/saeloun/miru-time-desktop`

## Product Invariants

- First screen is login/signup when signed out.
- The timer remains visible and stable in the macOS menu bar.
- The popup is compact, native-feeling, and anchored below the tray icon.
- Saved entries remain visible locally and in the history view.
- Idle recovery offers remove-and-continue, remove-and-start-new, and ignore-and-continue.
- Locale comes from Miru user settings first, then stored/browser locale, then English fallback.
