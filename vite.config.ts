// The base Vite configuration already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const publicEnv = loadEnv("production", process.cwd(), "VITE_");

export default defineConfig({
  vite: {
    // Only public connection settings belong here; never inject server secrets.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        publicEnv["VITE_SUPABASE_URL"] || "https://huavidsvvlyrzmxxacsg.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        publicEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_7VOJtc_lwzk-pOeVl1yX0g_Fww4_kwz",
      ),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
