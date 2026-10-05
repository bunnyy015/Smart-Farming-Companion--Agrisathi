import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const AGMARKNET_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

function createMandiProxy(apiKey) {
  return {
    target: "https://api.data.gov.in",
    changeOrigin: true,
    secure: true,
    rewrite: (requestPath) => {
      const url = new URL(requestPath, "http://vite.local");
      url.pathname = url.pathname.replace(
        /^\/api\/market-prices/,
        `/resource/${AGMARKNET_RESOURCE_ID}`
      );
      if (apiKey) url.searchParams.set("api-key", apiKey);
      return `${url.pathname}${url.search}`;
    },
  };
}

function marketApiKeyGuard(apiKey) {
  const rejectMissingKey = (server) => {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.startsWith("/api/market-prices")) return next();
      if (apiKey) return next();
      response.statusCode = 503;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ error: "MISSING_DATA_GOV_API_KEY" }));
    });
  };

  return {
    name: "agrisathi-market-api-key-check",
    configureServer: rejectMissingKey,
    configurePreviewServer: rejectMissingKey,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = String(env.VITE_DATA_GOV_API_KEY || "").trim();
  const mandiProxy = createMandiProxy(apiKey);

  return {
    plugins: [react(), tailwindcss(), marketApiKeyGuard(apiKey)],
    server: {
      host: true,
      allowedHosts: [".trycloudflare.com"],
      proxy: { "/api/market-prices": mandiProxy },
    },
    preview: {
      proxy: { "/api/market-prices": mandiProxy },
    },
  };
});
