import type { FingerprintCaptureStatus } from "../lib/fingerprint/capture";
import type { FingerprintDeviceInfo } from "../lib/fingerprint/types";

interface FingerprintStatusPanelProps {
  status?: FingerprintCaptureStatus | null;
  deviceInfo?: FingerprintDeviceInfo;
  backendAccepted?: boolean;
  backendMessage?: string;
}

function getStatusClasses(stage: FingerprintCaptureStatus["stage"]) {
  switch (stage) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "error":
      return "border-red-200 bg-red-50 text-red-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "submitting":
      return "border-sky-200 bg-sky-50 text-sky-900";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

export function FingerprintStatusPanel({
  status,
  deviceInfo,
  backendAccepted,
  backendMessage,
}: FingerprintStatusPanelProps) {
  if (!status) {
    return null;
  }

  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${getStatusClasses(status.stage)}`}>
      <p className="font-semibold">{status.message}</p>
      {status.details ? <p className="mt-1 break-words opacity-80">{status.details}</p> : null}
      {deviceInfo?.serialNumber ? (
        <p className="mt-1 opacity-80">
          Device: {deviceInfo.model || "Scanner"} | Serial: {deviceInfo.serialNumber}
        </p>
      ) : null}
      {typeof backendAccepted === "boolean" ? (
        <p className="mt-1 opacity-80">
          Backend: {backendAccepted ? "Accepted" : "Not confirmed"}
          {backendMessage ? ` | ${backendMessage}` : ""}
        </p>
      ) : null}
    </div>
  );
}
