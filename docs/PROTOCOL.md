# Phi5 protocol draft · v0.1

**Experimental**, not an industry standard. Only two commands and a same-origin browser demo are implemented.

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

The core only requires a `send(frame)` function and a caller that invokes `receive(frame)`. This makes the app-layer handshake transport-neutral in design. The included implementation uses native BroadcastChannel for **same-origin tabs**, plus in-memory nodes for tests and simulation. It does **not** provide USB, BLE, LAN, mobile OS, or console transport support.

## Exit criteria before any physical-device adapter

- authenticated peer identity and explicit pairing verification;
- bounded message sizes, rate limits, expiring/renewable grants, revocation;
- transport-specific isolation, authorization, and safe failure behavior;
- independent testing of malformed inputs, replay, disconnect, and concurrency;
- capability-specific safety constraints and user-visible consent.
