# Security and trust boundary · Phi5 v0.1

## Safe scope

Use this prototype with simulated devices and non-sensitive messages only. It deliberately has **no** hardware control, filesystem access, shell command capability, automatic OS pairing, or privilege escalation.

## Known limitations

1. **Unauthenticated participants.** Device IDs are strings, not verified identities. A same-origin script could forge discovery, decisions, commands, or acknowledgements. Do not send secrets.
2. **Transport boundaries.** BroadcastChannel connects same-origin browser tabs. The opt-in LAN relay connects browser clients on different computers accessing the same host URL, but cannot discover arbitrary hardware, phones, TVs, gaming consoles, or USB peripherals. **All LAN traffic and room codes travel in plaintext.** Any LAN attacker with interception capability may read, inject or modify traffic.
3. **No durability or revocation.** Session state and receipts are memory-only. Refreshing a tab loses the session; active grants cannot yet be revoked mid-session.
4. **Replay window is bounded, not secure.** Up to 512 recent inbound command IDs are retained. An attacker could replay older messages.
5. **No rate or session-count limit.** A malicious peer could flood messages and exhaust memory in a long-lived session.
6. **Manifest information is self-declared.** Negotiating capability IDs and directions doesn't prove the sender actually owns or supports the hardware feature.
7. **Acknowledgement is not attestation.** It indicates the app handler accepted the command, not that a physical output was produced.
8. **UI permission is not transport security.** The demo's Approve button is a useful protocol invariant, not a cryptographic pairing protocol.

## Security path before real connections

Use a mutually authenticated encrypted transport, out-of-band pairing confirmation, strongly random expiring session IDs, fine-grained one-time or revocable grants, origin permissions, bounded input sizes, robust replay defense, strict command schemas, disconnect handling, and independent adversarial tests.

**Rule:** Unknown devices get no privileged operations by default. There is never an AI-controlled authorization bypass.

## v0.2 LAN-specific controls and outstanding risks

- `npm run dev` binds to loopback only; `npm run lan` deliberately binds to all interfaces. Do not use port-forwarding or public Wi-Fi. Restrict TCP 4175 to your private network through your firewall.
- The relay generates a 128-bit random hex room code per launch. Each joining browser sends it to the server via an HTTP POST. It is **not confidential on the wire**. The host returns an unpredictable HttpOnly, SameSite=Strict, one-hour cookie bound to one device ID. A network observer could steal that cookie over HTTP.
- The relay rejects cross-origin browser POSTs, malformed manifests, mismatched senders, unknown static paths, excess messages, overlarge JSON frames, and more than eight failed room codes per minute per client IP. These are basic safeguards, not an independent security audit.
- LAN sessions expire after one hour for new requests; clients must rejoin afterward. Existing event streams may remain open until disconnect, and runtime sessions can be lost if the host restarts.
- Device IDs and capabilities are still self-asserted. The server **does not** independently inspect or validate the browser's approval ledger, which is why physical device commands are prohibited in this phase.
- There is no TLS, integrity verification, robust replay resistance, secure device attestation, end-to-end encryption, NAT traversal, or automatic trusted network discovery.
