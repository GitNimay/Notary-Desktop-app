import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFingerprintConfig,
  getLegacyPreviewCandidates,
  getRdServiceCandidates,
} from "./config";

const RD_PORTS = [11100, 11101, 11102, 11103, 11104, 11105];

function rdCandidates(protocol: "http" | "https") {
  return [
    ...RD_PORTS.map((port) => `${protocol}://127.0.0.1:${port}`),
    ...RD_PORTS.map((port) => `${protocol}://localhost:${port}`),
  ];
}

test("buildFingerprintConfig applies stable defaults for Mantra MFS110", () => {
  const config = buildFingerprintConfig();

  assert.equal(config.deviceModel, "MANTRA_MFS110");
  assert.equal(config.transport, "auto");
  assert.equal(config.rdBaseUrl, "http://127.0.0.1:11100");
  assert.equal(config.rdSecureBaseUrl, "https://127.0.0.1:11100");
  assert.equal(config.rdInfoPath, "/rd/info");
  assert.equal(config.rdCapturePath, "/rd/capture");
  assert.equal(config.captureTimeoutMs, 15000);
  assert.equal(config.env, "P");
  assert.equal(config.backendEndpoint, "/api/fingerprint/capture");
  assert.equal(config.enablePreviewImage, false);
  assert.equal(config.previewStrategy, "none");
  assert.deepEqual(config.legacyPreviewPorts, [8004]);
  assert.deepEqual(config.legacyPreviewDevicePaths, ["mfs110"]);
  assert.deepEqual(config.legacyPreviewHosts, ["127.0.0.1"]);
});

test("buildFingerprintConfig preserves overrides without dropping defaults", () => {
  const config = buildFingerprintConfig({
    transport: "https",
    captureTimeoutMs: 30000,
    backendEndpoint: "/api/custom-fingerprint",
    enablePreviewImage: false,
  });

  assert.equal(config.transport, "https");
  assert.equal(config.captureTimeoutMs, 30000);
  assert.equal(config.backendEndpoint, "/api/custom-fingerprint");
  assert.equal(config.enablePreviewImage, false);
  assert.equal(config.rdCapturePath, "/rd/capture");
});

test("getRdServiceCandidates tries secure localhost first in auto mode", () => {
  const config = buildFingerprintConfig();

  assert.deepEqual(getRdServiceCandidates(config), [
    ...rdCandidates("https"),
    ...rdCandidates("http"),
  ]);
});

test("getRdServiceCandidates respects forced transport mode", () => {
  const secureOnly = buildFingerprintConfig({ transport: "https" });
  const httpOnly = buildFingerprintConfig({ transport: "http" });

  assert.deepEqual(getRdServiceCandidates(secureOnly), rdCandidates("https"));
  assert.deepEqual(getRdServiceCandidates(httpOnly), rdCandidates("http"));
});

test("getLegacyPreviewCandidates tries secure loopback endpoints first for hosted HTTPS apps", () => {
  const config = buildFingerprintConfig({
    legacyPreviewPorts: [8004],
    legacyPreviewDevicePaths: ["mfs110"],
  });

  assert.deepEqual(getLegacyPreviewCandidates(config), [
    "https://127.0.0.1:8004/mfs110",
    "http://127.0.0.1:8004/mfs110",
  ]);
});
