# Φ5 | Phi5

**Give your devices a high five.**

Phi5 is an original, MIT-licensed experiment in **capability-based, permission-first device communication**. The long-term idea is simple: let devices explain what they can do, negotiate a shared vocabulary, and require a human-approved session before exchanging commands.

> **Status: v0.2 LAN research demo.** Not a universal driver, kernel component, certified interoperability standard, or secure hardware control product. No physical hardware connectivity is claimed. Transports are same-origin browser tabs via BroadcastChannel, an opt-in plaintext HTTP relay for browsers on a trusted private LAN, and an in-memory simulator.

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

## Two-computer trusted-LAN lab (v0.2)

Start on a **private, trusted home network only**. The relay intentionally carries test messages over **unencrypted HTTP**. A person on the same LAN may be able to inspect or manipulate traffic, including the room code. **Never port-forward the server**, use a public Wi-Fi network, send passwords/secrets, or control real hardware through it.

On the host computer (Node 20+):

```sh
npm run lan
```

The terminal prints a random **32-character hexadecimal room code** and listens on TCP port 4175. If Windows Firewall asks, permit **Private networks only**. Find the host's private IPv4 address with `ipconfig` (Windows) or your network settings. Both browsers should visit the **host's actual LAN address**, for example `http://192.168.1.50:4175` (replace this example address with yours), rather than each visiting their own localhost.

1. On PC A and PC B, visit the exact **same LAN URL** served by the host.
2. In each browser, enter the room code from the host terminal and click **Join LAN room**. Sharing the code by a trusted offline channel is best.
3. Click **Find peers** if needed; select **Invite to Phi5** for the other browser device.
4. Approve on the second computer; send a test message or ping from the first.
5. Inspect the second computer's virtual display and the sender's acknowledgment receipt.
6. Click **Leave LAN room** in each browser, then **Ctrl+C** on the host to stop accepting connections.

This proves application-level browser communication across two computers on the same private network, **not** autonomous discovery of operating systems, phones, game consoles, or driverless peripheral operation. If the host PC's firewall blocks inbound TCP 4175, the second computer cannot reach the demo until access on the Private profile is allowed. The room code is a basic admission gate, **not** encryption or authenticated pairing.

`npm run dev` remains loopback-only with all LAN endpoints disabled. GitHub Pages is a browser-tab-only deployment; it cannot run the LAN relay.

## Verify

```sh
npm test
```


Tests cover protocol validation and approvals, plus the LAN server's default-off behavior, static-route isolation, room-code admission, origin screening, sender-cookie binding, rate limits, and SSE frame relay. Tests are **protocol unit tests**, not independent security auditing or interoperability certification.

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
- **LAN demo is cross-computer**, using an explicitly started, plaintext relay and browsers that navigate to the same server. Authenticated/encrypted LAN, BLE, USB, and video-sharing transports remain future work.

## Planned evolution

- v0.2: opt-in trusted-LAN browser relay, explicit room admission and cross-computer demo (this PR).
- v0.3: authenticated and encrypted local-network discovery, revocable/short-lived capability grants.
- Later: opt-in adapters for existing OS interfaces and interoperability trials with PhiStream and PhiPie, if verified.

No third-party source code is incorporated. Phi5's browser demo uses platform APIs and its tests use Node's built-in test runner.

**License:** [MIT](LICENSE) · **Repository:** https://github.com/MichaelWave369/Phi5
