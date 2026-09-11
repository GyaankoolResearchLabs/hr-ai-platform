import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/*
|--------------------------------------------------------------------------
| FRONTEND TEST CONFIG
|--------------------------------------------------------------------------
|
| Vitest + React Testing Library, jsdom environment. See
| client/test/README.md for what's covered and why. Separate from
| vite.config.js (the dev/build config) so the two never have to
| agree on unrelated settings.
|--------------------------------------------------------------------------
*/

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    globals: false,
  },
});
