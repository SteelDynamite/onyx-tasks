---
description: "Must read before adding domain behavior or frontend commands; defines Rust core and platform boundary rules."
keywords: [architecture, core, cli, tauri, frontend]
---

# Architecture boundaries

## Rule

Keep domain, storage, configuration, and sync behavior in `onyx-core`. Keep CLI handlers and Tauri commands thin. Platform credential, filesystem-picker, watcher, and window behavior belongs at platform boundaries. Frontend state may coordinate UI but must not reimplement core persistence rules.

When adding behavior, update the model, storage/repository API, and tests before exposing it through frontends.

## Applies to

All Rust crates, Tauri commands/plugins, and Svelte frontend code.
