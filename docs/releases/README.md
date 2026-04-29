# Release Notes

This directory keeps the source release notes for Miru Time Tracking desktop releases.

Use one file per public release:

```text
docs/releases/<version>.md
```

`CHANGELOG.md` is the concise chronological history. These release notes are the fuller user-facing copy used for GitHub Releases, download pages, and marketing handoffs.

Before publishing a release:

1. Update `CHANGELOG.md`.
2. Add or update the versioned release notes file.
3. Verify release download links point to `github.com/saeloun/miru-time-desktop`.
4. Use the versioned notes file with `gh release create --notes-file`.
