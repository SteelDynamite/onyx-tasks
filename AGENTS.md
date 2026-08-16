# AGENTS.md

## Project

Onyx is a pre-alpha, local-first task manager. Rust core and CLI live under `crates/`; the Tauri v2/Svelte 5 GUI lives under `apps/tauri/`. Workspaces are user-selected folders containing Markdown tasks with YAML frontmatter.

No releases or user data exist. On-disk, config, and sync formats may change without migrations.

## Commands

```bash
cargo build
cargo build -p onyx-cli
cargo test
cargo test -p onyx-core
cargo run -p onyx-cli -- <args>

cd apps/tauri
npm install
WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev
npm run tauri build
```

The CLI binary is `onyx`. Vite uses port 1422.

## Structure

- `crates/onyx-core/`: models, storage, repository, config, WebDAV sync, Google Tasks client
- `crates/onyx-cli/`: clap frontend; keep thin over `onyx-core`
- `apps/tauri/src/`: Svelte 5 runes frontend
- `apps/tauri/src-tauri/`: Tauri commands over `onyx-core`
- `apps/tauri/tauri-plugin-credentials/`: Android Keystore and desktop keychain integration
- `docs/API.md`: canonical API, on-disk format, and safety behavior
- `docs/DEVELOPMENT.md`: contributor setup and workflow
- `.agents/docs/`: goals, decisions, active features, policies, runbooks, and debt

Keep core free of CLI/UI dependencies. Keep Tauri commands thin. Preserve storage and sync safety invariants documented in `.agents/docs/policies/`.
