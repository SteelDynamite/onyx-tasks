---
description: "Use when generating, building, or smoke-testing Android/iOS apps; provides prerequisites, commands, verification, and troubleshooting."
keywords: [mobile, android, ios, tauri, build]
---

# Build mobile applications

## Goal

Generate, build, and smoke-test Android and iOS applications.

## Preconditions

- Run from `apps/tauri/` after `npm install`.
- Android: Android Studio, NDK, `ANDROID_HOME`, `NDK_HOME`, and Rust Android targets.
- iOS: macOS with Xcode and required Rust targets.

## Steps

### Android

1. Run `npm run tauri android init` once.
2. Run `npm run tauri android dev` for device/emulator testing.
3. Run `npm run tauri android build` for release artifacts.

### iOS

1. Run `npm run tauri ios init` once on macOS.
2. Run `npm run tauri ios dev` for simulator/device testing.
3. Run `npm run tauri ios build` for release artifacts.

## Verification

Launch the app; create/open a workspace; create, edit, complete, and delete a task; restart and verify persistence. For WebDAV, verify credential storage and one sync cycle.

## Troubleshooting

- Confirm environment variables and Rust targets before changing code.
- If native crates fail, inspect Cargo features and target `cfg` gates for desktop-only dependencies.
- iOS cannot be built on Linux; use a Mac or macOS CI.
