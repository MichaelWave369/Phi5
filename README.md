# Φ5 | Phi5

**Give your devices a high five.**

Phi5 is an original, MIT-licensed experiment in **capability-based, permission-first device communication**. The long-term idea is simple: let devices explain what they can do, negotiate a shared vocabulary, and require a human-approved session before exchanging commands.

> **Status: v0.1 research demo.** Not a universal driver, kernel component, certified interoperability standard, or secure hardware control product. No physical hardware connectivity is claimed. The current transport is same-origin browser tabs via BroadcastChannel plus an in-memory simulator.

## The five stages

1. **Find**: discover peers over an available transport.
2. **Identify**: introduce a machine-readable capability manifest (not cryptographic identity).
3. **Invite**: request a specific session with a specific peer.
4. **Authorize**: require explicit receiving-side approval; default deny.
5. **Exchange**: send only mutually supported, direction-compatible commands, and record acknowledgements.

## Try the live browser lab locally

Requirements: **Node.js 20+**. No packages to install.

```sh
npm run dev
```

Visit **http://127.0.0.1:4175**, then:

1. Click **Open peer tab**. The two tabs should discover each other.
2. In one tab, click **Invite to Phi5** next to the discovered peer.
3. In the other tab, click **Approve** (or **Decline**, to test default deny).
4. Return to the first tab, select its approved session, and **Send message**.
5. Confirm the second tab's virtual display changes and the sender receives an acknowledgement.
6. Click **Run simulated handshake** for a one-window proof of rejection, delivery, and acknowledgement.

The browser demo can be hosted via GitHub Pages from **main / (root)** once this PR is merged. Pages deployment is not enabled by the protocol code; enable it under the repository's Settings → Pages.

## Verify

```sh
npm test
```


Tests cover manifest rejection, complementary capability directions, invitation approval, denial, unauthorized commands, spoofed sender IDs, duplicate command replay, and mismatched envelopes. Tests are **protocol unit tests**, not independent security auditing or interoperability certification.

## v0.1 capability vocabulary

| Capability | Payload | Behavior |
| --- | --- | --- |
| `display.message` | `{ "text": "..." }` (1–160 chars) | Updates an approved peer's virtual message display |
| `status.ping` | `{}` | Indicates a ping was received |

Manifest directions: `send`, `receive`, or `both`. Unknown capabilities are rejected; there is no arbitrary shell execution, filesystem access, hardware access, or remote procedure execution.

Read [the protocol draft](docs/PROTOCOL.md) and [threat model](docs/THREAT_MODEL.md) before extending this.

## Design boundaries

- **Driverless setup ≠ no drivers**. A future adapter would still rely on OS APIs and existing class/vendor drivers where necessary.
- **Discovery ≠ trust**. Device names and IDs are currently self-asserted.
- **Approval ≠ secure authentication**. v0.1 is for local exploration only.
- **Acknowledgement ≠ proof of physical action**. It confirms only that the demo handler accepted a message.
- **Not yet cross-device**. BroadcastChannel is same-origin, same browser context; actual LAN, BLE, USB, and video-sharing transports remain future work.

## Planned evolution

- v0.2: transport-neutral peer interface and adapter test harness.
- v0.3: authenticated local-network discovery and short-lived, revocable grants.
- Later: opt-in adapters for existing OS interfaces and interoperability trials with PhiStream and PhiPie, if verified.

No third-party source code is incorporated. Phi5's browser demo uses platform APIs and its tests use Node's built-in test runner.

**License:** [MIT](LICENSE) · **Repository:** https://github.com/MichaelWave369/Phi5
