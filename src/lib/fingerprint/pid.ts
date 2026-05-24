import type { FingerprintConfig, FingerprintDeviceInfo, ParsedPidCaptureResponse } from "./types";

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function readTagAttributes(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}\\b([^>]*)\\/?>`, "i"));
  if (!match?.[1]) {
    return {};
  }

  const attributes: Record<string, string> = {};
  const attrPattern = /([A-Za-z0-9:_-]+)="([^"]*)"/g;

  for (const attrMatch of match[1].matchAll(attrPattern)) {
    attributes[attrMatch[1]] = attrMatch[2];
  }

  return attributes;
}

function readNamedParams(xml: string) {
  const params: Record<string, string> = {};
  const paramPattern = /<Param\b[^>]*\bname="([^"]*)"[^>]*\bvalue="([^"]*)"[^>]*\/?>/gi;

  for (const paramMatch of xml.matchAll(paramPattern)) {
    params[paramMatch[1]] = paramMatch[2];
  }

  return params;
}

function mapFingerprintType(fingerType: FingerprintConfig["fingerType"]) {
  switch (fingerType) {
    case "FMR":
      return "0";
    case "FIR":
      return "1";
    case "BOTH":
      return "2";
  }
}

function mapFingerprintDataFormat(dataType: FingerprintConfig["dataType"]) {
  return dataType === "X" ? "0" : "1";
}

export function buildPidOptionsXml(config: FingerprintConfig) {
  const options: Record<string, string> = {
    fCount: String(config.fingerCount),
    fType: mapFingerprintType(config.fingerType),
    iCount: "0",
    pCount: "0",
    format: mapFingerprintDataFormat(config.dataType),
    pidVer: config.pidVersion,
    timeout: String(config.captureTimeoutMs),
    posh: "UNKNOWN",
    env: config.env,
  };

  if (config.otp) {
    options.otp = config.otp;
  }

  if (config.wadh) {
    options.wadh = config.wadh;
  }

  const optionAttributes = Object.entries(options)
    .map(([key, value]) => `${key}="${escapeXmlAttribute(value)}"`)
    .join(" ");

  const customOpts = config.clientKey
    ? `<CustOpts><Param name="ClientKey" value="${escapeXmlAttribute(config.clientKey)}" /></CustOpts>`
    : "";

  return `<PidOptions ver="1.0"><Opts ${optionAttributes} />${customOpts}</PidOptions>`;
}

export function parsePidCaptureResponse(pidXml: string): ParsedPidCaptureResponse {
  const respAttributes = readTagAttributes(pidXml, "Resp");
  const deviceAttributes = readTagAttributes(pidXml, "DeviceInfo");
  const deviceParams = readNamedParams(pidXml);

  const errCode = respAttributes.errCode ?? "999";
  const errInfo = respAttributes.errInfo ?? "Unknown RD capture response";
  const qScore = respAttributes.qScore;

  let deviceInfo: FingerprintDeviceInfo | undefined;
  if (Object.keys(deviceAttributes).length > 0 || Object.keys(deviceParams).length > 0) {
    deviceInfo = {
      deviceProvider: deviceAttributes.dpId,
      model: deviceAttributes.mi ?? deviceParams.device_type,
      serialNumber: deviceAttributes.srno ?? deviceParams.srno,
      deviceCode: deviceAttributes.dc,
      serviceId: deviceAttributes.rdsId,
      serviceVersion: deviceAttributes.rdsVer,
    };
  }

  return {
    ok: errCode === "0",
    errCode,
    errInfo,
    qScore,
    pidXml,
    deviceInfo,
  };
}

export function isPidDeviceNotReady(parsed: ParsedPidCaptureResponse) {
  return !parsed.ok && /device\s+not\s+ready/i.test(parsed.errInfo);
}

export function parseLegacyPreviewResponse(payload: Record<string, unknown>) {
  const nestedPayload =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data as Record<string, unknown>
      : payload;

  const base64Bmp = typeof nestedPayload.Base64BMP === "string" ? nestedPayload.Base64BMP.trim() : "";
  if (base64Bmp) {
    return `data:image/bmp;base64,${base64Bmp}`;
  }

  const bitmapData = typeof nestedPayload.BitmapData === "string" ? nestedPayload.BitmapData.trim() : "";
  if (bitmapData) {
    return `data:image/png;base64,${bitmapData}`;
  }

  const base64Bitmap = typeof nestedPayload.Base64Bitmap === "string" ? nestedPayload.Base64Bitmap.trim() : "";
  if (base64Bitmap) {
    return `data:image/png;base64,${base64Bitmap}`;
  }

  return null;
}
