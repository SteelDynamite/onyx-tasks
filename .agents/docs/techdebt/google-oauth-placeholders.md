---
status: backlog
keywords: [google-tasks, oauth, credentials]
---

# Google OAuth uses placeholders

## Debt

The Google Tasks OAuth flow has placeholder client credentials and is not production-ready.

## Impact

Users cannot reliably complete supported Google Tasks onboarding; shipped placeholders would create security and operational failures.

## Why we took it

The client, identity mapping, workspace mode, and command boundaries were implemented before production OAuth registration and consent configuration.

## Retirement condition

Production credentials/configuration, redirect handling, secure token storage, consent setup, and end-to-end tests are complete.
