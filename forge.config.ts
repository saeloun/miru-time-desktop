import { rename } from "node:fs/promises";
import path from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type {
  ForgeConfig,
  ForgeMakeResult,
} from "@electron-forge/shared-types";

type PackagerConfig = NonNullable<ForgeConfig["packagerConfig"]>;
type MacSigningPackagerConfig = Pick<PackagerConfig, "osxNotarize" | "osxSign">;
type MacSignOptions = Exclude<NonNullable<PackagerConfig["osxSign"]>, true> & {
  continueOnError?: boolean;
};

const isMacReleaseBuild = process.env.MIRU_MAC_RELEASE === "true";

function getMacNotarizeConfig(): MacSigningPackagerConfig["osxNotarize"] {
  const keychainProfile = process.env.APPLE_NOTARIZE_KEYCHAIN_PROFILE;
  const keychain = process.env.APPLE_NOTARIZE_KEYCHAIN;

  if (keychainProfile) {
    return {
      keychainProfile,
      ...(keychain ? { keychain } : {}),
    };
  }

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (appleApiKey && appleApiKeyId && appleApiIssuer) {
    return {
      appleApiKey,
      appleApiKeyId,
      appleApiIssuer,
    };
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword =
    process.env.APPLE_APP_SPECIFIC_PASSWORD ?? process.env.APPLE_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (appleId && appleIdPassword && teamId) {
    return {
      appleId,
      appleIdPassword,
      teamId,
    };
  }

  throw new Error(
    "MIRU_MAC_RELEASE=true requires notarization credentials: set APPLE_NOTARIZE_KEYCHAIN_PROFILE, or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER, or APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID."
  );
}

function getMacSigningConfig(): MacSigningPackagerConfig {
  const identity = process.env.APPLE_SIGNING_IDENTITY;
  const osxSign: MacSignOptions = {
    ...(identity ? { identity } : {}),
    continueOnError: false,
  };

  return {
    osxSign,
    osxNotarize: getMacNotarizeConfig(),
  };
}

function getUrlSafeArtifactPath(artifactPath: string): string {
  const artifactName = path.basename(artifactPath);
  const safeArtifactName = artifactName.replace(/\s+/g, ".");

  return path.join(path.dirname(artifactPath), safeArtifactName);
}

async function renameZipArtifacts(
  makeResults: ForgeMakeResult[]
): Promise<ForgeMakeResult[]> {
  for (const makeResult of makeResults) {
    makeResult.artifacts = await Promise.all(
      makeResult.artifacts.map(async (artifactPath) => {
        if (!artifactPath.endsWith(".zip")) {
          return artifactPath;
        }

        const safeArtifactPath = getUrlSafeArtifactPath(artifactPath);

        if (safeArtifactPath !== artifactPath) {
          await rename(artifactPath, safeArtifactPath);
        }

        return safeArtifactPath;
      })
    );
  }

  return makeResults;
}

const config: ForgeConfig = {
  hooks: {
    postMake: async (_forgeConfig, makeResults) =>
      renameZipArtifacts(makeResults),
  },
  packagerConfig: {
    asar: true,
    appBundleId: "com.saeloun.miru-time-tracking",
    icon: "assets/miru-time-icon",
    ...(isMacReleaseBuild ? getMacSigningConfig() : {}),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin", "linux", "win32"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    {
      /*
       * Publish release on GitHub as draft.
       * Remember to manually publish it on GitHub website after verifying everything is correct.
       */
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "saeloun",
          name: "miru-time-desktop",
        },
        draft: true,
        prerelease: false,
      },
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),

    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
