/**
 * Shared settings + URL normalization for dedupe.
 * Loaded by background (importScripts) and options page (<script>).
 */

/** @type {const} */
const SETTINGS_STORAGE_KEY = "settings";

/** Built-in tracking / analytics query keys (lowercase). */
const TRACKING_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_cid",
  "utm_reader",
  "utm_name",
  "utm_social",
  "utm_social-type",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "twclid",
  "_ga",
  "_gl",
  "yclid",
  "ymclid",
  "vero_conv",
  "vero_id",
  "wickedid",
  "hsa_cam",
  "hsa_grp",
  "hsa_mt",
  "hsa_src",
  "hsa_ad",
  "hsa_acc",
  "hsa_net",
  "hsa_kw",
  "hsa_tgt",
  "hsa_ver",
  "mkt_tok",
  "oly_anon_id",
  "oly_enc_id",
  "rb_clickid",
  "s_kwcid",
  "ref",
  "ref_src",
  "ref_url",
  "spm",
  "scm",
  "from",
  "source",
  "si", // YouTube share
];

/**
 * Default dedupe rules. Safe stack enabled; aggressive options off.
 * @typedef {object} DedupeSettings
 * @property {boolean} stripTrailingSlash
 * @property {boolean} ignoreHash
 * @property {boolean} stripTrackingParams
 * @property {boolean} ignoreAllQuery
 * @property {boolean} ignoreHttpHttps
 * @property {boolean} stripWww
 * @property {boolean} sortQueryParams
 * @property {boolean} lowercaseHost
 * @property {boolean} samePullRequest
 * @property {boolean} sameJiraBoard
 */
const DEFAULT_SETTINGS = {
  stripTrailingSlash: true,
  ignoreHash: true,
  stripTrackingParams: true,
  ignoreAllQuery: false,
  ignoreHttpHttps: true,
  stripWww: false,
  sortQueryParams: true,
  lowercaseHost: true,
  samePullRequest: true,
  sameJiraBoard: true,
};

/** Jira board UI-only query keys (keep filters like assignee). */
const JIRA_BOARD_UI_PARAM_KEYS = [
  "selectedissue",
  "selectedissueindex",
  "atlorigin",
];

/**
 * Collapse PR/MR view subpaths so one ticket/PR = one tab for dedupe.
 * GitHub: /owner/repo/pull/121/changes → /owner/repo/pull/121
 * GitLab: /group/proj/-/merge_requests/45/diffs → …/merge_requests/45
 *
 * @param {string} pathname
 * @returns {string}
 */
function collapsePullRequestPath(pathname) {
  if (!pathname) {
    return pathname;
  }
  // github.com / ghe: /{owner}/{repo}/pull/{n}[/…]
  let m = pathname.match(/^(\/[^/]+\/[^/]+\/pull\/\d+)(?:\/.*)?$/i);
  if (m) {
    return m[1];
  }
  // gitlab: /…/-/merge_requests/{n}[/…]
  m = pathname.match(/^(.+\/-\/merge_requests\/\d+)(?:\/.*)?$/i);
  if (m) {
    return m[1];
  }
  return pathname;
}

/**
 * Jira Software board: /jira/software/.../boards/60
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function isJiraBoardPath(pathname) {
  return /\/boards\/\d+\/?$/i.test(pathname || "");
}

/**
 * Drop board chrome params so board + selectedIssue ≡ same board.
 *
 * @param {URL} u
 */
function stripJiraBoardUiParams(u) {
  if (!u.search) {
    return;
  }
  const params = new URLSearchParams(u.search);
  const drop = new Set(JIRA_BOARD_UI_PARAM_KEYS);
  for (const key of [...params.keys()]) {
    if (drop.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  u.search = params.toString() ? `?${params.toString()}` : "";
}

/**
 * @param {Partial<DedupeSettings> | null | undefined} stored
 * @returns {DedupeSettings}
 */
function mergeSettings(stored) {
  return {
    ...DEFAULT_SETTINGS,
    ...(stored && typeof stored === "object" ? stored : {}),
  };
}

/**
 * @returns {Promise<DedupeSettings>}
 */
async function loadSettings() {
  const data = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  return mergeSettings(data[SETTINGS_STORAGE_KEY]);
}

/**
 * @param {DedupeSettings} settings
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: mergeSettings(settings) });
}

/**
 * Build a comparison key for "same page" detection under the given rules.
 * Non-http(s) URLs return the original string (exact match only).
 *
 * @param {string} url
 * @param {DedupeSettings} settings
 * @returns {string}
 */
function normalizeUrlForDedupe(url, settings) {
  if (!url) {
    return "";
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return url;
    }

    if (settings.lowercaseHost) {
      u.hostname = u.hostname.toLowerCase();
    }

    if (settings.stripWww && u.hostname.startsWith("www.")) {
      u.hostname = u.hostname.slice(4);
    }

    if (
      (u.protocol === "https:" && u.port === "443") ||
      (u.protocol === "http:" && u.port === "80")
    ) {
      u.port = "";
    }

    if (settings.ignoreHttpHttps) {
      u.protocol = "https:";
    }

    if (settings.stripTrailingSlash && u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    }

    if (settings.samePullRequest) {
      u.pathname = collapsePullRequestPath(u.pathname);
      // Same PR: conversation / files / changes / commits → one key; drop view queries.
      if (isPullRequestCanonicalPath(u.pathname)) {
        u.search = "";
        u.hash = "";
      }
    }

    if (settings.sameJiraBoard && isJiraBoardPath(u.pathname)) {
      stripJiraBoardUiParams(u);
    }

    if (settings.ignoreHash) {
      u.hash = "";
    }

    if (settings.ignoreAllQuery) {
      u.search = "";
    } else if (u.search) {
      const params = new URLSearchParams(u.search);
      if (settings.stripTrackingParams) {
        const tracking = new Set(TRACKING_PARAM_KEYS);
        for (const key of [...params.keys()]) {
          if (tracking.has(key.toLowerCase())) {
            params.delete(key);
          }
        }
      }
      if (settings.sortQueryParams) {
        const pairs = [...params.entries()].sort((a, b) => {
          const c = a[0].localeCompare(b[0]);
          return c !== 0 ? c : a[1].localeCompare(b[1]);
        });
        const sorted = new URLSearchParams();
        for (const [k, v] of pairs) {
          sorted.append(k, v);
        }
        u.search = sorted.toString() ? `?${sorted.toString()}` : "";
      } else {
        u.search = params.toString() ? `?${params.toString()}` : "";
      }
    }

    return `${u.protocol}//${u.host}${u.pathname}${u.search}${u.hash}`;
  } catch (_) {
    return url;
  }
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isPullRequestCanonicalPath(pathname) {
  return (
    /^\/[^/]+\/[^/]+\/pull\/\d+$/i.test(pathname) ||
    /\/-\/merge_requests\/\d+$/i.test(pathname)
  );
}

// Options for UI (labels + help), kept here so options page and docs stay aligned.
const SETTINGS_META = [
  {
    key: "stripTrailingSlash",
    label: "Treat trailing slash as same",
    help: "example.com/path and example.com/path/ count as one tab",
  },
  {
    key: "samePullRequest",
    label: "Same GitHub/GitLab PR as duplicate",
    help: "/pull/121 and /pull/121/changes (files, commits, checks) count as one",
  },
  {
    key: "sameJiraBoard",
    label: "Same Jira board as duplicate",
    help: "board URL with or without selectedIssue counts as one (keeps assignee / filters)",
  },
  {
    key: "ignoreHash",
    label: "Ignore URL hash / fragment",
    help: "…/page#section matches …/page (same document anchors)",
  },
  {
    key: "stripTrackingParams",
    label: "Strip tracking query params",
    help: "utm_*, fbclid, gclid, and similar marketing tags ignored",
  },
  {
    key: "ignoreAllQuery",
    label: "Ignore all query string",
    help: "Stronger: only host + path must match (can merge different filters)",
  },
  {
    key: "ignoreHttpHttps",
    label: "Treat http and https as same",
    help: "http://host/x matches https://host/x",
  },
  {
    key: "stripWww",
    label: "Treat www as same host",
    help: "www.example.com matches example.com",
  },
  {
    key: "sortQueryParams",
    label: "Ignore query param order",
    help: "?a=1&b=2 matches ?b=2&a=1",
  },
  {
    key: "lowercaseHost",
    label: "Case-insensitive host",
    help: "Example.com matches example.com",
  },
];
