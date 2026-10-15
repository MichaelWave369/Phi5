// Phi5 LAN relay v0.2: an intentionally plaintext, opt-in local-network LAB.
// This relay is NOT an authenticated/encrypted device-control transport.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { validateManifest, VERSION } from "./phi5.js";

const DEVICE_ID = /^[A-Za-z0-9._:-]{3,80}$/;
const ROUTES = new Set(["/api/phi5/info", "/api/phi5/join",
  "/api/phi5/events", "/api/phi5/send", "/api/phi5/leave"]);
const COOKIE = "phi5_session";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function response(res, status, data) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(data));
}
function parseCookie(req) {
  const raw = req.headers.cookie ?? "";
  return raw.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
}
function equalSecret(a, b) {
  if (typeof a !== "string" || !/^[a-f0-9]{32}$/.test(a)) return false;
  const aa = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function readJson(req, maxLength) {
  return new Promise((resolve, reject) => {
    let body = "";
    let finished = false;
    function fail() {
      if (!finished) { finished = true; reject(new Error("Invalid or oversized JSON")); }
    }
    req.on("data", (part) => {
      if (finished) return; // Never keep buffering after the byte limit is exceeded.
      body += part.toString("utf8");
      if (Buffer.byteLength(body) > maxLength) fail();
    });
    req.on("end", () => {
      if (finished) return;
      finished = true;
      try { resolve(JSON.parse(body)); } catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", fail);
  });
}
export function createLanRelay({
  secret = randomBytes(16).toString("hex"),
  clock = () => Date.now()
} = {}) {
  if (!/^[a-f0-9]{32}$/.test(secret)) throw new Error("Expected 32-hex-digit room code");
  const sessions = new Map(); // token => private session state
  const attempts = new Map(); // remote IP => limited unsuccessful joins
  const EXPIRY_MS = 60 * 60 * 1000;
  const MAX_PEERS = 24;

  function lookup(req) {
    const token = parseCookie(req);
    const entry = token && sessions.get(token);
    if (!entry) return null;
    if (entry.expires <= clock()) { destroy(token, entry); return null; }
    return { token, entry };
  }
  function destroy(token, entry) {
    sessions.delete(token);
    if (entry.stream && !entry.stream.writableEnded) entry.stream.end();
    entry.stream = null;
  }
  function sameOrigin(req) {
    const origin = req.headers.origin;
    return !origin || origin === "http://" + req.headers.host ||
      origin === "https://" + req.headers.host;
  }
  function cleanup() {
    for (const [token, entry] of sessions) {
      if (entry.expires <= clock()) destroy(token, entry);
    }
  }
  function stream(res, frame) {
    if (!res.destroyed && !res.writableEnded) {
      res.write("data: " + JSON.stringify(frame) + "\n\n");
    }
  }
  function ensureProtocol(frame, ownId) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame) ||
      frame.protocol !== VERSION || frame.from !== ownId ||
      typeof frame.to !== "string" || !DEVICE_ID.test(frame.from) ||
      !["hello", "invite", "decision", "command", "ack"].includes(frame.type)) return false;
    if (frame.type === "hello") {
      if (frame.to !== "*") return false;
    } else if (!DEVICE_ID.test(frame.to) || frame.to === ownId) return false;
    if (frame.type === "hello" || frame.type === "invite") {
      try {
        const m = validateManifest(frame.manifest);
        if (m.id !== ownId) return false;
      } catch { return false; }
    }
    return true;
  }

  async function handle(req, res, pathname) {
    if (!ROUTES.has(pathname)) return false;
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (pathname === "/api/phi5/info" && req.method === "GET") {
      response(res, 200, { enabled: true, protocol: VERSION,
        warning: "Plain HTTP LAN demo. No transport encryption or peer authentication." });
      return true;
    }
    if (!sameOrigin(req)) {
      response(res, 403, { error: "Origin rejected" }); return true;
    }
    if (pathname === "/api/phi5/join" && req.method === "POST") {
      const ip = req.socket.remoteAddress ?? "unknown";
      const record = attempts.get(ip);
      if (record && record.until > clock() && record.count >= 8) {
        response(res, 429, { error: "Too many attempts" }); return true;
      }
      let input;
      try { input = await readJson(req, 1024); }
      catch { response(res, 400, { error: "Bad JSON" }); return true; }
      const correct = equalSecret(input?.code, secret);
      const deviceId = input?.deviceId;
      if (!correct || typeof deviceId !== "string" || !DEVICE_ID.test(deviceId)) {
        const recent = record && record.until > clock() ? record.count : 0;
        attempts.set(ip, { count: recent + 1, until: clock() + 60_000 });
        response(res, 403, { error: "Room code or device ID rejected" }); return true;
      }
      cleanup();
      if (sessions.size >= MAX_PEERS || [...sessions.values()].some((s) => s.deviceId === deviceId)) {
        response(res, 409, { error: "Room full or device already joined" }); return true;
      }
      attempts.delete(ip);
      const token = randomBytes(32).toString("hex");
      sessions.set(token, { deviceId, expires: clock() + EXPIRY_MS,
        stream: null, timestamps: [] });
      res.setHeader("Set-Cookie", COOKIE + "=" + token +
        "; HttpOnly; SameSite=Strict; Path=/api/phi5; Max-Age=3600");
      response(res, 200, { joined: true, expiresInSeconds: 3600 });
      return true;
    }
    const auth = lookup(req);
    if (!auth) { response(res, 401, { error: "Join this room first" }); return true; }
    const { token, entry } = auth;
    if (pathname === "/api/phi5/events" && req.method === "GET") {
      if (entry.stream) { response(res, 409, { error: "Already streaming" }); return true; }
      res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive",
        "X-Accel-Buffering": "no" });
      entry.stream = res;
      res.write(": Phi5 LAN stream ready\n\n");
      res.on("close", () => { if (entry.stream === res) entry.stream = null; });
      return true;
    }
    if (pathname === "/api/phi5/leave" && req.method === "POST") {
      destroy(token, entry);
      res.setHeader("Set-Cookie", COOKIE +
        "=; HttpOnly; SameSite=Strict; Path=/api/phi5; Max-Age=0");
      response(res, 200, { left: true }); return true;
    }
    if (pathname === "/api/phi5/send" && req.method === "POST") {
      const recent = entry.timestamps.filter((t) => clock() - t < 10_000);
      if (recent.length >= 50) { response(res, 429, { error: "Rate limited" }); return true; }
      let frame;
      try { frame = await readJson(req, 4096); }
      catch { response(res, 400, { error: "Bad JSON" }); return true; }
      if (Buffer.byteLength(JSON.stringify(frame)) > 2048 ||
        !ensureProtocol(frame, entry.deviceId)) {
        response(res, 400, { error: "Bad Phi5 frame" }); return true;
      }
      entry.timestamps = recent;
      entry.timestamps.push(clock());
      let delivered = 0;
      for (const [otherToken, other] of sessions) {
        if (otherToken === token || !other.stream || other.expires <= clock()) continue;
        if (frame.to !== "*" && other.deviceId !== frame.to) continue;
        stream(other.stream, frame);
        delivered += 1;
      }
      response(res, 202, { relayed: delivered });
      return true;
    }
    response(res, 405, { error: "Method not allowed" });
    return true;
  }
  function close() {
    for (const [token, entry] of sessions) destroy(token, entry);
    sessions.clear();
    attempts.clear();
  }
  return { secret, handle, close };
}
