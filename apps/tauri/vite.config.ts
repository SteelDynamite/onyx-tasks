/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,svelte}"],
    // Resolve Svelte's client (browser) entry under Vitest — without the
    // browser condition mount() picks up Svelte's SSR export and throws
    // lifecycle_function_unavailable.
    server: { deps: { inline: ["@testing-library/svelte"] } },
  },
  // Vite 6: resolve.conditions REPLACES the default client conditions
  // (module/browser/development|production) instead of extending them.
  // An empty [] outside Vitest stripped the browser condition, so the dep
  // optimizer resolved svelte to its server entry and mount() threw
  // lifecycle_function_unavailable — a blank window. Only override
  // resolution under Vitest; leave Vite's defaults intact otherwise.
  ...(process.env.VITEST ? { resolve: { conditions: ["browser"] } } : {}),
});
