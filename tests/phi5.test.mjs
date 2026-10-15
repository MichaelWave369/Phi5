import test from "node:test";
import assert from "node:assert/strict";
import { VERSION, validateManifest, negotiateCapabilities, createNode } from "../src/phi5.js";

const manifest = (id, direction = "both") => ({
  protocol: VERSION, id, name: id, capabilities: [
    { id: "display.message", direction }, { id: "status.ping", direction: "both" }
  ]
});

function lab(aDirection = "both", bDirection = "both") {
  let seq = 0;
  const next = () => "test-id-" + ++seq;
  const aEvents = [];
  const bEvents = [];
  const a = createNode({
    manifest: manifest("device-a", aDirection),
    idFactory: next, now: () => 123,
    send: (frame) => b.receive(frame), onEvent: (e) => aEvents.push(e)
  });
  const b = createNode({
    manifest: manifest("device-b", bDirection),
    idFactory: next, now: () => 124,
    send: (frame) => a.receive(frame), onEvent: (e) => bEvents.push(e)
  });
  return { a, b, aEvents, bEvents };
}

test("invalid manifests and undeclared capabilities fail closed", () => {
  assert.throws(() => validateManifest({}), /Unsupported|Manifest|Invalid/);
  assert.throws(() => validateManifest({
    ...manifest("device-a"), capabilities: [{ id: "system.shell", direction: "both" }]
  }), /Unknown capability/);
  assert.throws(() => validateManifest({
    ...manifest("device-a"), capabilities: [
      { id: "status.ping", direction: "both" },
      { id: "status.ping", direction: "both" }
    ]
  }), /Duplicate/);
});

test("negotiation respects complementary directions", () => {
  const grant = negotiateCapabilities(manifest("device-a", "send"),
    manifest("device-b", "receive"));
  assert.deepEqual(grant.outbound, ["display.message", "status.ping"]);
  assert.deepEqual(grant.inbound, ["status.ping"]);
});

test("invitations require explicit approval before any command", () => {
  const { a, b, bEvents, aEvents } = lab();
  a.announce();
  b.announce();
  const id = a.invite("device-b");
  assert.equal(b.getSessions()[0].state, "pending");
  assert.throws(() => a.command(id, "display.message", { text: "Nope" }), /authorized/);
  assert.equal(bEvents.some((e) => e.type === "command_received"), false);
  b.decide(id, true);
  assert.equal(a.getSessions()[0].state, "active");
  a.command(id, "display.message", { text: "High five!" });
  assert.equal(bEvents.find((e) => e.type === "command_received").payload.text, "High five!");
  assert.equal(aEvents.some((e) => e.type === "acknowledged"), true);
});

test("rejection blocks commands", () => {
  const { a, b } = lab();
  b.announce();
  const id = a.invite("device-b");
  b.decide(id, false);
  assert.equal(a.getSessions()[0].state, "rejected");
  assert.throws(() => a.command(id, "status.ping", {}), /authorized/);
});

test("unnegotiated direction, oversized payload, and forged sender are denied", () => {
  const { a, b, bEvents } = lab("receive", "send");
  b.announce();
  const id = a.invite("device-b");
  b.decide(id, true);
  assert.throws(() => a.command(id, "display.message", { text: "Denied" }), /not permitted/);
  assert.throws(() => a.command(id, "status.ping", { text: "extra" }), /takes no payload/);
  assert.equal(b.receive({
    protocol: VERSION, type: "command", from: "fake-device", to: "device-b",
    sessionId: id, commandId: "fake-command", capability: "status.ping", payload: {}
  }), false);
  assert.equal(bEvents.some((e) => e.type === "command_received"), false);
});

test("replayed commands do not fire twice", () => {
  const { a, b, bEvents } = lab();
  b.announce();
  const id = a.invite("device-b");
  b.decide(id, true);
  const frame = { protocol: VERSION, type: "command", from: "device-a", to: "device-b",
    sessionId: id, commandId: "replay-0001", capability: "display.message",
    payload: { text: "Only once" } };
  assert.equal(b.receive(frame), true);
  assert.equal(b.receive(frame), false);
  assert.equal(bEvents.filter((e) => e.type === "command_received").length, 1);
});

test("unknown session and mismatched address are ignored", () => {
  const { a } = lab();
  assert.equal(a.receive({
    protocol: VERSION, type: "decision", from: "device-b", to: "device-a",
    sessionId: "nonexistent", approved: true
  }), false);
  assert.equal(a.receive({
    protocol: VERSION, type: "hello", from: "device-b", to: "somewhere-else",
    manifest: manifest("device-b")
  }), false);
});
