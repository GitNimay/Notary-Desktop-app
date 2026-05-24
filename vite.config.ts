import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const appEnv = loadEnv(mode, '.', '');
  const workspaceEnv = loadEnv(mode, '..', '');
  const env = {...workspaceEnv, ...appEnv};
  const useHttps = env.VITE_DEV_HTTPS === 'true';

  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }

  return {
    base: './',
    plugins: [react(), tailwindcss(), useHttps ? basicSsl() : null],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
