# Phi5 protocol draft · v0.2

**Experimental**, not an industry standard. Only two commands are implemented, with a same-origin browser-tab demo and an opt-in private LAN relay.

## Manifest

A peer advertises a bounded, declarative manifest:

```json
{
  "protocol": "phi5/0.1",
  "id": "browser-abc123",
  "name": "Living room screen",
  "capabilities": [
    { "id": "display.message", "direction": "receive" },
    { "id": "status.ping", "direction": "both" }
  ]
}
```


IDs are opaque, locally generated identifiers. Names and IDs are **not** validated as physical identity or possession of a private key. The strict v0.1 vocabulary comprises `display.message` and `status.ping`. Other capabilities require a reviewed extension.

### Direction negotiation

An outbound permission exists only when **local direction permits send** and **remote direction permits receive** for the same capability. Inbound is the inverse. No matching capability means the invitation is rejected.

### Frame envelope

All frames carry `{ protocol, type, from, to }`. The `hello` frame goes to `*` and contains the manifest; all other frames address a specific device ID.

| Type | Additional fields | Effect |
| --- | --- | --- |
| `hello` | `manifest` | Learn a peer's self-asserted manifest |
| `invite` | `sessionId, manifest` | Create **pending** inbound invitation |
| `decision` | `sessionId, approved` | Transition pending/invited to active/rejected |
| `command` | `sessionId, commandId, capability, payload` | Enforce active state and negotiated inbound rights |
| `ack` | `sessionId, commandId` | Mark matched outbound command acknowledged |

Sender state: invited → active or rejected. Receiver state: pending → active or rejected. Session creation is initiated by the inviter and **only the receiver can approve** the invitation. v0.1 does not implement session revocation, timeouts, or proof of identity; do not use it to operate physical devices.

## Receipts

Nodes log a bounded in-memory sequence (128 entries) of discovery, invitations, decisions, commands, and acknowledgements. Command IDs are deduplicated against the last 512 observed commands. These are diagnostic receipts, **not cryptographic audit records**, and a delayed replay outside the cache is not mitigated.

## Transport boundary

The core only requires a `send(frame)` function and a caller that invokes `receive(frame)`. This makes the app-layer handshake transport-neutral in design. The included implementation uses native BroadcastChannel for **same-origin tabs**, plus an opt-in plaintext **HTTP POST + Server-Sent Events LAN relay** for cross-computer browser sessions, and in-memory nodes for tests and simulation. The LAN relay never connects to OS peripherals. It does **not** provide USB, BLE, mobile OS, console transport support, authenticated network discovery, or TLS.

## Exit criteria before any physical-device adapter

- authenticated peer identity and explicit pairing verification;
- bounded message sizes, rate limits, expiring/renewable grants, revocation;
- transport-specific isolation, authorization, and safe failure behavior;
- independent testing of malformed inputs, replay, disconnect, and concurrency;
- capability-specific safety constraints and user-visible consent.

## v0.2 LAN relay surface

The default server listens on 127.0.0.1 only and disables the LAN endpoints. `npm run lan` opt-in binds the server to 0.0.0.0, generates a random room code, and exposes same-origin `/api/phi5/info`, `/api/phi5/join`, `/api/phi5/events` (SSE), `/api/phi5/send`, and `/api/phi5/leave`. Joins supply a code and a self-declared device ID; the server binds an HttpOnly one-hour cookie to that ID. Relay frames carry only the existing Phi5 envelopes and may be sent only by that client identity. All traffic is **plain HTTP**. This protocol version is strictly **non-sensitive demonstration use on a trusted private LAN**.
