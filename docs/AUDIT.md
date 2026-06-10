# Onyx — Full Project Audit

**Date:** 2026-06-10
**Commit audited:** `c5a3840` (`origin/main`, merge of PR #66)
**Scope:** `onyx-core`, `onyx-cli`, the Tauri backend (`apps/tauri/src-tauri`), the
Svelte 5 frontend (`apps/tauri/src`), the `tauri-plugin-credentials` plugin, docs,
tests, dependencies, and project hygiene.
**Method:** Five parallel review passes (core security, Tauri-layer security, Rust
correctness, Svelte correctness, docs/tests/hygiene) plus tooling runs (`cargo test`,
`cargo clippy`, `vitest`, `npm audit`). Every HIGH finding was re-read and confirmed
against the source; the two most serious security items were reproduced empirically.

> **Status:** assessment only — no application code was changed by this audit.
> This is a point-in-time *standing-findings* report. It is distinct from the root
> `Audit.md`, which is a running "found and fixed" changelog. Several issues recorded
> there are already fixed on `main`; see *Already fixed* at the end.

---

## Executive summary

No critical security hole is *reachable from the UI*: the frontend escapes all output
and ships a real, non-null CSP, so the credential-exfiltration paths are latent. The
material risk is twofold:

1. **One HIGH, externally-triggerable security bug** — a malicious/compromised WebDAV
   server can write or delete arbitrary files on a Windows client via a path-traversal
   gap (S1), plus a one-byte PROPFIND payload can panic the sync thread (S2).
2. **Six data-integrity bugs that fire in normal use** — silent task loss/corruption
   on same-title writes, post-upload false conflicts that revert edits, a CLI/GUI sync
   mismatch that guts local folders, subtask orphaning on move, dropped in-progress
   edits, and broken drag-reorder.

`cargo test` is green (164). `vitest` is **red** (1/25) in this environment due to a
timezone-dependent test that also points at a real cross-tool date bug. There is **no
CI** to catch either.

### Severity tally

| Severity | Count | Theme |
|---|---|---|
| High | 8 | 6 data-loss/corruption bugs + 2 externally-triggerable security bugs (path traversal, panic) |
| Medium | ~18 | Sync robustness, latent credential exposure, frontend state races, memory/recursion DoS |
| Low | many | Hardening, quality, doc drift, hygiene, test gaps |

### Fix priority

1. **S1** — the only critical issue: a one-line `validate_sync_path` gap gives a remote
   server arbitrary file write/delete on Windows clients.
2. **D1 + D2 + D3** — the three silent data-loss bugs in routine use. D2 is the most
   damaging because it actively reverts user edits and undermines the sync feature.
3. **S2** (remote-triggerable panic) and the frontend data-loss pair **D5 / D6**.
4. **Add CI** (`cargo test` + `cargo clippy` + `vitest` + `npm audit`); fix the
   timezone-flaky `grouping.test.ts`; `npm audit fix`.
5. Medium sync/robustness items (timeout progress, corrupt-file resilience, recursion
   and unbounded-buffer DoS, conflict-recovery parse-failure loss).
6. Doc fixes and hygiene (`.idea/` untracking, plugin metadata, CI claim).

---

## 1. High — security (externally triggerable)

### S1 — Path traversal: a malicious WebDAV server gets arbitrary file write/delete (Windows)
`crates/onyx-core/src/sync.rs:685-697`

`validate_sync_path` rejects only `..` components and backslashes:

```rust
if path.contains('\\') { return Err(...); }
for component in path.split('/') {
    if component == ".." { return Err(...); }
}
```

It does **not** reject drive-letter / drive-absolute paths. A server's PROPFIND href of
`C:/x.md` passes `is_syncable` (`sync.rs:419`, two parts ending `.md`) and
`validate_sync_path`, then the download arm computes
`workspace_path.join("C:/x.md".replace('/', "\\"))` (`sync.rs:840`) → on Windows this
**discards the workspace base** and resolves to `C:\x.md`, which `atomic_write` then
fills with server-controlled bytes (`sync.rs:844`). The same `join` pattern backs the
`Conflict` (`sync.rs:744`, arbitrary overwrite), `DeleteLocal` (`sync.rs:853`, arbitrary
delete), and `Upload` arms. Empirically confirmed on a Windows host that the join drops
the base. NTFS alternate-data-stream sub-case also passes (`list/evil:stream.md`), since
sync downloads never run `sanitize_filename`.

**Fix:** in `validate_sync_path`, reject any segment containing `:` and reject a joined
path that is absolute / has a path `Prefix` component.

### S2 — `percent_decode` panics on a crafted PROPFIND href (remote DoS)
`crates/onyx-core/src/webdav.rs:266-282`

```rust
if bytes[i] == b'%' && i + 2 < bytes.len() {
    if let Ok(val) = u8::from_str_radix(&s[i + 1..i + 3], 16) { ... }
}
```

`&s[i+1..i+3]` byte-slices a `&str`; a multibyte UTF-8 char straddling that range
panics ("byte index is not a char boundary"). Reproduced: `percent_decode("%A€")` and
`percent_decode("%4€")` both panic. The input is server-supplied (every href flows
through `extract_relative_path` → `percent_decode`), so a single hostile PROPFIND
response crashes the sync task. **Fix:** slice `&bytes[i+1..i+3]` / use `s.get(...)` and
bail on `None`.

---

## 2. High — data loss & integrity (normal use)

### D1 — Two tasks with the same title overwrite each other
`crates/onyx-core/src/storage.rs:239-247, 363-377, 382`

The task filename is derived only from the sanitized title (`task_file_path`). In
`write_task`, the cleanup loop removes only files whose frontmatter id equals *this*
task's id, then `atomic_write` writes to the title-derived path. A second task titled
"Buy milk" resolves to the same file and overwrites (destroys) the first; its id is left
dangling in `task_order`, and `list_tasks` dedup cannot recover a file that is already
gone. Reachable via create, `update_task` rename, and `move_task` into a list holding a
same-titled task. (The Google importer guards this with a UUID suffix at
`google_tasks.rs:332-348`; the primary write path does not.)

### D2 — Every upload poisons the next sync (false conflicts revert edits)
`crates/onyx-core/src/sync.rs:736-740` vs `:167`

On upload, sync state records the **local** file mtime as `modified_at`. Remote-change
detection compares it to the server's `getlastmodified` HTTP-date
(`r.size != b.size || !timestamps_equal(r.last_modified, b.modified_at)`). Sizes match
after upload, so it hinges on timestamps that are never equal → `remote_changed` is
always true on the next sync. With no edit it's a spurious re-download; **with a local
edit in the window (likely under 60 s auto-sync) it becomes a `Conflict`, remote (older)
content wins, and the user's newer edit is demoted to a `[RECOVERED FROM CONFLICT]`
duplicate.** **Fix:** after PUT, record the server's authoritative `getlastmodified`
(re-PROPFIND or parse the PUT response), or detect remote change by checksum/ETag.

### D3 — CLI `sync` ignores `webdav_path` and guts the local folder
`crates/onyx-cli/src/commands/sync.rs:72-96` vs `apps/tauri/src-tauri/src/lib.rs:843-846`

The Tauri backend syncs against `webdav_url + "/" + webdav_path`; the CLI uses
`webdav_url` alone. For a workspace configured with a non-empty `webdav_path`, the CLI
syncs the base URL → real files sit below `is_syncable` depth → remote looks empty →
the diff emits `DeleteLocal` for every unchanged local file and uploads to the wrong
remote location. Credential-key divergence compounds it: Tauri's `credential_domain`
keeps `host:port` (`lib.rs:77-83`) while the CLI's `extract_domain` strips the port
(`sync.rs:186`), so on a non-default port the two look up different keys.

### D4 — `move_task` orphans subtasks
`crates/onyx-core/src/repository.rs:79-95`; `apps/tauri/src/lib/components/TaskDetailView.svelte:200-210`

`move_task` moves only the single task file; it neither cascades subtasks nor clears
`parent_id`. Moving a parent leaves its children in the source list with a `parent_id`
pointing into another list — they are filtered out of pending/completed (`!parent_id`)
and `childrenMap` can't place them, so they become invisible in every view. Moving a
subtask alone leaves a dangling cross-list `parent_id`. The frontend offers "Move to…"
unconditionally and only removes the parent from local state. (`delete_task`/`toggle_task`
*do* cascade in the Tauri layer — `move_task` is the gap.)

### D5 — In-progress debounced edits dropped on back-navigation
`apps/tauri/src/lib/components/TaskDetailView.svelte:21-26, 50-55`

The `$effect` cleanup only `clearTimeout(saveTimer)`; there is no save-on-blur and no
flush-on-destroy. The panel is `{#key parentTask.id}`-rendered, so pressing Escape,
clicking back, or switching lists within the 400 ms debounce unmounts the component and
drops the entire pending edit. (CLAUDE.md's "snapshots task before timer / auto-save on
blur" still does not match the code; the changelog's "save both fields" fix is a
different bug.)

### D6 — Drag-and-drop reorder uses the wrong index domain
`apps/tauri/src/lib/screens/TasksScreen.svelte:233-234`; `apps/tauri/src/lib/stores/app.svelte.ts:56, 322-330`; `crates/onyx-core/src/repository.rs`

The frontend computes the drop index within filtered `pendingTasks` (backlog, top-level
only), but `reorder_task` inserts at that index in the full `task_order` (completed tasks
and subtasks included). Any completed task or subtask ordered before the target shifts
the drop. In grouped mode it is worse — the flat index has no relation to the grouped,
date-sorted visual order.

---

## 3. Medium

### Security — core (`onyx-core`)
- **10 MB caps don't bound memory** — `webdav.rs:108-114, 136-142`. The pre-check trusts
  `Content-Length` (omittable via chunked → `unwrap_or(0)` passes); `resp.bytes()` then
  buffers the whole body before the size check. `google_tasks.rs:111, 193` `resp.json()`
  has no cap. Stream with a running byte budget.
- **`scan_remote_files` unbounded recursion** — `sync.rs:482-509`. No depth limit or
  visited-set; a hostile server can drive unbounded sequential PROPFINDs and future
  growth. Partially mitigated by the 60 s sync timeout (`sync.rs:579-585`).
- **No redirect policy / `https_only`** — `webdav.rs:40-44`, `google_tasks.rs:88-92`.
  HTTPS is enforced only on the base URL; a 30x can downgrade file/PROPFIND traffic to
  `http://` (a same-host downgrade still exposes the Google bearer token and WebDAV
  bodies in plaintext). Set `.redirect(Policy::none())` and `.https_only(true)`.

### Security — Tauri layer (latent; gated by CSP + no XSS sink)
- **WebDAV credentials returned to the webview in plaintext** — `lib.rs:807-814`,
  invoked at `SettingsScreen.svelte:44`. Combined with arbitrary-URL WebDAV commands
  (`test_webdav_connection`, `list_remote_folder`, `inspect_remote_workspace`,
  `create_remote_workspace`, `lib.rs:670-759`) this is a CSP-bypassing exfiltration
  channel if XSS ever lands. Keep credentials backend-only; pin command URLs to the
  workspace host.
- **Google access + refresh tokens round-trip through the webview** during setup —
  `lib.rs:1037-1041`, `SetupScreen.svelte:187-195`. Steady-state sync keeps them
  backend-side; only the setup flow exposes them. Store the refresh token directly from
  the backend.
- **`set_webdav_config` leaves `webdav_path` stale** — `lib.rs:604-615`. Re-pointing a
  workspace's URL keeps the old `webdav_path`, which is then concatenated at sync time
  → the same mass-`DeleteLocal`/misdirected-upload failure mode as D3.

### Correctness — core / CLI
- **60 s timeout discards all sync progress** — `sync.rs:579-585, 677`. State and the
  failed-action queue are persisted only at the end; a timeout abort loses every
  executed action's state update → next run re-derives from a stale baseline and
  produces "both added" conflicts.
- **Conflict recovery silently loses the local edit on parse failure** — `sync.rs:772,
  782`. Local is overwritten with remote content first, then the `[RECOVERED FROM
  CONFLICT]` duplicate is created only `if let Ok(parse(local))` — on parse failure the
  local content is already gone and nothing is recorded.
- **One corrupt file bricks the whole workspace view** — `storage.rs:198-199, 325-326,
  424-425, 562-563`. `list_dir_path`, `read_task`, `list_tasks`, `get_lists` all
  `?`-propagate a parse error from any file scanned. Skip-and-warn per file.
- **First sync of pre-populated both-sides folders sprays duplicates** — `sync.rs:189-192`.
  `(Some, Some, None)` → `Conflict`; identical content is detected as a false conflict
  and skipped, but any benign pre-existing difference yields "remote wins + local
  recovered as duplicate" on first sync.
- **`last_sync` advances on a failed remote scan (Tauri level)** — `lib.rs:875-877` sets
  `ws.last_sync = now` on any `Ok` return, including when `result.errors` carries the
  scan failure. (Core `SyncState.last_sync` is correctly guarded; the config-level UI
  value is not.)
- **Remove-before-write on rename** — `storage.rs:371, 382`. `write_task` removes the
  old-named file before writing the new; a crash in that window leaves neither. (Body
  writes are otherwise atomic now — see *Already fixed*.)
- **List-name handling** — `create_list` → `list_dir_path_by_name` (`storage.rs:210-237`)
  rejects traversal but does **not** `sanitize_filename` the directory name (reserved
  device names / Windows-invalid chars slip through, unlike task files). Case-only
  `rename_list` is rejected on case-insensitive filesystems (`storage.rs:625`); 500-char
  titles can exceed the Windows ~260-char path limit.

### Correctness — frontend
- **Parent toggle cascade not reflected in store** — `app.svelte.ts:293-310` patches only
  the toggled task; cascaded subtask status stays stale until a reload.
- **Stale-response race in `loadTasks`** (and `loadLists`/`setGroupByDate`) —
  `app.svelte.ts:219-239`. No request token; a list switch or `fs-changed`-triggered
  reload in flight can render the previous list's tasks under the new header.
- **Stuck "Creating…/Syncing…" buttons** — `app.svelte.ts:498-539`,
  `SetupScreen.svelte:161-219`. The store add-workspace functions swallow errors and
  never rethrow, so the SetupScreen `catch` that resets `creating` never fires; a failed
  add disables the button permanently.
- **DateTimePicker not in the Escape chain / no focus trap** — the ConfirmDialog
  Escape/focus issue is fixed and tested, but DateTimePicker still isn't intercepted by
  the global chain (window Escape pops the detail panel behind it) and neither dialog
  traps Tab.

---

## 4. Low / quality

- **`serde_yaml 0.9.34+deprecated`** is unmaintained/archived upstream — plan a migration.
- `types.ts` declares `| null` for fields Rust omits entirely (`skip_serializing_if` →
  `undefined`); no `svelte-check`/`tsc` in the build (`package.json` `build` is plain
  `vite build`), so that drift is never caught.
- `watcher-error` is emitted (`lib.rs:1213`) but **no frontend code listens for it**
  (only `fs-changed`); watcher failures are silent. The payload can also include a path.
- `osDark` is captured once as a non-reactive `let` with no `matchMedia` change listener
  (`app.svelte.ts:37`); OS theme switches need a restart for System-default workspaces.
- Grouped "today" boundary is computed at derivation time (`grouping.ts:15`, called at
  `app.svelte.ts:59-62` with no time dependency) → stale across midnight for an idle app.
- OAuth loopback has no CSRF `state` nonce and a single `accept()` with no timeout
  (`lib.rs:928-942, 948`): fails on Chrome speculative/favicon connections, hangs if the
  browser is closed.
- `validate_workspace_path` doesn't canonicalize (`lib.rs:95-122`); UNC / `\\?\` / arbitrary
  system dirs pass. `watch_workspace` (`lib.rs:1247-1250`) starts a recursive watcher with
  no path validation. `rename_workspace`'s local branch does an unsanitized `fs::rename`
  on a webview-supplied name (`lib.rs:273-278`) with no `..`/separator check.
- Google OAuth tokens held in plain `String` (not `Zeroizing`, unlike WebDAV creds);
  refresh-failure error embeds the raw response body (`google_tasks.rs:84, 184-185`).
- `SyncLock` 5-min stale cleanup never refreshes the lock mtime (`sync.rs:19-36`); a sync
  exceeding 5 min could let a second process delete the live lock (low likelihood given
  the 60 s timeout).
- Embedded Google `client_secret` (`lib.rs:34`) — structurally an installed-app concern,
  currently a placeholder (no real secret committed).

---

## 5. Tooling results

### Tests
- **`cargo test` — 164 passed, 0 failed.** Green.
- **`vitest` — 24 passed, 1 failed.** `grouping.test.ts` "orders dated buckets" fails:
  expected `"Tomorrow"`, got `"Sun, Apr 19"`. **Root cause: a timezone bug.** `grouping.ts`
  computes bucket boundaries in *local* time, but the test fixtures anchor date-only
  tasks at UTC midnight (`2026-04-18T00:00:00Z`); in a west-of-UTC runtime those resolve
  to the previous local day, so the test fails outside a UTC/east-of-UTC band. The GUI
  `DateTimePicker` stores dates as local-midnight→UTC (`new Date(y,m,d,h,m).toISOString()`)
  so GUI-created tasks round-trip consistently — but the **CLI and Google import store
  date-only as UTC midnight**, which is exactly the failing shape, so cross-tool
  date-only tasks *can* land in the wrong day bucket in the GUI for non-UTC users. The
  suite is timezone-non-deterministic and currently red here, with no CI to catch it.

### Lint
- **`cargo clippy` — clean** apart from 1 warning (`&PathBuf` instead of `&Path`).

### Dependencies
- **`npm audit` — 5 vulnerabilities (3 high, 2 moderate):** vite (path traversal /
  dev-server WS file read), svelte (SSR XSS — N/A to this SPA), devalue, picomatch
  (ReDoS), postcss. All dev/build-time; all fixed by `npm audit fix`.
- **Rust:** `serde_yaml` unmaintained (above); `cargo-audit` not installed (add to CI).

---

## 6. Documentation vs reality

Mostly reconciled on `main` (see *Already fixed*). Remaining:
- **"30 s window-focus stale threshold" is wrong** — re-focus actually uses the
  configurable focused interval (default 60 s) plus a separate unfocused interval
  (default 600 s). Appears in CLAUDE.md:41/94, PLAN.md:517, docs/API.md:403.
- **CLAUDE.md:91** still says "2-step mode selection (Local Folder vs WebDAV Server)" —
  SetupScreen now has three modes (adds Google Tasks).
- **PLAN.md:512** still shows `load_credentials -> Result<(String, String)>`; the real
  return is a `Zeroizing<String>` pair (docs/API.md is already correct).
- DEVELOPMENT.md documents an integration-tests `tests/` layout that doesn't exist.

---

## 7. Project hygiene

- **`.idea/` is still tracked** (4 files, incl. `bevy-tasks.iml` leaking a former project
  name) despite being gitignored — `git rm -r --cached .idea`.
- **`tauri-plugin-credentials/Cargo.toml`** is the only crate missing `license` /
  `description` / `repository`.
- **No CI** (`.github/workflows/` absent) despite PLAN.md claiming GitHub Actions.
- **No integration tests** (`crates/*/tests/` absent); `wiremock` is a declared-but-unused
  `onyx-core` dev-dependency.
- LICENSE is GPL-3.0 text matching the manifests' `GPL-3.0-or-later`; README/PLAN label
  it `GPL-3.0` (cosmetic only).
- **Test gaps:** `google_tasks.rs` (0 Rust tests), all Tauri command handlers, most of
  the CLI, and the frontend `app.svelte.ts` store + `dateFormat.ts` + all screens +
  TaskDetailView/NewTaskInput/TaskItem are untested.

---

## 8. Verified good (checked, not assumed)

- CSP present and non-null (`tauri.conf.json:26`, `connect-src ipc:`-only — no webview
  HTTP egress); no `{@html}`/`innerHTML`/`eval`/dynamic-`href` anywhere in the frontend;
  task content renders only through escaped Svelte interpolation.
- Capabilities minimal and window-scoped (no `fs:`/`shell:`/`http:`); no updater;
  `withGlobalTauri: false`.
- Credentials use the OS keychain (desktop) / EncryptedSharedPreferences + Android
  Keystore (Android), scoped per `domain::username`, with legacy-key migration; never in
  error strings.
- Every IPC id param parsed via a `parse_uuid` helper; core length caps (title/desc/list/
  64 KB frontmatter) enforced before use.
- WebDAV rejects non-HTTPS base URLs, zeroizes its credentials, uses rustls with cert
  validation on; reqwest strips `Authorization` on cross-host redirects.
- 64 KB frontmatter cap enforced *before* YAML parse; quick-xml does not expand DTD/custom
  entities (no billion-laughs); no YAML injection via titles (titles are filenames).
- `SyncLock` releases on every path including timeout cancellation; metadata-before-file
  delete ordering correct; Tauri-backend mutexes never held across `.await`.
- Task-body and sync-download writes are atomic (temp + rename).

---

## 9. Already fixed on `main` (since the prior internal review)

For fairness, these issues from earlier reviews are confirmed resolved in `c5a3840`:
- `due` → `date` rename reconciled across all docs and the previously-failing frontmatter
  test; `cargo test` is green.
- Google Tasks documented in CLAUDE.md / PLAN.md / docs/API.md; docs/API.md signatures
  match code.
- Frontend tests introduced (vitest: grouping, paths, ConfirmDialog, DateTimePicker).
- CLI `--workspace` resolution unified (UUID-then-name).
- Swallowed errors fixed: `toggle_task` cascade now propagates; Google Tasks metadata
  write failures now surface in `errors`.
- Task-body / sync-download writes made atomic; atomic-write helper de-duplicated.
- Frontend: focus-listener leak, `removeWorkspace` stranding, SettingsScreen field
  clobber-on-tick, DateTimePicker month-rollover/highlight (fixed *and* tested),
  taskStack empty-panel, and the ConfirmDialog Escape/focus-trap issues.
- Cargo metadata (license/description/repository) added to the three main crates.

---

*Generated by an automated multi-agent code review. Line references are against commit
`c5a3840`.*
