# Security and trust boundary · Phi5 v0.1

## Safe scope

Use this prototype with simulated devices and non-sensitive messages only. It deliberately has **no** hardware control, network listening socket, filesystem access, shell command capability, automatic OS pairing, or privilege escalation.

## Known limitations

1. **Unauthenticated participants.** Device IDs are strings, not verified identities. A same-origin script could forge discovery, decisions, commands, or acknowledgements. Do not send secrets.
2. **Same-origin transport.** BroadcastChannel connects cooperating tabs within the browser's storage-partition/origin constraints. It does not discover phones, TVs, gaming consoles, USB peripherals, or different computers.
3. **No durability or revocation.** Session state and receipts are memory-only. Refreshing a tab loses the session; active grants cannot yet be revoked mid-session.
4. **Replay window is bounded, not secure.** Up to 512 recent inbound command IDs are retained. An attacker could replay older messages.
5. **No rate or session-count limit.** A malicious peer could flood messages and exhaust memory in a long-lived session.
6. **Manifest information is self-declared.** Negotiating capability IDs and directions doesn't prove the sender actually owns or supports the hardware feature.
7. **Acknowledgement is not attestation.** It indicates the app handler accepted the command, not that a physical output was produced.
8. **UI permission is not transport security.** The demo's Approve button is a useful protocol invariant, not a cryptographic pairing protocol.

## Security path before real connections

Use a mutually authenticated encrypted transport, out-of-band pairing confirmation, strongly random expiring session IDs, fine-grained one-time or revocable grants, origin permissions, bounded input sizes, robust replay defense, strict command schemas, disconnect handling, and independent adversarial tests.

**Rule:** Unknown devices get no privileged operations by default. There is never an AI-controlled authorization bypass.
