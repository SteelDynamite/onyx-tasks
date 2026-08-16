---
status: in-progress
keywords: [google-tasks, oauth, import, onboarding]
---

# Complete Google Tasks integration

## Goal

Provide a safe, understandable read-only Google Tasks workspace with reliable refresh and onboarding.

## Current state

The core client, stable UUID mapping, workspace mode, and Tauri commands exist. OAuth credentials are placeholders and end-to-end UI import is incomplete.

## Scope

- Complete OAuth with production credentials and secure token handling.
- Import lists, tasks, dates, notes, hierarchy, and ordering.
- Make read-only/remote-authoritative behavior explicit in UI.
- Provide account onboarding, refresh, errors, and removal.

## Done when

A user can connect an account, browse faithfully imported tasks, refresh them, and disconnect safely.
