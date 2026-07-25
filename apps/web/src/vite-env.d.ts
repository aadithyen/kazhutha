/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIGNALING_URL: string;
  readonly VITE_ICE_SERVERS?: string;
  /** JSON array of vettu banner messages, e.g. `["VETTU!!","വെട്ട്!"]` */
  readonly VITE_VETTU_MESSAGES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
