---
description: "Must read before changing storage, sync, credentials, or import/export paths; defines validation, atomicity, and recoverability safeguards."
keywords: [storage, sync, security, atomic-writes, validation]
---

# Preserve storage and sync safety

## Rule

Do not weaken trust-boundary validation or recoverability for convenience.

- Keep documented input and response-size limits.
- Keep path traversal and workspace-root protections.
- Write metadata, config, sync state, and queues atomically with temporary-file cleanup.
- Order deletion/move operations so interruption leaves recoverable files rather than metadata pointing to missing data.
- Keep sync locking and stale-lock handling.
- Keep credentials in platform-secure storage and secret strings zeroized where supported.
- Update `docs/API.md` whenever exact limits or behavior change.

## Applies to

`onyx-core` storage/config/sync/WebDAV code, Tauri filesystem commands, credential plugins, and any new import/export path.
