import test from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { createPhi5Server } from "../scripts/serve.mjs";
import { VERSION } from "../src/phi5.js";

const ROOM = "1234567890abcdef1234567890abcdef";
const manifest = (id) => ({
  protocol: VERSION, id, name: id,
  capabilities: [{ id: "display.message", direction: "both" }]
});
async function start(lan = true) {
  const app = await createPhi5Server({
    lan, port: 0, host: "127.0.0.1", secret: lan ? ROOM : undefined
  });
  return { app, url: "http://127.0.0.1:" + app.address.port };
}
async function post(url, route, body, cookie, origin) {
  return fetch(url + route, { method: "POST",
    headers: { "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body) });
}
async function join(url, deviceId, code = ROOM) {
  const res = await post(url, "/api/phi5/join", { code, deviceId });
  return { res, cookie: res.headers.get("set-cookie")?.split(";")[0] };
}
function listenFrames(url, cookie) {
  return new Promise((resolve, reject) => {
    const received = [];
    let partial = "";
    let waiting = null;
    const req = request(url + "/api/phi5/events", { headers: { Cookie: cookie } },
      (res) => {
        if (res.statusCode !== 200) { reject(new Error("SSE status " + res.statusCode)); return; }
        res.setEncoding("utf8");
        res.on("data", (part) => {
          partial += part;
          let index;
          while ((index = partial.indexOf("\n\n")) >= 0) {
            const chunk = partial.slice(0, index);
            partial = partial.slice(index + 2);
            if (!chunk.startsWith("data: ")) continue;
            const frame = JSON.parse(chunk.slice(6));
            if (waiting) {
              const go = waiting;
              waiting = null;
              go(frame);
            } else received.push(frame);
          }
        });
        resolve({
          req,
          next: (timeoutMs = 2500) => {
            if (received.length) return Promise.resolve(received.shift());
            return new Promise((done, fail) => {
              const timeout = setTimeout(() => {
                waiting = null;
                fail(new Error("Timed out waiting for SSE frame"));
              }, timeoutMs);
              waiting = (frame) => { clearTimeout(timeout); done(frame); };
            });
          },
          close: () => req.destroy()
        });
      });
    req.on("error", reject);
    req.end();
  });
}

test("local default remains loopback-only and LAN endpoints stay closed", async (t) => {
  const { app, url } = await start(false);
  t.after(() => app.close());
  const info = await fetch(url + "/api/phi5/info");
  assert.deepEqual(await info.json(), { enabled: false });
  assert.equal((await post(url, "/api/phi5/join", { code: ROOM, deviceId: "device-a" })).status, 403);
  assert.equal((await fetch(url + "/.git/config")).status, 404);
  assert.equal((await fetch(url + "/src/lan-relay.js")).status, 404);
  assert.equal((await fetch(url + "/index.html")).status, 200);
});

test("LAN join requires room code; sender is cookie-bound; streams relay between clients", async (t) => {
  const { app, url } = await start();
  t.after(() => app.close());
  const info = await fetch(url + "/api/phi5/info");
  assert.equal((await info.json()).enabled, true);
  const fail = await join(url, "device-a", "00000000000000000000000000000000");
  assert.equal(fail.res.status, 403);
  assert.equal((await post(url, "/api/phi5/send", {})).status, 401);
  assert.equal((await post(url, "/api/phi5/join", { code: ROOM, deviceId: "device-a" }, undefined,
    "http://somewhere-else.invalid")).status, 403);

  const a = await join(url, "device-a");
  const b = await join(url, "device-b");
  assert.equal(a.res.status, 200);
  assert.equal(b.res.status, 200);
  assert.ok(a.cookie?.startsWith("phi5_session="));
  const streamA = await listenFrames(url, a.cookie);
  const streamB = await listenFrames(url, b.cookie);
  t.after(() => { streamA.close(); streamB.close(); });

  const hello = { protocol: VERSION, type: "hello", from: "device-a",
    to: "*", manifest: manifest("device-a") };
  assert.equal((await post(url, "/api/phi5/send", hello, b.cookie)).status, 400);
  const relay = await post(url, "/api/phi5/send", hello, a.cookie);
  assert.equal(relay.status, 202);
  assert.equal((await relay.json()).relayed, 1);
  assert.deepEqual(await streamB.next(), hello);

  const invite = { protocol: VERSION, type: "invite", from: "device-b",
    to: "device-a", sessionId: "session-0001", manifest: manifest("device-b") };
  assert.equal((await post(url, "/api/phi5/send", invite, b.cookie)).status, 202);
  assert.deepEqual(await streamA.next(), invite);

  const approved = { protocol: VERSION, type: "decision", from: "device-a",
    to: "device-b", sessionId: "session-0001", approved: true };
  assert.equal((await post(url, "/api/phi5/send", approved, a.cookie)).status, 202);
  assert.deepEqual(await streamB.next(), approved);

  const command = { protocol: VERSION, type: "command", from: "device-b",
    to: "device-a", sessionId: "session-0001", commandId: "cmd-0001",
    capability: "display.message", payload: { text: "Phi five over LAN!" } };
  assert.equal((await post(url, "/api/phi5/send", command, b.cookie)).status, 202);
  assert.deepEqual(await streamA.next(), command);

  const ack = { protocol: VERSION, type: "ack", from: "device-a",
    to: "device-b", sessionId: "session-0001", commandId: "cmd-0001" };
  assert.equal((await post(url, "/api/phi5/send", ack, a.cookie)).status, 202);
  assert.deepEqual(await streamB.next(), ack);

  assert.equal((await post(url, "/api/phi5/leave", {}, b.cookie)).status, 200);
  assert.equal((await post(url, "/api/phi5/send", hello, b.cookie)).status, 401);
});

test("room joins are rate-limited after eight failed codes", async (t) => {
  const { app, url } = await start();
  t.after(() => app.close());
  for (let i = 0; i < 8; i++) {
    const r = await join(url, "device-a", "00000000000000000000000000000000");
    assert.equal(r.res.status, 403);
  }
  const tooMany = await join(url, "device-a");
  assert.equal(tooMany.res.status, 429);
});
