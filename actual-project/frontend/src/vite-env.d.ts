/// <reference types="vite/client" />

// Tells TypeScript what our environment variables are.
//
// Without this, import.meta.env.VITE_API_BASE_URL is typed `any`, and a typo
// in the name would compile happily and silently leave the app on mock data
// in production. Declaring it means the compiler checks the one setting that
// decides whether we talk to a real backend.
//
// Only VITE_ prefixed variables reach the browser - that is Vite's rule, and
// it is what stops a secret in .env from being bundled into the JavaScript we
// ship to users.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
