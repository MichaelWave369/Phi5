# Φ5 | Phi5

**Give your devices a high five.**

An open experiment in capability-based, permission-first device communication.

This repository is being bootstrapped through a reviewable pull request. Phi5 is not a kernel driver, a replacement for existing device drivers, or a claim of universal hardware compatibility.

## Principles

1. **Find** peers using an available transport.
2. **Identify** capabilities with a machine-readable manifest.
3. **Invite** a specific peer into a session.
4. **Authorize** explicitly before exchanging commands.
5. **Exchange** only negotiated, permitted messages, with receipts.

**License:** MIT (proposed in the initial implementation PR).
