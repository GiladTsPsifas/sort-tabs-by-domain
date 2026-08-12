/**
 * On toolbar click (current window):
 * 1. Snapshot for undo (60s).
 * 2. Close URL duplicates using configurable normalization rules.
 * 3. Sort unpinned: hostname → path → title.
 *
 * Undo: Ctrl/Cmd+Shift+Y while badge shows "U".
 * Options: right-click extension → Options.
 */

importScripts("common.js");

const UNDO_TTL_MS = 60_000;
const STORAGE_KEY = "undo_snapshot";

function domainKey(url) {
  if (!url) {
    return "~";
  }
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.hostname.toLowerCase();
    }
  } catch (_) {
    // ignore
  }
  return "~";
}

function pathKey(url) {
  if (!url) {
    return "";
  }
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return (u.pathname + u.search).toLowerCase();
    }
  } catch (_) {
    // ignore
  }
  return "";
}

function tabSnapshot(tab) {
  return {
    url: tab.url || "",
    index: tab.index,
    pinned: Boolean(tab.pinned),
    active: Boolean(tab.active),
  };
}

function compareTabs(a, b) {
  const da = domainKey(a.url);
  const db = domainKey(b.url);
  if (da !== db) {
    return da.localeCompare(db);
  }
  const pa = pathKey(a.url);
  const pb = pathKey(b.url);
  if (pa !== pb) {
    return pa.localeCompare(pb);
  }
  const ta = (a.title || "").toLowerCase();
  const tb = (b.title || "").toLowerCase();
  if (ta !== tb) {
    return ta.localeCompare(tb);
  }
  return a.index - b.index;
}

/**
 * Prefer active tab, else shorter URL (no trailing slash / fewer junk params),
 * else leftmost.
 * @param {chrome.tabs.Tab[]} unpinned
 * @param {number | undefined} activeTabId
 * @returns {chrome.tabs.Tab}
 */
function pickKeepTab(unpinned, activeTabId) {
  const active = unpinned.find((t) => t.id === activeTabId);
  if (active) {
    return active;
  }
  return unpinned.reduce((best, t) => {
    const a = best.url || "";
    const b = t.url || "";
    if (b.length !== a.length) {
      return b.length < a.length ? t : best;
    }
    return t.index < best.index ? t : best;
  });
}

/**
 * Close duplicate tabs by normalized key under dedupe settings.
 * Never closes pinned. Returns closed-tab snapshots for undo.
 * @param {chrome.tabs.Tab[]} tabs
 * @param {number | undefined} activeTabId
 * @param {DedupeSettings} settings
 * @returns {Promise<object[]>}
 */
async function closeNormalizedUrlDuplicates(tabs, activeTabId, settings) {
  /** @type {Map<string, chrome.tabs.Tab[]>} */
  const byKey = new Map();

  for (const tab of tabs) {
    const url = tab.url;
    if (!url) {
      continue;
    }
    const key = normalizeUrlForDedupe(url, settings);
    const list = byKey.get(key);
    if (list) {
      list.push(tab);
    } else {
      byKey.set(key, [tab]);
    }
  }

  /** @type {chrome.tabs.Tab[]} */
  const toClose = [];

  for (const group of byKey.values()) {
    if (group.length < 2) {
      continue;
    }

    const pinned = group.filter((t) => t.pinned);
    const unpinned = group.filter((t) => !t.pinned);

    if (pinned.length > 0) {
      for (const t of unpinned) {
        toClose.push(t);
      }
      continue;
    }

    const keep = pickKeepTab(unpinned, activeTabId);
    for (const t of unpinned) {
      if (t.id !== keep.id) {
        toClose.push(t);
      }
    }
  }

  if (toClose.length === 0) {
    return [];
  }

  const ids = toClose.map((t) => t.id).filter((id) => id != null);
  const closed = toClose.map(tabSnapshot);
  await chrome.tabs.remove(ids);
  return closed;
}

async function clearUndoBadge(windowId) {
  try {
    await chrome.action.setBadgeText({ text: "", windowId });
  } catch (_) {
    await chrome.action.setBadgeText({ text: "" });
  }
}

async function setUndoBadge(windowId) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#20788C", windowId });
    await chrome.action.setBadgeText({ text: "U", windowId });
  } catch (_) {
    await chrome.action.setBadgeBackgroundColor({ color: "#20788C" });
    await chrome.action.setBadgeText({ text: "U" });
  }
}

async function saveUndoSnapshot(snapshot) {
  await chrome.storage.session.set({ [STORAGE_KEY]: snapshot });
  await setUndoBadge(snapshot.windowId);
  await chrome.alarms.clear("clear-undo");
  await chrome.alarms.create("clear-undo", {
    when: snapshot.expiresAt,
  });
}

async function getUndoSnapshot() {
  const data = await chrome.storage.session.get(STORAGE_KEY);
  const snap = data[STORAGE_KEY];
  if (!snap) {
    return null;
  }
  if (Date.now() > snap.expiresAt) {
    await chrome.storage.session.remove(STORAGE_KEY);
    await clearUndoBadge(snap.windowId);
    return null;
  }
  return snap;
}

async function clearUndoSnapshot(windowId) {
  await chrome.storage.session.remove(STORAGE_KEY);
  await chrome.alarms.clear("clear-undo");
  await clearUndoBadge(windowId);
}

async function undoLastRun(preferredWindowId) {
  const snap = await getUndoSnapshot();
  if (!snap) {
    console.info("No undo available");
    return false;
  }

  const windowId = preferredWindowId ?? snap.windowId;

  const closed = [...(snap.closed || [])].sort((a, b) => a.index - b.index);
  for (const t of closed) {
    if (!t.url) {
      continue;
    }
    try {
      await chrome.tabs.create({
        windowId,
        url: t.url,
        active: false,
        pinned: Boolean(t.pinned),
        index: Math.max(0, t.index),
      });
    } catch (err) {
      console.warn("Undo recreate tab failed:", t.url, err);
    }
  }

  const current = await chrome.tabs.query({ windowId });
  /** @type {Map<string, chrome.tabs.Tab[]>} */
  const pool = new Map();
  for (const tab of current) {
    const key = tab.url || "";
    const list = pool.get(key);
    if (list) {
      list.push(tab);
    } else {
      pool.set(key, [tab]);
    }
  }

  const orderedIds = [];
  for (const desired of snap.order || []) {
    const key = desired.url || "";
    const list = pool.get(key);
    if (!list || list.length === 0) {
      continue;
    }
    let idx = list.findIndex((t) => Boolean(t.pinned) === Boolean(desired.pinned));
    if (idx < 0) {
      idx = 0;
    }
    const [picked] = list.splice(idx, 1);
    if (picked?.id != null) {
      orderedIds.push(picked.id);
    }
  }

  if (orderedIds.length) {
    await chrome.tabs.move(orderedIds, { index: 0 });
  }

  const activeDesired = (snap.order || []).find((t) => t.active);
  if (activeDesired?.url) {
    const now = await chrome.tabs.query({ windowId });
    const match = now.find((t) => t.url === activeDesired.url);
    if (match?.id != null) {
      try {
        await chrome.tabs.update(match.id, { active: true });
      } catch (_) {
        // ignore
      }
    }
  }

  await clearUndoSnapshot(snap.windowId);
  return true;
}

async function sortTabsInWindow(windowId, activeTabId) {
  const settings = await loadSettings();
  let tabs = await chrome.tabs.query({ windowId });
  const orderBefore = tabs.map(tabSnapshot);

  const closed = await closeNormalizedUrlDuplicates(tabs, activeTabId, settings);

  tabs = await chrome.tabs.query({ windowId });
  const pinned = tabs.filter((t) => t.pinned);
  const rest = tabs.filter((t) => !t.pinned);

  rest.sort(compareTabs);

  const ids = rest.map((t) => t.id).filter((id) => id != null);
  if (ids.length) {
    await chrome.tabs.move(ids, { index: pinned.length });
  }

  await saveUndoSnapshot({
    windowId,
    expiresAt: Date.now() + UNDO_TTL_MS,
    order: orderBefore,
    closed,
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId == null) {
    return;
  }
  try {
    await sortTabsInWindow(tab.windowId, tab.id);
  } catch (err) {
    console.error("Sort Tabs by Domain failed:", err);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "undo-last-run") {
    return;
  }
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    await undoLastRun(active?.windowId);
  } catch (err) {
    console.error("Undo failed:", err);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "clear-undo") {
    return;
  }
  const data = await chrome.storage.session.get(STORAGE_KEY);
  const snap = data[STORAGE_KEY];
  if (!snap) {
    await clearUndoBadge();
    return;
  }
  if (Date.now() >= snap.expiresAt) {
    await clearUndoSnapshot(snap.windowId);
  }
});
