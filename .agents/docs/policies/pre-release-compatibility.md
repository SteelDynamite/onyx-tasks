---
description: "Must read before changing on-disk, config, sync, or credential formats; defines pre-alpha migration policy."
keywords: [pre-alpha, migrations, compatibility]
---

# Do not add migrations before release

## Rule

Onyx is pre-alpha with no released builds or user data. Prefer the simplest correct current schema. Do not add migration logic for prior on-disk, configuration, or sync formats unless release status changes or the user explicitly requests it.

Update all canonical examples and tests when changing a format.

## Applies to

Workspace files, task frontmatter, application configuration, sync state/queue formats, and credential key conventions.
