---
description: "Must read before changing WebDAV conflict handling; explains deterministic remote-wins resolution and local-content recovery."
keywords: [webdav, sync, conflicts, offline, recovery]
---

# Use three-way WebDAV sync with recoverable conflicts

## Context

Workspaces can change locally and remotely, including while offline. Silent data loss is unacceptable, but interactive conflict resolution would block background sync.

## Options considered

- Last-write-wins
- Stop and require manual conflict resolution
- Deterministic remote-wins with local recovery

## Decision

Compare local, remote, and the last baseline. Queue operations while offline. For genuine divergent edits, remote wins and the local task is recovered as a duplicate with a new UUID and `[RECOVERED FROM CONFLICT]` title prefix. Equal checksums are not conflicts.

## Consequences

Sync is deterministic and can run unattended without discarding local content. Users may need to reconcile recovered duplicates. Sync state, queue, locking, path validation, response limits, and operation ordering are safety-critical.
