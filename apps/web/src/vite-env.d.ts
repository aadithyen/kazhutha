/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SIGNALING_URL: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_ANALYTICS_URL?: string;
  readonly VITE_ANALYTICS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
