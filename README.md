- [Duplication rules)](#options-duplicate-rules)
- [Undo option](#undo-60-seconds)
- [Installation guide](#install-load-unpacked)
- [Permissions](#permissions)
- [License](#license)

# Sort Tabs by Domain

Chrome extension **1.3.1**. One toolbar click in the **current window**:

1. **Dedupe** — close duplicated tabs in the same window.  
   (Keeps one; never closes pinned; prefers active / shorter URL.)
2. **Sort** — order unpinned tabs by **hostname → path → title**.



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

Toggles save automatically (`chrome.storage.sync`).

## Undo (60 seconds)

After a run, the badge shows **U**. Within **60s**, undo with `⌘⇧Y` / `Ctrl+Shift+Y`.

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
| `tabs` | Read URLs; move / create / remove tabs |
| `storage` | Undo snapshot + options |
| `alarms` | Clear undo badge after TTL |

## License

MIT — see [LICENSE](LICENSE).
