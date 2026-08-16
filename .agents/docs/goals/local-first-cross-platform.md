---
keywords: [local-first, cross-platform, workspaces, performance]
---

# Local-first cross-platform task management

## Intent

Give users fast task management while keeping data in user-selected, portable folders. Support multiple contexts and desktop/mobile platforms from one core implementation.

## Implications

- Local files remain authoritative for local workspaces.
- Optional sync must not make offline task management unavailable.
- Workspace files stay inspectable and usable by Markdown tools.
- Platform frontends share `onyx-core`; platform-specific code stays at integration boundaries.
- Prefer responsive local operations and background network work.
