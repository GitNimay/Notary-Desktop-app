/// <reference types="vite/client" />

interface Window {
  notaryDesktop?: {
    platform: NodeJS.Platform;
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
