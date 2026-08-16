---
description: "Build and smoke-test shared Tauri task workflows on Android and iOS."
status: in-progress
keywords: [mobile, android, ios, tauri, build]
---

# Mobile platform support

## Goal

Build and smoke-test the Tauri application on Android and iOS without weakening shared architecture or storage safety.

## Current state

Android dependencies, credential storage, safe-area CSS, and Rust targets are prepared. Android generation/build verification and all iOS setup remain.

## Scope

- Generate and build Android projects.
- Smoke-test setup and task CRUD on a device/emulator.
- Establish macOS CI or a Mac environment for iOS.
- Generate, build, and smoke-test iOS.
- Verify watcher and desktop-only dependency gating on both targets.

## Done when

Android and iOS builds launch and basic workspace/task flows pass on representative devices.
