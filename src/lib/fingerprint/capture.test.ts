import test from "node:test";
import assert from "node:assert/strict";

import { buildFingerprintConfig } from "./config";
import {
  buildLegacyPreviewRequestInits,
  buildPidCaptureRequestInits,
} from "./capture";

test("buildLegacyPreviewRequestInits tries no-content-type requests before JSON requests", () => {
  const config = buildFingerprintConfig({ captureTimeoutMs: 15000 });
  const variants = buildLegacyPreviewRequestInits(config);

  assert.equal(variants.length, 4);
  assert.equal(variants[0].method, "POST");
  assert.deepEqual(variants[0].headers, {
    Accept: "application/json, text/plain, */*",
  });
  assert.equal(typeof variants[0].body, "string");
  assert.equal((variants[1].headers as Record<string, string>)["Content-Type"], undefined);
  assert.equal((variants[2].headers as Record<string, string>)["Content-Type"], "application/json");
});

test("buildPidCaptureRequestInits tries RD CAPTURE requests before POST fallbacks", () => {
  const variants = buildPidCaptureRequestInits("<PidOptions />");

  assert.equal(variants[0].method, "CAPTURE");
  assert.equal((variants[0].headers as Record<string, string>)["Content-Type"], "text/xml; charset=utf-8");
  assert.equal(variants[0].body, "<PidOptions />");
  assert.equal(variants[1].method, "CAPTURE");
  assert.equal((variants[1].headers as Record<string, string>)["Content-Type"], undefined);
  assert.equal(variants[2].method, "POST");
  assert.equal((variants[2].headers as Record<string, string>)["Content-Type"], "text/plain");
  assert.equal(variants[3].method, "POST");
  assert.equal((variants[3].headers as Record<string, string>)["Content-Type"], "text/xml; charset=utf-8");
  assert.equal(variants[4].method, "POST");
});
