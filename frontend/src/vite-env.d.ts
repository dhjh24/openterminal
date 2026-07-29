/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKET_PROFILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
