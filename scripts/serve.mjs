// Phi5 zero-dependency demo server. Loopback by default; --lan explicitly opts in.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createLanRelay } from "../src/lan-relay.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/demo/app.js", ["demo/app.js", "text/javascript; charset=utf-8"]],
  ["/demo/styles.css", ["demo/styles.css", "text/css; charset=utf-8"]],
  ["/src/phi5.js", ["src/phi5.js", "text/javascript; charset=utf-8"]]
]);

export async function createPhi5Server({ lan = false, port = 4175,
  host = lan ? "0.0.0.0" : "127.0.0.1", secret } = {}) {
  const relay = lan ? createLanRelay({ secret }) : null;
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Frame-Options", "DENY");
      if (pathname.startsWith("/api/phi5/")) {
        if (!relay) {
          if (pathname === "/api/phi5/info" && req.method === "GET") {
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            res.end(JSON.stringify({ enabled: false })); return;
          }
          res.writeHead(403); res.end("LAN room disabled"); return;
        }
        if (await relay.handle(req, res, pathname)) return;
        res.writeHead(404); res.end("Not found"); return;
      }
      const asset = STATIC.get(pathname);
      if (!asset) { res.writeHead(404); res.end("Not found"); return; }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405); res.end("Method not allowed"); return;
      }
      const [relPath, type] = asset;
      const data = await readFile(resolve(root, relPath));
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; form-action 'none'; frame-ancestors 'none'" });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      if (!res.writableEnded) res.end("Server error");
    }
  });
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => { server.off("error", reject); done(); });
  });
  return {
    server, lan, secret: relay?.secret,
    address: server.address(),
    async close() {
      relay?.close();
      await new Promise((done, reject) => server.close((err) => err ? reject(err) : done()));
    }
  };
}
const isCLI = process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCLI) {
  const lan = process.argv.includes("--lan");
  if (process.argv.slice(2).some((arg) => arg !== "--lan")) {
    process.stderr.write("Usage: node scripts/serve.mjs [--lan]\n");
    process.exitCode = 2;
  } else {
    createPhi5Server({ lan }).then((instance) => {
      const port = instance.address.port;
      process.stdout.write("Phi5 lab: http://127.0.0.1:" + port + "\n");
      if (lan) {
        process.stdout.write("\nLAN MODE ENABLED on TCP port " + port + ".\n");
        process.stdout.write("Room code (keep private): " + instance.secret + "\n");
        process.stdout.write("On another computer on this trusted LAN, open:\n");
        process.stdout.write("  http://<HOST-LAN-IP>:" + port + "\n");
        process.stdout.write("Both browsers must enter the room code.\n");
        process.stdout.write("Plain HTTP, no encryption: use ONLY non-sensitive demo messages.\n");
        process.stdout.write("Press Ctrl+C to shut down the LAN relay.\n\n");
      }
    }).catch((error) => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
  }
}
