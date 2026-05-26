/// <reference types="vite/client" />

interface Window {
  notaryDesktop?: {
    platform: NodeJS.Platform;
    getDownloadedUpdate?: () => Promise<{
      version?: string;
      releaseDate?: string;
    } | null>;
    restartAndInstallUpdate?: () => Promise<{
      ok: boolean;
      message?: string;
    }>;
    onUpdateDownloaded?: (callback: (updateInfo: {
      version?: string;
      releaseDate?: string;
    }) => void) => () => void;
    requestRdService?: (request: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeoutMs?: number;
    }) => Promise<{
      ok: boolean;
      status: number;
      statusText?: string;
      headers?: Record<string, string | string[] | undefined>;
      text: string;
    }>;
  };
}
