import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { apiMiddleware } from "./api.mjs";
import { createAccessGuard } from "./access.mjs";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
await readFile(resolve(dist, "index.html"));
const allowAccess = createAccessGuard();

createServer((req, res) => {
  if (!allowAccess(req, res)) return;
  apiMiddleware(req, res, async () => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      return res.end();
    }
    try {
      const path = decodeURIComponent(
        new URL(req.url || "/", "http://localhost").pathname,
      );
      let file = resolve(dist, `.${path}`);
      if (file !== resolve(dist) && !file.startsWith(resolve(dist) + sep)) {
        res.writeHead(403);
        return res.end();
      }
      if (!extname(file)) file = resolve(dist, "index.html");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end("Página não encontrada.");
    }
  });
}).listen(Number(process.env.PORT || 5173), "0.0.0.0", () =>
  console.log(`ARK Library iniciada na porta ${process.env.PORT || 5173}.`),
);
