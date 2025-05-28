/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_TOMTOM_KEY: string
    readonly VITE_OPENWEATHER_KEY: string
    readonly VITE_HUGGINGFACE_KEY: string
    readonly VITE_NEWSAPI_KEY: string
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
  