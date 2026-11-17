// Static server for the built frontend (dist/). Used by the hosting worker: it starts this
// process and expects it to answer on process.env.PORT. The frontend calls the backend API
// directly from the browser (VITE_LOCAL_API_URL, baked in at build time), so no proxying here.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".map": "application/json; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(body);
}

function serveFile(res, file, cacheControl) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": cacheControl,
    });
    fs.createReadStream(file).pipe(res);
  });
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return send(res, 400, "Bad request");
  }
  if (pathname === "/healthz") return send(res, 200, "ok");

  // Resolve inside dist/ only (blocks ../ traversal).
  const target = path.normalize(path.join(root, pathname));
  if (!target.startsWith(root)) return send(res, 403, "Forbidden");

  const immutable = pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
  fs.stat(target, (err, st) => {
    if (!err && st.isDirectory()) {
      const index = path.join(target, "index.html");
      if (fs.existsSync(index)) return serveFile(res, index, "no-cache") || send(res, 404, "Not found");
    }
    if (!err && st.isFile()) return serveFile(res, target, immutable) || send(res, 404, "Not found");
    // Missing asset files must be 404, not the HTML shell (a 200 HTML response breaks <script> loads).
    if (pathname.startsWith("/assets/") || path.extname(pathname)) return send(res, 404, "Not found");
    // Client-side routes (e.g. /learn/123) fall back to the SPA shell.
    const shell = path.join(root, "index.html");
    if (fs.existsSync(shell)) return serveFile(res, shell, "no-cache") || send(res, 404, "Not found");
    send(res, 404, "Not found");
  });
});

server.listen(port, host, () => {
  console.log(`frontend listening on ${host}:${port}, serving ${root}`);
});
