export const LOCAL_STORAGE_KEYS = {
  LANGUAGE: "lang",
  THEME: "theme",
};

export const IPC_CHANNELS = {
  START_ORPC_SERVER: "start-orpc-server",
};

export const ENVIRONMENT_VARIABLES = {
  MIRU_ALLOW_BASE_URL_OVERRIDE: process.env.MIRU_ALLOW_BASE_URL_OVERRIDE,
  MIRU_API_BASE_URL: process.env.MIRU_API_BASE_URL,
  MIRU_E2E: process.env.MIRU_E2E,
  MIRU_SHOW_BASE_URL_FIELD: process.env.MIRU_SHOW_BASE_URL_FIELD,
  NODE_ENV: process.env.NODE_ENV,
};

export const inDevelopment = ENVIRONMENT_VARIABLES.NODE_ENV === "development";

const TRAILING_SLASHES_PATTERN = /\/+$/;

export const normalizeMiruBaseUrlValue = (url: string) =>
  url.trim().replace(TRAILING_SLASHES_PATTERN, "");

export const DEFAULT_MIRU_BASE_URL = normalizeMiruBaseUrlValue(
  ENVIRONMENT_VARIABLES.MIRU_API_BASE_URL || "https://app.miru.so"
);

export const canOverrideMiruBaseUrl =
  inDevelopment ||
  ENVIRONMENT_VARIABLES.MIRU_E2E === "true" ||
  ENVIRONMENT_VARIABLES.MIRU_ALLOW_BASE_URL_OVERRIDE === "true";

export const showMiruBaseUrlField =
  inDevelopment || ENVIRONMENT_VARIABLES.MIRU_SHOW_BASE_URL_FIELD === "true";
