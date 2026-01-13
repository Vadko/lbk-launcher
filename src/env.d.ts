/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GH_TOKEN: string;
  readonly VITE_DEBUG_MODE: string;
  readonly VITE_MIXPANEL_TOKEN_DEV: string;
  readonly VITE_MIXPANEL_TOKEN_PROD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
