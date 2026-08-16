---
description: "Store local-first workspaces as portable Markdown tasks with JSON metadata."
keywords: [storage, markdown, yaml, workspace, local-first]
---

# Store workspaces as Markdown files and metadata

## Context

Users need ownership, portability, direct filesystem access, and compatibility with Markdown tools while Onyx also needs stable identity and ordering.

## Options considered

- Application-owned database
- One aggregate workspace file
- One Markdown file per task plus JSON metadata

## Decision

A workspace is a user-selected folder. Each task is a Markdown file with YAML frontmatter. List folders contain `.listdata.json`; the workspace root contains `.onyx-workspace.json`. Exact schemas belong in `docs/API.md`.

## Consequences

Users can inspect, edit, sync, and back up tasks with ordinary tools. Metadata files are required for stable IDs and ordering. Filesystem edits and duplicate IDs must be handled safely. Multi-file operations are not database transactions, so ordering and atomic-write rules matter.
