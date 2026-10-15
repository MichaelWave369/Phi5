// Phi5 v0.1: experimental application-layer capability handshake.
// This is NOT authenticated device identity or a replacement for OS drivers.

export const VERSION = "phi5/0.1";
const VALID_ID = /^[a-zA-Z0-9._:-]{3,80}$/;
const VALID_CAP = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const DIRECTIONS = new Set(["send", "receive", "both"]);
const CAPABILITY_IDS = new Set(["display.message", "status.ping"]);

function isRecord(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

export function validateManifest(input) {
  assert(isRecord(input), "Manifest must be a plain object");
  assert(input.protocol === VERSION, "Unsupported Phi5 protocol");
  assert(typeof input.id === "string" && VALID_ID.test(input.id), "Invalid device ID");
  assert(typeof input.name === "string" && input.name.trim().length > 0 &&
    input.name.length <= 64, "Invalid device name");
  assert(Array.isArray(input.capabilities) &&
    input.capabilities.length > 0 && input.capabilities.length <= 16,
    "Manifest needs 1-16 capabilities");
  const seen = new Set();
  const capabilities = input.capabilities.map((cap) => {
    assert(isRecord(cap), "Invalid capability");
    assert(typeof cap.id === "string" && VALID_CAP.test(cap.id) &&
      CAPABILITY_IDS.has(cap.id), "Unknown capability");
    assert(DIRECTIONS.has(cap.direction), "Invalid capability direction");
    assert(!seen.has(cap.id), "Duplicate capability");
    seen.add(cap.id);
    return { id: cap.id, direction: cap.direction };
  });
  return {
    protocol: VERSION,
    id: input.id,
    name: input.name.trim(),
    capabilities
  };
}

function canSend(direction) {
  return direction === "send" || direction === "both";
}
function canReceive(direction) {
  return direction === "receive" || direction === "both";
}

export function negotiateCapabilities(localInput, remoteInput) {
  const local = validateManifest(localInput);
  const remote = validateManifest(remoteInput);
  const theirs = new Map(remote.capabilities.map((c) => [c.id, c.direction]));
  const outbound = [];
  const inbound = [];
  for (const cap of local.capabilities) {
    const remoteDirection = theirs.get(cap.id);
    if (!remoteDirection) continue;
    if (canSend(cap.direction) && canReceive(remoteDirection)) outbound.push(cap.id);
    if (canReceive(cap.direction) && canSend(remoteDirection)) inbound.push(cap.id);
  }
  return { outbound, inbound };
}

function validatePayload(capability, payload) {
  assert(isRecord(payload), "Payload must be a plain object");
  if (capability === "display.message") {
    assert(typeof payload.text === "string" &&
      payload.text.trim().length > 0 && payload.text.length <= 160,
      "Message must be 1-160 characters");
    return { text: payload.text };
  }
  if (capability === "status.ping") {
    assert(Object.keys(payload).length === 0, "Ping takes no payload");
    return {};
  }
  throw new TypeError("Unsupported command capability");
}

export function createNode({ manifest, send, onEvent = () => {}, idFactory, now = () => Date.now() }) {
  const own = validateManifest(manifest);
  assert(typeof send === "function", "send function required");
  assert(typeof onEvent === "function", "onEvent function required");
  const randomId = idFactory ?? (() => globalThis.crypto.randomUUID());
  assert(typeof randomId === "function", "idFactory must be a function");
  const peers = new Map();
  const sessions = new Map();
  const receipts = [];
  const pendingAcks = new Map();
  const seenCommands = new Set();

  function log(type, details = {}) {
    const receipt = { at: now(), type, device: own.id, ...details };
    receipts.push(receipt);
    if (receipts.length > 128) receipts.shift();
    onEvent(receipt);
  }

  function emit(type, to, rest = {}) {
    send({ protocol: VERSION, type, from: own.id, to, ...rest });
  }

  function announce() {
    emit("hello", "*", { manifest: own });
    log("announced");
  }

  function invite(peerId) {
    const peer = peers.get(peerId);
    assert(peer, "Discover peer before inviting");
    const grant = negotiateCapabilities(own, peer);
    assert(grant.outbound.length + grant.inbound.length > 0, "No shared capabilities");
    const sessionId = randomId();
    assert(typeof sessionId === "string" && VALID_ID.test(sessionId), "Invalid session ID");
    assert(!sessions.has(sessionId), "Duplicate session ID");
    sessions.set(sessionId, { id: sessionId, peerId, state: "invited",
      direction: "outbound", grant });
    log("invite_sent", { peerId, sessionId });
    emit("invite", peerId, { sessionId, manifest: own });
    return sessionId;
  }

  function decide(sessionId, approve) {
    const session = sessions.get(sessionId);
    assert(session && session.state === "pending" && session.direction === "inbound",
      "No pending inbound invitation");
    session.state = approve ? "active" : "rejected";
    log(approve ? "approved" : "rejected", { peerId: session.peerId, sessionId });
    emit("decision", session.peerId, { sessionId, approved: Boolean(approve) });
  }

  function command(sessionId, capability, payload) {
    const session = sessions.get(sessionId);
    assert(session && session.state === "active", "Session not authorized");
    assert(session.grant.outbound.includes(capability), "Capability not permitted");
    const safePayload = validatePayload(capability, payload);
    const commandId = randomId();
    assert(typeof commandId === "string" && VALID_ID.test(commandId), "Invalid command ID");
    const pendingKey = sessionId + "/" + commandId;
    assert(!pendingAcks.has(pendingKey), "Duplicate command ID");
    pendingAcks.set(pendingKey, session.peerId);
    log("command_sent", { peerId: session.peerId, sessionId, capability, commandId });
    emit("command", session.peerId, { sessionId, commandId, capability, payload: safePayload });
    return commandId;
  }

  function receive(frame) {
    if (!isRecord(frame) || frame.protocol !== VERSION ||
      typeof frame.from !== "string" || !VALID_ID.test(frame.from) ||
      frame.from === own.id || (frame.to !== own.id && frame.to !== "*")) return false;
    try {
      if (frame.type === "hello" && frame.to === "*") {
        const manifest = validateManifest(frame.manifest);
        if (manifest.id !== frame.from) return false;
        const fresh = !peers.has(manifest.id);
        peers.set(manifest.id, manifest);
        log("peer_discovered", { peerId: manifest.id, name: manifest.name, fresh });
        return true;
      }
      if (frame.to !== own.id) return false;
      if (frame.type === "invite") {
        const peer = validateManifest(frame.manifest);
        if (peer.id !== frame.from || !VALID_ID.test(frame.sessionId) ||
          sessions.has(frame.sessionId)) return false;
        const grant = negotiateCapabilities(own, peer);
        if (grant.outbound.length + grant.inbound.length === 0) return false;
        peers.set(peer.id, peer);
        sessions.set(frame.sessionId, { id: frame.sessionId, peerId: peer.id,
          state: "pending", direction: "inbound", grant });
        log("invite_received", { peerId: peer.id, sessionId: frame.sessionId });
        return true;
      }
      const session = sessions.get(frame.sessionId);
      if (!session || session.peerId !== frame.from) return false;
      if (frame.type === "decision") {
        if (session.direction !== "outbound" || session.state !== "invited" ||
          typeof frame.approved !== "boolean") return false;
        session.state = frame.approved ? "active" : "rejected";
        log(frame.approved ? "connected" : "declined", {
          peerId: frame.from, sessionId: frame.sessionId });
        return true;
      }
      if (frame.type === "command") {
        if (session.state !== "active" ||
          !session.grant.inbound.includes(frame.capability) ||
          typeof frame.commandId !== "string" || !VALID_ID.test(frame.commandId)) return false;
        const key = frame.sessionId + "/" + frame.commandId;
        if (seenCommands.has(key)) return false;
        const safePayload = validatePayload(frame.capability, frame.payload);
        seenCommands.add(key);
        if (seenCommands.size > 512) seenCommands.delete(seenCommands.values().next().value);
        log("command_received", { peerId: frame.from, sessionId: frame.sessionId,
          capability: frame.capability, commandId: frame.commandId,
          payload: safePayload });
        emit("ack", frame.from, { sessionId: frame.sessionId, commandId: frame.commandId });
        return true;
      }
      if (frame.type === "ack") {
        if (session.state !== "active" || typeof frame.commandId !== "string") return false;
        const key = frame.sessionId + "/" + frame.commandId;
        if (pendingAcks.get(key) !== frame.from) return false;
        pendingAcks.delete(key);
        log("acknowledged", { peerId: frame.from, sessionId: frame.sessionId,
          commandId: frame.commandId });
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  return {
    manifest: own, announce, invite, decide, command, receive,
    getPeers: () => [...peers.values()].map((p) => ({ ...p,
      capabilities: p.capabilities.map((c) => ({ ...c })) })),
    getSessions: () => [...sessions.values()].map((s) => ({
      id: s.id, peerId: s.peerId, state: s.state, direction: s.direction,
      outbound: [...s.grant.outbound], inbound: [...s.grant.inbound]
    })),
    getReceipts: () => receipts.map((r) => ({ ...r }))
  };
}
