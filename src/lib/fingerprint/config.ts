import type { FingerprintConfig } from "./types";

export const FINGERPRINT_CONFIG_STORAGE_KEY = "noteryxpert:fingerprint-config";

const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
  deviceModel: "MANTRA_MFS110",
  transport: "auto",
  rdBaseUrl: "http://127.0.0.1:11100",
  rdSecureBaseUrl: "https://127.0.0.1:11100",
  rdInfoPath: "/rd/info",
  rdCapturePath: "/rd/capture",
  captureTimeoutMs: 15000,
  env: "P",
  fingerCount: 1,
  fingerType: "FMR",
  dataType: "X",
  pidVersion: "2.0",
  wadh: "",
  clientKey: "",
  otp: "",
  backendEndpoint: "/api/fingerprint/capture",
  enablePreviewImage: false,
  previewStrategy: "none",
  legacyPreviewHosts: ["127.0.0.1"],
  legacyPreviewPorts: [8004],
  legacyPreviewDevicePaths: ["mfs110"],
  requireBrowserBridge: true,
};

export function buildFingerprintConfig(overrides: Partial<FingerprintConfig> = {}): FingerprintConfig {
  return {
    ...DEFAULT_FINGERPRINT_CONFIG,
    ...overrides,
    legacyPreviewHosts: overrides.legacyPreviewHosts ?? DEFAULT_FINGERPRINT_CONFIG.legacyPreviewHosts,
    legacyPreviewPorts: overrides.legacyPreviewPorts ?? DEFAULT_FINGERPRINT_CONFIG.legacyPreviewPorts,
    legacyPreviewDevicePaths:
      overrides.legacyPreviewDevicePaths ?? DEFAULT_FINGERPRINT_CONFIG.legacyPreviewDevicePaths,
  };
}

export function getRdServiceCandidates(config: FingerprintConfig): string[] {
  const ports = [11100, 11101, 11102, 11103, 11104, 11105];
  const secure127 = ports.map((p) => `https://127.0.0.1:${p}`);
  const secureLocalhost = ports.map((p) => `https://localhost:${p}`);
  const insecure127 = ports.map((p) => `http://127.0.0.1:${p}`);
  const insecureLocalhost = ports.map((p) => `http://localhost:${p}`);

  const uniqueCandidates = (...candidates: string[]) => [...new Set(candidates.filter(Boolean))];
  const secure = uniqueCandidates(config.rdSecureBaseUrl, ...secure127, ...secureLocalhost);
  const insecure = uniqueCandidates(config.rdBaseUrl, ...insecure127, ...insecureLocalhost);

  if (config.transport === "https") {
    return secure;
  }

  if (config.transport === "http") {
    return insecure;
  }

  return [...secure, ...insecure];
}

export function getLegacyPreviewCandidates(config: FingerprintConfig): string[] {
  const protocols =
    config.transport === "https"
      ? ["https"]
      : config.transport === "http"
        ? ["http"]
        : ["https", "http"];

  const candidates: string[] = [];

  for (const protocol of protocols) {
    for (const port of config.legacyPreviewPorts) {
      for (const host of config.legacyPreviewHosts) {
        for (const devicePath of config.legacyPreviewDevicePaths) {
          candidates.push(`${protocol}://${host}:${port}/${devicePath}`);
        }
      }
    }
  }

  return candidates;
}

export function loadFingerprintConfig(): FingerprintConfig {
  if (typeof window === "undefined") {
    return buildFingerprintConfig();
  }

  const storedValue = window.localStorage.getItem(FINGERPRINT_CONFIG_STORAGE_KEY);
  if (!storedValue) {
    return buildFingerprintConfig();
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<FingerprintConfig>;
    return buildFingerprintConfig(parsed);
  } catch (error) {
    console.warn("Failed to parse saved fingerprint config. Falling back to defaults.", error);
    return buildFingerprintConfig();
  }
}

export function saveFingerprintConfig(config: FingerprintConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FINGERPRINT_CONFIG_STORAGE_KEY, JSON.stringify(config));
}
