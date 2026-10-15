# Phi5 React GitHub Pages · v0.3 UI

The React frontend lives in **web/** and uses the real Phi5 protocol implementation in **src/phi5.js**. The original no-dependency HTML/Node laboratory remains available from the repo root.

## What the public GitPage can do

- Advertise a self-declared virtual device manifest
- Discover another tab visiting the **same GitHub Pages origin**, through BroadcastChannel
- Invite that peer, explicitly approve or decline a session, negotiate directions
- Send only the supported \`display.message\` or \`status.ping\` capability
- Show a virtual screen, peer/session cards, acknowledgement receipts
- Run a deterministic two-device in-memory protocol proof

**This is a browser-tab lab, not cross-device LAN discovery.** Different computers viewing the GitPage do not connect to each other. No user accounts, server, real OS devices, LAN scanning, remote display casting, or kernel drivers are involved. A browser must support BroadcastChannel and \`crypto.randomUUID()\`, which are available in modern secure contexts.

## Preview locally

From the repository root with Node 22 installed:

\`\`\`sh
npm --prefix web install
npm --prefix web run dev
\`\`\`

Open the URL Vite prints (typically \`http://127.0.0.1:5173/Phi5/\`), then click **OPEN PEER TAB**. Use **FIND PEERS**, **INVITE DEVICE**, **APPROVE**, and **SEND MESSAGE**. Inspect the receiver's virtual screen and the sender's acknowledgement receipt.

Run the protocol tests independently:

\`\`\`sh
npm test
\`\`\`

The original LAN test server is still available:

\`\`\`sh
npm run lan
\`\`\`

That server serves the **original local demo**, not the React GitHub Pages site. LAN mode intentionally requires a private-network host, room-code admission, and the separate Phi5 user approval. It is **plaintext HTTP** and not suitable for secrets or real hardware commands.

## GitHub Pages deployment

After the PR is merged into main:

1. Open **Repository Settings → Pages**.
2. Set **Build and deployment → Source: GitHub Actions**, if it is not already selected. This must be enabled by a repository owner; merely adding a workflow does not guarantee Pages is configured.
3. Open **Actions → Publish Phi5 React GitPage**. The workflow should build and deploy from \`main\`. If no push run was queued (e.g. Pages was configured after the merge), trigger **Run workflow** manually.
4. After a successful deployment, load **https://michaelwave369.github.io/Phi5/**.
5. Open a second tab of the **same URL** for discovery and exchange, or run the simulated proof in one tab.

The workflow uploads **only web/dist**, compiled with Vite's \`base: "/Phi5/"\`. The Node LAN server is **never** deployed to Pages. GitHub Actions test builds on PRs are separate from production Pages deployments.

## Review checklist

- [ ] \`npm test\` passes
- [ ] React build passes CI on the PR
- [ ] On the GitPage, the simulated proof reports 4 PASS
- [ ] Two tabs discover each other and exchange approved messages
- [ ] Declined invitations never authorize exchange
- [ ] No claims of driverless physical-device operation or encrypted LAN transport
