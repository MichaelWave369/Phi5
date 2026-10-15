import { useEffect, useMemo, useRef, useState } from "react";
import { VERSION, createNode } from "../../src/phi5.js";

const REPO = "https://github.com/MichaelWave369/Phi5";
const STEPS = [
  ["01", "FIND", "Discover a peer"],
  ["02", "IDENTIFY", "Read capabilities"],
  ["03", "INVITE", "Ask to connect"],
  ["04", "AUTHORIZE", "Accept or decline"],
  ["05", "EXCHANGE", "Send a permitted action"]
];
const manifestFor = (id, name) => ({
  protocol: VERSION,
  id, name,
  capabilities: [
    { id: "display.message", direction: "both" },
    { id: "status.ping", direction: "both" }
  ]
});
function short(id) { return id.length > 21 ? id.slice(0, 13) + "…" + id.slice(-5) : id; }
function timeOf(epoch) { return new Date(epoch).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function versionLabel() { return "Phi5 / 0.3 showcase"; }

export default function App() {
  const [device] = useState(() => {
    const id = "browser-" + crypto.randomUUID();
    return { id, name: "Phi5 Browser " + id.slice(-4).toUpperCase() };
  });
  const nodeRef = useRef(null);
  const channelRef = useRef(null);
  const [peers, setPeers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [transport, setTransport] = useState("Starting browser transport…");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("Bro, check this out! 🖐");
  const [selectedSession, setSelectedSession] = useState("");
  const [screen, setScreen] = useState({ kind: "idle", text: "AWAITING SIGNAL", from: "No approved commands received yet." });
  const [proof, setProof] = useState([]);
  const [tabSupport, setTabSupport] = useState(true);
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.state === "active" && s.outbound.length > 0),
    [sessions]
  );
  const currentSelection = activeSessions.some((s) => s.id === selectedSession) ?
    selectedSession : (activeSessions.length === 1 ? activeSessions[0].id : "");

  useEffect(() => {
    const channel = typeof BroadcastChannel === "function" ?
      new BroadcastChannel("phi5-browser-lab-v0.1") : null;
    channelRef.current = channel;
    setTabSupport(Boolean(channel));
    const refresh = () => {
      if (!nodeRef.current) return;
      setPeers(nodeRef.current.getPeers());
      setSessions(nodeRef.current.getSessions());
      setReceipts(nodeRef.current.getReceipts().slice(-60).reverse());
    };
    const node = createNode({
      manifest: manifestFor(device.id, device.name),
      send: (frame) => channel?.postMessage(frame),
      onEvent: (event) => {
        if (event.type === "command_received") {
          if (event.capability === "display.message") {
            setScreen({ kind: "message", text: event.payload.text, from: event.peerId });
          } else if (event.capability === "status.ping") {
            setScreen({ kind: "ping", text: "PING RECEIVED", from: event.peerId });
          }
        }
        refresh();
        if (event.type === "peer_discovered" && event.fresh && channel) node.announce();
      }
    });
    nodeRef.current = node;
    if (channel) {
      channel.onmessage = (event) => node.receive(event.data);
      setTransport("BROADCAST CHANNEL ONLINE");
      node.announce();
    } else setTransport("SIMULATION ONLY · NO BROADCAST CHANNEL");
    refresh();
    return () => {
      channel?.close();
      channelRef.current = null;
      nodeRef.current = null;
    };
  }, [device]);

  function attempt(action) {
    setNotice("");
    try { action(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Action blocked"); }
  }
  function announce() {
    attempt(() => {
      if (!channelRef.current) throw new Error("BroadcastChannel is not available in this browser.");
      nodeRef.current.announce();
      setNotice("Discovery announced. Open another tab on this same site to see a peer.");
    });
  }
  function openPeer() {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  }
  function invite(peerId) {
    attempt(() => {
      const id = nodeRef.current.invite(peerId);
      setNotice("Invitation sent. Approve it in the other tab to activate " + short(id) + ".");
    });
  }
  function decide(id, approved) {
    attempt(() => {
      nodeRef.current.decide(id, approved);
      setNotice(approved ? "Connection approved. Only shared capabilities are enabled." : "Invitation declined.");
    });
  }
  function send(capability) {
    attempt(() => {
      if (!currentSelection) throw new Error("Approve a connection and choose its session first.");
      const payload = capability === "display.message" ? { text: message } : {};
      const commandId = nodeRef.current.command(currentSelection, capability, payload);
      setNotice("Sent " + capability + " · " + short(commandId) + ". Watch for the ACK receipt.");
    });
  }
  function runProof() {
    let sequence = 0;
    const nextId = () => "proof-" + ++sequence;
    let a, b;
    const aLog = [], bLog = [];
    a = createNode({
      manifest: manifestFor("proof-alpha", "Virtual sender"),
      send: (frame) => b.receive(frame),
      idFactory: nextId,
      onEvent: (event) => aLog.push(event)
    });
    b = createNode({
      manifest: manifestFor("proof-bravo", "Virtual receiver"),
      send: (frame) => a.receive(frame),
      idFactory: nextId,
      onEvent: (event) => bLog.push(event)
    });
    b.announce();
    const sessionId = a.invite("proof-bravo");
    let preapprovalBlocked = false;
    try { a.command(sessionId, "display.message", { text: "Not authorized" }); }
    catch { preapprovalBlocked = true; }
    b.decide(sessionId, true);
    a.command(sessionId, "display.message", { text: "High five from Phi5!" });
    setProof([
      { label: "DENY · Command rejected before approval", ok: preapprovalBlocked },
      { label: "AUTHORIZE · Receiver explicitly approved", ok: bLog.some((r) => r.type === "approved") },
      { label: "EXCHANGE · Message reached virtual receiver", ok: bLog.some((r) => r.type === "command_received" && r.payload?.text === "High five from Phi5!") },
      { label: "RECEIPT · Sender received acknowledgement", ok: aLog.some((r) => r.type === "acknowledged") }
    ]);
  }

  return (
    <div className="app-shell">
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Phi5 home">
          <span className="brand-mark">Φ<span className="brand-five">5</span></span>
          <span className="brand-text">PHI FIVE<span>DEVICE HANDSHAKE LAB</span></span>
        </a>
        <nav className="topnav" aria-label="Main navigation">
          <a href="#lab">LIVE LAB</a>
          <a href="#proof">PROOF</a>
          <a href="#lan">LAN BRIDGE</a>
          <a className="github-link" href={REPO} target="_blank" rel="noreferrer">GITHUB ↗</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="status-pill"><span className="pulse-dot"/> ORIGINAL OPEN PROTOCOL EXPERIMENT <span className="sep">/</span> V0.3 UI</div>
            <h1>Give your devices <span>a high five<span className="period">.</span></span></h1>
            <p>Devices should be able to introduce themselves, explain their capabilities, ask permission, and communicate. Phi5 is where we start teaching them.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#lab">ENTER LIVE LAB <span>↗</span></a>
              <button className="button button-soft" onClick={openPeer} disabled={!tabSupport}>OPEN PEER TAB <span>↗</span></button>
            </div>
            <div className="hero-foot"><span><span className="green-light"/> BROWSER LAB READY</span><span>PERMISSION FIRST</span><span>ZERO VENDOR SDKS</span></div>
          </div>
          <div className="hero-visual" aria-label="Conceptual five-stage connection visualization">
            <div className="visual-top"><span>Φ5 / CONNECTION GRAPH</span><span>SIMULATED · LIVE PROTOCOL</span></div>
            <div className="orbit outer"><div className="orbit inner">
              <div className="center-logo">Φ<span>5</span></div>
            </div></div>
            <div className="node-node node-a"><span className="node-symbol">▣</span><strong>DEVICE A</strong><small>CAPABILITY MANIFEST</small></div>
            <div className="node-node node-b"><span className="node-symbol">▤</span><strong>DEVICE B</strong><small>PERMISSION REQUIRED</small></div>
            <div className="visual-bottom"><span>FIND → IDENTIFY → INVITE → AUTHORIZE → EXCHANGE</span><span className="online">● SYSTEM READY</span></div>
          </div>
        </section>

        <section className="stages" aria-label="The five handshake stages">
          {STEPS.map(([number, title, desc], i) =>
            <div className="stage" key={number}>
              <span className="stage-number">{number}</span>
              <strong>{title}</strong>
              <small>{desc}</small>
              {i < 4 && <span className="stage-arrow" aria-hidden="true">→</span>}
            </div>
          )}
        </section>

        <section id="lab" className="lab-section">
          <div className="section-heading">
            <div><div className="eyebrow">01 / INTERACTIVE EXPERIMENT</div><h2>The live handshake lab<span className="period">.</span></h2>
              <p>Try the real Phi5 protocol between two tabs on this website. Each tab is a separate virtual device.</p>
            </div>
            <span className="mode-badge"><span className="pulse-dot" /> SAME-ORIGIN MODE</span>
          </div>

          <div className="lab-grid">
            <article className="panel self-panel">
              <div className="panel-heading"><span className="panel-index">01 / IDENTITY</span><span className="micro-tag live-tag">● ONLINE</span></div>
              <h3>This device</h3>
              <div className="device-id-card">
                <div className="device-icon">▣</div>
                <div><strong>{device.name}</strong><span>{short(device.id)}</span></div>
              </div>
              <div className="capability-label">DECLARED CAPABILITIES</div>
              <div className="capabilities"><span>display.message</span><span>status.ping</span></div>
              <div className="panel-actions"><button className="button button-primary" onClick={announce} disabled={!tabSupport}>FIND PEERS ↗</button><button className="button button-ghost" onClick={openPeer} disabled={!tabSupport}>OPEN TAB ↗</button></div>
              <div className="panel-status"><span className="green-light"/>{transport}</div>
            </article>

            <article className="panel peers-panel">
              <div className="panel-heading"><span className="panel-index">02 / DISCOVERY</span><span className="count">{peers.length.toString().padStart(2, "0")} PEERS</span></div>
              <h3>Available devices</h3>
              <p className="panel-descriptor">Another tab must be open on the same site and browser profile.</p>
              {peers.length ? <div className="cards-list">{peers.map((peer) =>
                <div className="mini-item" key={peer.id}>
                  <div className="mini-top"><span className="mini-icon">◇</span><div><strong>{peer.name}</strong><small>{short(peer.id)}</small></div></div>
                  <button className="button button-outline" onClick={() => invite(peer.id)}>INVITE DEVICE <span>→</span></button>
                </div>)}</div> :
                <div className="empty-state"><span className="empty-icon">⌁</span><strong>NO PEERS DETECTED</strong><small>Open a second Phi5 tab, then click Find Peers.</small></div>}
            </article>

            <article className="panel sessions-panel">
              <div className="panel-heading"><span className="panel-index">03 / CONSENT</span><span className="count">{sessions.length.toString().padStart(2, "0")} SESSIONS</span></div>
              <h3>Invites &amp; approvals</h3>
              <p className="panel-descriptor">Nothing can execute before the receiving tab approves.</p>
              {sessions.length ? <div className="cards-list">{sessions.map((session) =>
                <div className="mini-item" key={session.id}>
                  <div className="mini-top"><span className={"state-indicator " + (session.state === "active" ? "active" : "")}></span><div><strong>{short(session.peerId)}</strong><small>{session.direction.toUpperCase()} / {session.state.toUpperCase()}</small></div></div>
                  <div className="mini-detail">SEND: {session.outbound.join(", ") || "none"}</div>
                  {session.state === "pending" && session.direction === "inbound" && <div className="approval-actions">
                    <button className="button button-primary" onClick={() => decide(session.id, true)}>APPROVE</button>
                    <button className="button button-outline" onClick={() => decide(session.id, false)}>DECLINE</button>
                  </div>}
                </div>)}</div> :
                <div className="empty-state"><span className="empty-icon">⛨</span><strong>DEFAULT DENY ACTIVE</strong><small>No connection has been authorized.</small></div>}
            </article>

            <article className="panel exchange-panel">
              <div className="panel-heading"><span className="panel-index">04 / EXCHANGE</span><span className="micro-tag">APPROVAL REQUIRED</span></div>
              <h3>Send a signal</h3>
              <label htmlFor="session">TARGET SESSION</label>
              <select id="session" value={currentSelection} onChange={(e) => setSelectedSession(e.target.value)}>
                <option value="">Select an approved session</option>
                {activeSessions.map((s) => <option key={s.id} value={s.id}>{short(s.peerId)} · {s.outbound.join(", ")}</option>)}
              </select>
              <label htmlFor="msg">MESSAGE / 160 CHARACTERS MAX</label>
              <textarea id="msg" maxLength={160} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="panel-actions"><button className="button button-primary" disabled={!currentSelection} onClick={() => send("display.message")}>SEND MESSAGE →</button><button className="button button-outline" disabled={!currentSelection} onClick={() => send("status.ping")}>PING ↗</button></div>
            </article>
          </div>
          <div className="output-grid">
            <div className="output-panel">
              <div className="screen-label"><span>◈ VIRTUAL DISPLAY</span><span className="screen-led">● INPUT READY</span></div>
              <div className={"virtual-screen " + (screen.kind !== "idle" ? "has-signal" : "")}>
                <span className="screen-glyph">Φ5</span><strong>{screen.text}</strong><small>{screen.from}</small>
              </div>
            </div>
            <div className="output-panel">
              <div className="screen-label"><span>◈ ACTIVITY LEDGER</span><span>{receipts.length} VISIBLE</span></div>
              <div className="receipt-list" aria-live="polite">
                {receipts.length ? receipts.map((entry, i) =>
                  <div className="receipt" key={i}><time>{timeOf(entry.at)}</time><strong>{entry.type.replaceAll("_", " ").toUpperCase()}</strong><span>{entry.peerId ? short(entry.peerId) : "LOCAL"}{entry.capability ? " / " + entry.capability : ""}</span></div>
                ) : <div className="receipt-empty">No receipts yet. Announce this device to begin.</div>}
              </div>
            </div>
          </div>
          {notice && <div className="notice-line" role="status">{notice}</div>}
        </section>

        <section id="proof" className="proof-section">
          <div className="proof-copy"><div className="eyebrow">02 / TEST THE PERMISSION GATE</div><h2>Trust should be <span>earned.</span></h2>
            <p>Run two independent virtual Phi5 devices in memory. The demo tries an unauthorized command, explicitly approves a session, delivers a message, and checks the acknowledgement.</p>
            <button className="button button-primary" onClick={runProof}>RUN FOUR-STEP PROOF <span>↗</span></button>
          </div>
          <div className="proof-results">
            <div className="proof-header"><span>PROTOCOL CHECK</span><span>{proof.length ? (proof.every((x) => x.ok) ? "ALL PASS" : "CHECK FAILED") : "AWAITING RUN"}</span></div>
            {proof.length ? proof.map((item) => <div className="proof-row" key={item.label}><span className={item.ok ? "check-pass" : "check-fail"}>{item.ok ? "✓" : "×"}</span><span>{item.label}</span><strong>{item.ok ? "PASS" : "FAIL"}</strong></div>) :
              <div className="proof-placeholder"><span>⌁</span> NO TEST EXECUTED YET</div>}
            <div className="proof-footer">SIMULATED APPLICATION-LEVEL PROOF · NOT A SECURITY AUDIT</div>
          </div>
        </section>

        <section id="lan" className="lan-section">
          <div className="section-heading"><div><div className="eyebrow">03 / THE NEXT CONNECTION</div><h2>Beyond the browser<span className="period">.</span></h2>
            <p>The local Phi5 LAN lab can relay messages between browsers on two physical computers. GitHub Pages itself cannot run that server.</p></div></div>
          <div className="lan-grid">
            <div className="terminal-card"><div className="terminal-bar"><span><i/><i/><i/></span><strong>PHI5 / LOCAL HOST</strong></div>
              <code><span className="terminal-muted"># Node.js 20+ / trusted private LAN</span><br/><span className="terminal-dollar">$</span> npm run lan<br/><span className="terminal-muted"># Opens TCP 4175; prints room code</span><br/><span className="terminal-dollar">$</span> <span className="terminal-muted">open http://HOST-LAN-IP:4175</span></code>
            </div>
            <div className="lan-explain"><h3>A real two-computer experiment.</h3><p>Run the local relay on one computer, open its private LAN address on both devices, enter the room code, and approve the peer invitation. The public GitPage stays a browser-only playground.</p><p className="security-note"><strong>Security boundary:</strong> Current LAN mode uses unencrypted HTTP. Use a trusted private network and harmless messages only. Never port-forward or use it for real hardware commands.</p><a className="text-link" href={REPO + "/blob/main/README.md"} target="_blank" rel="noreferrer">READ THE LAN SETUP GUIDE ↗</a></div>
          </div>
        </section>
        <section className="closing"><span className="closing-mark">Φ5</span><div><div className="eyebrow">LET DEVICES INTRODUCE THEMSELVES</div><h2>A common language.<br/>A better handshake.</h2><p>Designed to become transport-neutral, capability-aware, and consent-driven. Today it's an honest working experiment. Tomorrow, maybe even that printer will cooperate.</p></div><a className="button button-soft" href={REPO} target="_blank" rel="noreferrer">VIEW SOURCE ↗</a></section>
      </main>
      <footer><span>© 2026 PHI5 / MICHAELWAVE369</span><span>{versionLabel()} · EXPERIMENTAL · MIT</span><a href={REPO} target="_blank" rel="noreferrer">GITHUB ↗</a></footer>
    </div>
  );
}
