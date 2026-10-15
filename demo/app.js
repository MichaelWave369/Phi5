import { VERSION, createNode } from "../src/phi5.js";

const byId = (id) => document.getElementById(id);
const deviceId = "browser-" + crypto.randomUUID();
const deviceName = "Phi5 Browser " + deviceId.slice(-4).toUpperCase();
const manifest = (id, name) => ({
  protocol: VERSION, id, name, capabilities: [
    { id: "display.message", direction: "both" },
    { id: "status.ping", direction: "both" }
  ]
});
const channel = typeof BroadcastChannel === "function"
  ? new BroadcastChannel("phi5-browser-lab-v0.1") : null;

function info(message) {
  byId("transport").textContent = message;
}
function failure(error) {
  info("Action blocked: " + error.message);
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function addButton(container, label, action, className = "") {
  const button = element("button", label, className);
  button.type = "button";
  button.addEventListener("click", () => {
    try { action(); } catch (error) { failure(error); }
  });
  container.append(button);
}
function describe(session) {
  return session.peerId + " · " + session.state + " · " + session.direction;
}
function render() {
  const peers = node.getPeers();
  byId("peer-count").textContent = String(peers.length);
  const peerArea = byId("peers");
  peerArea.replaceChildren();
  if (!peers.length) peerArea.append(element("p", "Open a second tab, then find peers.", "empty"));
  for (const peer of peers) {
    const item = element("div", undefined, "item");
    item.append(element("strong", peer.name));
    item.append(element("p", peer.id, "muted monospace"));
    item.append(element("p", peer.capabilities.map((c) => c.id + " (" + c.direction + ")").join(", "), "muted"));
    addButton(item, "Invite to Phi5", () => node.invite(peer.id));
    peerArea.append(item);
  }

  const sessions = node.getSessions();
  const sessionArea = byId("sessions");
  sessionArea.replaceChildren();
  if (!sessions.length) sessionArea.append(element("p", "No invitations yet.", "empty"));
  for (const session of sessions) {
    const item = element("div", undefined, "item");
    item.append(element("strong", describe(session)));
    item.append(element("p", "Can send: " + (session.outbound.join(", ") || "none"), "muted"));
    item.append(element("p", "Can receive: " + (session.inbound.join(", ") || "none"), "muted"));
    if (session.state === "pending" && session.direction === "inbound") {
      const controls = element("div", undefined, "controls");
      addButton(controls, "Approve", () => node.decide(session.id, true));
      addButton(controls, "Decline", () => node.decide(session.id, false), "secondary");
      item.append(controls);
    }
    sessionArea.append(item);
  }

  const active = sessions.filter((s) => s.state === "active" && s.outbound.length);
  const target = byId("target");
  const previouslySelected = target.value;
  target.replaceChildren();
  const none = element("option", active.length ? "Choose a session" : "No active sessions");
  none.value = "";
  target.append(none);
  for (const session of active) {
    const option = element("option", session.peerId + " (" + session.id.slice(0, 8) + ")");
    option.value = session.id;
    target.append(option);
  }
  if (active.some((s) => s.id === previouslySelected)) target.value = previouslySelected;

  const log = byId("receipts");
  log.replaceChildren();
  for (const receipt of node.getReceipts().slice(-35).reverse()) {
    let summary = receipt.type;
    if (receipt.peerId) summary += " · " + receipt.peerId;
    if (receipt.capability) summary += " · " + receipt.capability;
    if (receipt.payload?.text) summary += " · " + receipt.payload.text;
    log.append(element("li", summary));
  }
}

const node = createNode({
  manifest: manifest(deviceId, deviceName),
  send: (frame) => channel?.postMessage(frame),
  onEvent: (event) => {
    if (event.type === "command_received") {
      if (event.capability === "display.message") byId("screen").textContent = event.payload.text;
      if (event.capability === "status.ping") byId("screen").textContent = "Ping received from " + event.peerId;
    }
    render();
    // A new tab announces once; existing tabs return a hello so both discover each other.
    if (event.type === "peer_discovered" && event.fresh && channel) node.announce();
  }
});

byId("device-name").textContent = deviceName;
byId("device-id").textContent = deviceId;
if (channel) {
  channel.onmessage = (event) => { node.receive(event.data); };
  node.announce();
  info("Same-origin BroadcastChannel ready. Open a second Phi5 tab.");
} else {
  info("BroadcastChannel unavailable. In-memory simulation still works.");
  byId("announce").disabled = true;
}
byId("announce").addEventListener("click", () => node.announce());
byId("new-tab").addEventListener("click", () => window.open(location.href, "_blank", "noopener"));
function sendCommand(capability, payload) {
  try {
    if (!byId("target").value) throw new Error("Select an approved session first");
    node.command(byId("target").value, capability, payload);
    info("Sent " + capability + " through approved session");
  } catch (error) { failure(error); }
}
byId("send-message").addEventListener("click", () =>
  sendCommand("display.message", { text: byId("message").value }));
byId("send-ping").addEventListener("click", () => sendCommand("status.ping", {}));

byId("self-test").addEventListener("click", () => {
  let n = 0;
  const idFactory = () => "proof-" + ++n;
  const aEvents = [], bEvents = [];
  let a, b;
  a = createNode({ manifest: manifest("proof-device-a", "Virtual sender"),
    idFactory, send: (frame) => b.receive(frame),
    onEvent: (event) => aEvents.push(event) });
  b = createNode({ manifest: manifest("proof-device-b", "Virtual display"),
    idFactory, send: (frame) => a.receive(frame),
    onEvent: (event) => bEvents.push(event) });
  b.announce();
  const sessionId = a.invite("proof-device-b");
  let blocked = false;
  try { a.command(sessionId, "display.message", { text: "Too early" }); }
  catch { blocked = true; }
  b.decide(sessionId, true);
  a.command(sessionId, "display.message", { text: "High five from Phi5!" });
  const received = bEvents.some((e) => e.type === "command_received" &&
    e.payload?.text === "High five from Phi5!");
  const acknowledged = aEvents.some((e) => e.type === "acknowledged");
  const proof = byId("proof");
  proof.replaceChildren();
  for (const [ok, label] of [
    [blocked, "Unauthorized pre-approval command blocked"],
    [received, "Approved message delivered to virtual display"],
    [acknowledged, "Acknowledgement recorded on sender"]
  ]) proof.append(element("p", (ok ? "PASS · " : "FAIL · ") + label, ok ? "ok" : "bad"));
});
render();
