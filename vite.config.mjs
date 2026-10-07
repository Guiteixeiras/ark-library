import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiMiddleware } from "./server/api.mjs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "ark-mangadex-api",
      configureServer(server) {
        server.middlewares.use(apiMiddleware);
      },
    },
  ],
  server: { port: 5173, strictPort: true },
});
