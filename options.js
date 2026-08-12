/**
 * Options page: load/save dedupe settings (chrome.storage.sync).
 * Depends on common.js (DEFAULT_SETTINGS, SETTINGS_META, loadSettings, saveSettings).
 */

function showStatus(msg) {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
    if (msg) {
      setTimeout(() => {
        if (el.textContent === msg) {
          el.textContent = "";
        }
      }, 1600);
    }
  }
}

/**
 * @param {DedupeSettings} settings
 */
function renderOptions(settings) {
  const root = document.getElementById("options-list");
  root.replaceChildren();

  for (const meta of SETTINGS_META) {
    const row = document.createElement("div");
    row.className = "option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `opt-${meta.key}`;
    input.dataset.key = meta.key;
    input.checked = Boolean(settings[meta.key]);

    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = meta.label;

    const help = document.createElement("p");
    help.className = "help";
    help.textContent = meta.help;

    input.addEventListener("change", async () => {
      const next = await loadSettings();
      next[meta.key] = input.checked;
      // ignoreAllQuery makes strip tracking less relevant but both can stay on
      await saveSettings(next);
      showStatus("Saved");
    });

    row.append(input, label, help);
    root.append(row);
  }
}

async function init() {
  const settings = await loadSettings();
  renderOptions(settings);

  document.getElementById("reset-defaults").addEventListener("click", async () => {
    await saveSettings({ ...DEFAULT_SETTINGS });
    renderOptions({ ...DEFAULT_SETTINGS });
    showStatus("Defaults restored");
  });
}

init().catch((err) => {
  console.error(err);
  showStatus("Failed to load settings");
});
