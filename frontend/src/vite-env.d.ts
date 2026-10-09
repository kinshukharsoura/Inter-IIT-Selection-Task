/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API base URL (e.g. https://api.example.com/api). Defaults to same-origin "/api". */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
