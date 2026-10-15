// Zero-dependency loopback-only development server.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const root = resolve(process.cwd());
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405); res.end(); return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const path = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!path.startsWith(root + sep)) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    if (!(await stat(path)).isFile()) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}).listen(4175, "127.0.0.1", () => {
  process.stdout.write("Phi5 lab: http://127.0.0.1:4175\n");
});
