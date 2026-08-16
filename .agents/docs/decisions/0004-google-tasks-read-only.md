---
description: "Import Google Tasks as a stable, remote-authoritative read-only workspace."
keywords: [google-tasks, import, sync, read-only]
---

# Treat Google Tasks workspaces as read-only imports

## Context

Google Tasks identity and behavior differ from Onyx, and bidirectional mutation would add conflict and fidelity risks.

## Options considered

- One-time import
- Bidirectional synchronization
- Re-runnable read-only synchronization

## Decision

Represent Google Tasks as a distinct read-only workspace mode. Google is authoritative; stable UUID v5 mapping preserves local identity across refreshes.

## Consequences

Users can browse imported tasks without risking remote mutations. Local edits in that workspace are not authoritative. OAuth and complete hierarchy/order import remain active work.
