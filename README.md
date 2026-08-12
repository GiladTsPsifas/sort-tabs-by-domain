# Sort Tabs by Domain

- [What it does](#what-it-does)
- [Install](#install)
- [Duplicate rules](#duplicate-rules)
- [Undo](#undo)
- [Permissions](#permissions)
- [License](#license)

## What it does

Chrome extension **1.3.1**. One toolbar click in the **current window**:

1. **Dedupe** — close duplicate tabs in the same window.  
   (Keeps one; never closes pinned; prefers active / shorter URL.)
2. **Sort** — group unpinned tabs by **hostname → path → title**.

## Install

1. Clone this repository: https://github.com/GiladTsPsifas/sort-tabs-by-domain
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this repository’s root folder (the one with `manifest.json`)
5. **Reload** the extension after pulling code changes

## Duplicate rules

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

## Undo

After a run, the badge shows **U**. Within **60s**, undo with `⌘⇧Y` / `Ctrl+Shift+Y`.

Shortcuts: `chrome://extensions/shortcuts`

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Read URLs; move / create / remove tabs |
| `storage` | Undo snapshot + options |
| `alarms` | Clear undo badge after TTL |

## License

MIT — see [LICENSE](LICENSE).
