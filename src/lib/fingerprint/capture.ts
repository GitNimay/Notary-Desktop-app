import {
  buildPidOptionsXml,
  isPidDeviceNotReady,
  parseLegacyPreviewResponse,
  parsePidCaptureResponse,
} from "./pid";
import { getLegacyPreviewCandidates, getRdServiceCandidates } from "./config";
import type { FingerprintConfig, FingerprintDeviceInfo, ParsedPidCaptureResponse } from "./types";

export type FingerprintCaptureStage =
  | "idle"
  | "checking-device"
  | "waiting-for-finger"
  | "submitting"
  | "warning"
  | "success"
  | "error";

export interface FingerprintCaptureStatus {
  stage: FingerprintCaptureStage;
  message: string;
  details?: string;
}

export interface FingerprintCaptureResult {
  pidXml: string | null;
  parsedPid: ParsedPidCaptureResponse | null;
  thumbImageDataUrl: string | null;
  deviceInfo?: FingerprintDeviceInfo;
  serviceUrl: string;
  backendAccepted: boolean;
  backendMessage?: string;
  thumbImageWarning?: string;
}

interface DiscoverRdServiceResult {
  baseUrl: string;
  infoText: string;
}

interface CaptureFingerprintArgs {
  config: FingerprintConfig;
  personId: string;
  documentId?: string | null;
  onStatus?: (status: FingerprintCaptureStatus) => void;
}

interface TextResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}

function emitStatus(
  onStatus: CaptureFingerprintArgs["onStatus"],
  stage: FingerprintCaptureStage,
  message: string,
  details?: string,
) {
  onStatus?.({ stage, message, details });
}

function isLoopbackRdUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return (
      (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost") &&
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:")
    );
  } catch {
    return false;
  }
}

function readRdServiceStatus(infoText: string) {
  return infoText.match(/<RDService\b[^>]*\bstatus="([^"]*)"/i)?.[1];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<TextResponse> {
  if (isLoopbackRdUrl(url) && window.notaryDesktop?.requestRdService) {
    const response = await window.notaryDesktop.requestRdService({
      url,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string> | undefined,
      body: typeof init.body === "string" ? init.body : undefined,
      timeoutMs,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: async () => response.text,
      json: async () => JSON.parse(response.text),
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function buildDeviceErrorMessage(error: unknown, attemptedUrl: string, config: FingerprintConfig) {
  const fallback = `Unable to reach the Mantra RD service at ${attemptedUrl}.`;

  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message || fallback;
  const looksLikeHttpsMixedContent =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    attemptedUrl.startsWith("http://");

  if (looksLikeHttpsMixedContent) {
    return `${fallback} This app is running on HTTPS, so enable the official Mantra browser bridge/extension or switch the RD URL to secure localhost on this PC.`;
  }

  if (message.toLowerCase().includes("failed to fetch") && config.requireBrowserBridge) {
    return `${fallback} If the device is installed, confirm the Mantra RD background service is running and the browser bridge/extension is enabled.`;
  }

  return `${fallback} ${message}`;
}

export function buildPidCaptureRequestInits(pidOptionsXml: string): RequestInit[] {
  const acceptHeader = "application/xml, text/xml, text/plain, */*";

  return [
    {
      method: "CAPTURE",
      headers: {
        Accept: acceptHeader,
        "Content-Type": "text/xml; charset=utf-8",
      },
      body: pidOptionsXml,
    },
    {
      method: "CAPTURE",
      headers: {
        Accept: acceptHeader,
      },
      body: pidOptionsXml,
    },
    {
      method: "POST",
      headers: {
        Accept: acceptHeader,
        "Content-Type": "text/plain",
      },
      body: pidOptionsXml,
    },
    {
      method: "POST",
      headers: {
        Accept: acceptHeader,
        "Content-Type": "text/xml; charset=utf-8",
      },
      body: pidOptionsXml,
    },
    {
      method: "POST",
      headers: {
        Accept: acceptHeader,
      },
      body: pidOptionsXml,
    },
  ];
}

export function buildLegacyPreviewRequestInits(config: FingerprintConfig): RequestInit[] {
  const previewRequest = {
    Quality: 60,
    TimeOut: Math.max(10, Math.ceil(config.captureTimeoutMs / 1000)),
  };
  const previewPayloads = [
    JSON.stringify(previewRequest),
    JSON.stringify({ data: JSON.stringify(previewRequest) }),
  ];
  const acceptHeader = "application/json, text/plain, */*";

  return [
    ...previewPayloads.map((body) => ({
      method: "POST",
      headers: {
        Accept: acceptHeader,
      },
      body,
    })),
    ...previewPayloads.map((body) => ({
      method: "POST",
      headers: {
        Accept: acceptHeader,
        "Content-Type": "application/json",
      },
      body,
    })),
  ];
}

async function tryRdService(url: string) {
  const response = await fetchWithTimeout(
    url,
    {
      method: "RDSERVICE",
      headers: {
        Accept: "application/xml, text/xml, text/plain, */*",
      },
    },
    3000,
  );

  if (!response.ok) {
    throw new Error(`RD service request failed with status ${response.status}.`);
  }

  return await response.text();
}

async function tryDeviceInfo(url: string, config: FingerprintConfig) {
  const infoUrls = [`${url}${config.rdInfoPath}`, url];
  const methods = ["DEVICEINFO", "GET"];

  let lastError: unknown;

  for (const infoUrl of infoUrls) {
    for (const method of methods) {
      try {
        const response = await fetchWithTimeout(
          infoUrl,
          {
            method,
            headers: {
              Accept: "application/xml, text/xml, text/plain, */*",
            },
          },
          3000,
        );

        if (!response.ok) {
          lastError = new Error(`Device info request failed with status ${response.status}.`);
          continue;
        }

        return await response.text();
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error(`Unable to inspect RD service at ${url}.`);
}

export async function discoverRdService(config: FingerprintConfig): Promise<DiscoverRdServiceResult> {
  const candidates = getRdServiceCandidates(config);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const serviceText = await tryRdService(candidate);
      const infoText = await tryDeviceInfo(candidate, config);

      // Verify that the capture endpoint does not immediately fail due to CORS.
      // Some Mantra RD service builds return a mismatched Access-Control-Allow-Origin value,
      // which causes a CORS preflight failure for the actual capture request later.
      try {
        await fetchWithTimeout(
          `${candidate}${config.rdCapturePath}`,
          { method: "OPTIONS" },
          1500,
        );
      } catch (optionsError) {
        throw new Error(
          `Device found on ${candidate} but CORS policy blocked capture. Trying next port...`,
        );
      }

      return {
        baseUrl: candidate,
        infoText: `${serviceText}\n${infoText}`,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const lastAttempt = candidates[candidates.length - 1] ?? config.rdBaseUrl;
  throw new Error(buildDeviceErrorMessage(lastError, lastAttempt, config));
}

async function capturePidData(baseUrl: string, config: FingerprintConfig) {
  const captureUrl = `${baseUrl}${config.rdCapturePath}`;
  const pidOptionsXml = buildPidOptionsXml(config);
  let lastError: unknown;

  for (const requestInit of buildPidCaptureRequestInits(pidOptionsXml)) {
    try {
      const response = await fetchWithTimeout(
        captureUrl,
        requestInit,
        config.captureTimeoutMs + 5000,
      );

      if (!response.ok) {
        lastError = new Error(`Capture request failed with status ${response.status}.`);
        continue;
      }

      const responseText = await response.text();
      return parsePidCaptureResponse(responseText);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to capture PID data from ${captureUrl}.`);
}

async function bmpToPrintableDataUrl(bmpDataUrl: string) {
  return await new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDimension = 220;
      let width = image.width;
      let height = image.height;

      if (width > height && width > maxDimension) {
        height *= maxDimension / width;
        width = maxDimension;
      } else if (height >= width && height > maxDimension) {
        width *= maxDimension / height;
        height = maxDimension;
      }

      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas context unavailable for fingerprint preview."));
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };

    image.onerror = () => reject(new Error("Unable to convert the scanner preview image."));
    image.src = bmpDataUrl;
  });
}

async function captureLegacyPreview(config: FingerprintConfig) {
  if (!config.enablePreviewImage || config.previewStrategy !== "legacyMantra") {
    return null;
  }

  for (const baseUrl of getLegacyPreviewCandidates(config)) {
    try {
      const infoResponse = await fetchWithTimeout(
        `${baseUrl}/info`,
        {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
          },
        },
        500,
      );

      if (!infoResponse.ok) {
        continue;
      }
    } catch {
      continue;
    }

    for (const requestInit of buildLegacyPreviewRequestInits(config)) {
      try {
        const captureResponse = await fetchWithTimeout(
          `${baseUrl}/capture`,
          requestInit,
          config.captureTimeoutMs + 2000,
        );

        if (!captureResponse.ok) {
          continue;
        }

        const previewPayload = (await captureResponse.json()) as Record<string, unknown>;
        const bmpDataUrl = parseLegacyPreviewResponse(previewPayload);
        if (!bmpDataUrl) {
          continue;
        }

        return await bmpToPrintableDataUrl(bmpDataUrl);
      } catch {
        // Continue through the candidate list until one preview endpoint responds.
      }
    }
  }

  return null;
}

async function submitPidToBackend(
  config: FingerprintConfig,
  payload: {
    personId: string;
    documentId?: string | null;
    pidXml: string;
    serviceUrl: string;
    deviceInfo?: FingerprintDeviceInfo;
  },
) {
  try {
    const response = await fetch(config.backendEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        capturedAt: new Date().toISOString(),
        deviceModel: config.deviceModel,
      }),
    });

    const responseJson = (await response.json().catch(() => null)) as
      | { message?: string; ok?: boolean }
      | null;

    if (!response.ok) {
      return {
        accepted: false,
        message: responseJson?.message ?? "Backend handoff failed.",
      };
    }

    return {
      accepted: true,
      message: responseJson?.message ?? "PID XML submitted to backend.",
    };
  } catch (error) {
    return {
      accepted: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Backend handoff failed before the request completed.",
    };
  }
}

export async function testFingerprintConnection(
  config: FingerprintConfig,
  onStatus?: (status: FingerprintCaptureStatus) => void,
) {
  emitStatus(onStatus, "checking-device", "Checking fingerprint device connection...");
  const discovered = await discoverRdService(config);
  const serviceStatus = readRdServiceStatus(discovered.infoText);
  const statusDetails = serviceStatus
    ? `${discovered.baseUrl} | RD status: ${serviceStatus}`
    : discovered.baseUrl;
  emitStatus(onStatus, "success", "Fingerprint RD service connection verified.", statusDetails);
  return discovered;
}

export async function captureFingerprintFromScanner({
  config,
  personId,
  documentId,
  onStatus,
}: CaptureFingerprintArgs): Promise<FingerprintCaptureResult> {
  emitStatus(onStatus, "checking-device", "Checking fingerprint device connection...");
  const discovered = await discoverRdService(config);

  emitStatus(
    onStatus,
    "waiting-for-finger",
    "Device found. Place the finger on the scanner and wait for capture.",
    readRdServiceStatus(discovered.infoText)
      ? `${discovered.baseUrl} | RD status: ${readRdServiceStatus(discovered.infoText)}`
      : discovered.baseUrl,
  );

  let thumbImageDataUrl: string | null = null;
  let parsedPid: ParsedPidCaptureResponse | null = null;
  let pidWarning: string | undefined;
  let thumbImageWarning: string | undefined;

  try {
    parsedPid = await capturePidData(discovered.baseUrl, config);
    if (!parsedPid.ok) {
      if (thumbImageDataUrl && isPidDeviceNotReady(parsedPid)) {
        pidWarning = parsedPid.errInfo;
      } else {
        throw new Error(parsedPid.errInfo || "Fingerprint capture failed.");
      }
    }
  } catch (error) {
    if (!thumbImageDataUrl) {
      throw error;
    }

    pidWarning = error instanceof Error && error.message ? error.message : "PID capture was not completed.";
  }

  if (parsedPid?.ok && config.enablePreviewImage) {
    emitStatus(onStatus, "submitting", "Fingerprint PID captured. Requesting original thumb image...");
    thumbImageDataUrl = await captureLegacyPreview(config);
  }

  if (parsedPid?.ok && !thumbImageDataUrl) {
    thumbImageWarning = config.enablePreviewImage
      ? "RD PID captured, but no licensed Mantra MFS110 public/enrollment SDK image service returned a printable thumb image. No printable thumb image was added. Use Upload Thumb for this person, or install the MFS110 Windows Public SDK/Web SDK from Mantra if they provide one for your use case."
      : "RD PID captured. MFS110 L1 RD service does not expose a printable raw thumb image, so no thumb image was added. Use Upload Thumb for this person, or enable image capture only after installing a licensed MFS110 public/enrollment SDK from Mantra.";
    emitStatus(
      onStatus,
      "warning",
      "Fingerprint PID captured. Printable thumb image unavailable.",
      thumbImageWarning,
    );
  }

  if (!parsedPid?.ok && !thumbImageDataUrl) {
    throw new Error(pidWarning || "Fingerprint capture failed. Keep the finger steady on the scanner and try again.");
  }

  emitStatus(
    onStatus,
    "submitting",
    thumbImageDataUrl
      ? "Fingerprint image captured. Finishing document update..."
      : "Fingerprint PID captured. Finishing document update...",
  );
  const backendResult = parsedPid?.ok
    ? await submitPidToBackend(config, {
        personId,
        documentId,
        pidXml: parsedPid.pidXml,
        serviceUrl: discovered.baseUrl,
        deviceInfo: parsedPid.deviceInfo,
      })
    : {
        accepted: false,
        message: pidWarning
          ? `Printable thumb prepared. PID handoff skipped: ${pidWarning}`
          : "Printable thumb prepared. PID handoff skipped.",
      };
  const finalBackendMessage = [thumbImageWarning, backendResult.message].filter(Boolean).join(" ");

  emitStatus(
    onStatus,
    thumbImageDataUrl ? "success" : "warning",
    thumbImageDataUrl
      ? "Fingerprint captured and added to the document."
      : "Fingerprint PID captured. Printable thumb image unavailable.",
    finalBackendMessage,
  );

  return {
    pidXml: parsedPid?.pidXml ?? null,
    parsedPid,
    thumbImageDataUrl,
    deviceInfo: parsedPid?.deviceInfo,
    serviceUrl: discovered.baseUrl,
    backendAccepted: backendResult.accepted,
    backendMessage: finalBackendMessage,
    thumbImageWarning,
  };
}
