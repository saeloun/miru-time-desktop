import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

const apps = [
  {
    arch: "arm64",
    path: "out/Miru Time Tracking-darwin-arm64/Miru Time Tracking.app",
    zip: `out/make/zip/darwin/arm64/Miru.Time.Tracking-darwin-arm64-${version}.zip`,
  },
  {
    arch: "x64",
    path: "out/Miru Time Tracking-darwin-x64/Miru Time Tracking.app",
    zip: `out/make/zip/darwin/x64/Miru.Time.Tracking-darwin-x64-${version}.zip`,
  },
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function verifyApp(path: string, label: string): void {
  if (!existsSync(path)) {
    fail(`Missing ${label}: ${path}`);
  }

  console.log(`Verifying ${label}`);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", path]);
  run("spctl", ["--assess", "--type", "execute", "--verbose=4", path]);
  run("xcrun", ["stapler", "validate", path]);
}

if (process.platform !== "darwin") {
  fail("macOS release signing verification must run on macOS.");
}

for (const app of apps) {
  verifyApp(app.path, `${basename(app.path)} (${app.arch})`);

  if (!existsSync(app.zip)) {
    fail(`Missing ${app.arch} ZIP: ${app.zip}`);
  }

  const extractDir = mkdtempSync(join(tmpdir(), `miru-mac-${app.arch}-`));

  try {
    run("ditto", ["-x", "-k", app.zip, extractDir]);
    verifyApp(
      join(extractDir, "Miru Time Tracking.app"),
      `${basename(app.zip)} contents`
    );
  } finally {
    rmSync(extractDir, { force: true, recursive: true });
  }
}

console.log(
  "macOS release app bundles and ZIP contents are signed, notarized, and stapled."
);
