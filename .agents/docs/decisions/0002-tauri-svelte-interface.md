---
description: "Read before changing GUI technology or frontend/core boundaries; explains the Tauri, Svelte, and shared Rust core choice."
keywords: [tauri, svelte, tailwind, gui, mobile]
---

# Use Tauri and Svelte for the GUI

## Context

The GUI must reuse the Rust core across desktop and mobile while supporting rapid, responsive UI development.

## Options considered

- Native UI implementations per platform
- A Rust-rendered GUI
- Tauri v2 with a web frontend

## Decision

Use Tauri v2, Svelte 5 runes, and Tailwind CSS 4. Expose `onyx-core` through thin Tauri commands.

## Consequences

Core behavior stays shared and binaries remain smaller than an Electron application. UI code uses web-platform patterns. Mobile support depends on Tauri and native plugin integration; platform-only dependencies must remain feature/cfg gated.
