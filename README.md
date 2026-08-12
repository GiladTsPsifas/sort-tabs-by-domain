# Sort Tabs by Domain

Chrome extension **1.3.1**: one toolbar click in the **current window**:

1. **Dedupe** — close tabs that match under your **configurable** URL rules (keeps one; never closes pinned; prefers active / shorter URL)
2. **Sort** unpinned tabs: **hostname → path → title**

No tab grouping (Chrome cannot name the OS window from an extension).

## Options (duplicate rules)

Right-click the extension → **Options**, or open details → **Extension options**.

| Setting (default) | Effect |
|-------------------|--------|
| Trailing slash **on** | `/path` ≡ `/path/` |
| Same GitHub/GitLab PR **on** | `/pull/121` ≡ `/pull/121/changes` (files, commits, checks, …) |
| Ignore hash **on** | ignore `#fragment` |
| Strip tracking params **on** | drop `utm_*`, `fbclid`, `gclid`, … |
| Ignore all query **off** | if on, only host + path must match |
| http ≡ https **on** | scheme ignored for matching |
| Strip www **off** | optional `www.` collapsing |
| Sort query params **on** | param order ignored |
| Lowercase host **on** | host case-insensitive |

Changes save as you toggle (synced via `chrome.storage.sync`).

## Undo (60 seconds)

Badge **U** after a run. Within **60s**: `⌘⇧Y` / `Ctrl+Shift+Y`.

Shortcuts: `chrome://extensions/shortcuts`

## Install (Load unpacked)

1. Clone this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this repository’s root folder (the one with `manifest.json`)
5. **Reload** the extension after pulling code changes

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | URLs, move/create/remove |
| `storage` | Undo snapshot + options |
| `alarms` | Clear undo badge after TTL |

## License

MIT — see [LICENSE](LICENSE).
