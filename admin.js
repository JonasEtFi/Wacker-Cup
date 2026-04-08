(function () {
  const STORAGE_KEY = "wacker-cup-data";
  const ADMIN_SESSION_KEY = "wacker-cup-admin-session";
  const defaultData = getDefaultData();

  const state = { data: null, adminUnlocked: false };

  const elements = {
    adminLock: document.querySelector("#admin-sperre"),
    adminPanel: document.querySelector("#admin-panel"),
    adminPassword: document.querySelector("#admin-passwort"),
    adminLogin: document.querySelector("#admin-login"),
    adminError: document.querySelector("#admin-fehler"),
    playerForm: document.querySelector("#spieler-form"),
    playerFormStatus: document.querySelector("#spieler-form-status"),
    playerId: document.querySelector("#spieler-id"),
    playerName: document.querySelector("#spieler-name"),
    playerActive: document.querySelector("#spieler-aktiv"),
    playerReset: document.querySelector("#spieler-form-reset"),
    playerDelete: document.querySelector("#spieler-loeschen"),
    playerList: document.querySelector("#spieler-liste"),
    resetData: document.querySelector("#daten-zuruecksetzen"),
    exportData: document.querySelector("#daten-export"),
    importData: document.querySelector("#daten-import")
  };

  bootstrap().catch(function (error) {
    document.body.innerHTML =
      '<main class="page-shell"><section class="card"><h1>Fehler</h1><p>' + escapeHtml(error.message) + "</p></section></main>";
  });

  async function bootstrap() {
    state.data = await loadData();
    bindEvents();
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      state.adminUnlocked = true;
      elements.adminLock.classList.add("hidden");
      elements.adminPanel.classList.remove("hidden");
      renderAdmin();
    }
  }

  function bindEvents() {
    elements.adminLogin.addEventListener("click", unlockAdmin);
    elements.playerForm.addEventListener("submit", onPlayerSubmit);
    elements.playerReset.addEventListener("click", resetPlayerForm);
    elements.playerDelete.addEventListener("click", function () {
      if (elements.playerId.value) deletePlayer(elements.playerId.value);
    });
    elements.resetData.addEventListener("click", async function () {
      localStorage.removeItem(STORAGE_KEY);
      state.data = await loadData();
      resetPlayerForm();
      renderAdmin();
    });
    elements.exportData.addEventListener("click", function () {
      downloadJson("data.json", state.data);
    });
    elements.importData.addEventListener("change", async function (event) {
      const file = (event.target.files || [])[0];
      if (!file) return;
      state.data = JSON.parse(await file.text());
      normalizeData(state.data);
      await persistData(state.data);
      resetPlayerForm();
      renderAdmin();
      event.target.value = "";
    });
  }

  async function unlockAdmin() {
    const input = (elements.adminPassword.value || "").trim();
    let ok = input === state.data.metadata.adminPassword;
    if (!ok && window.crypto && window.crypto.subtle && state.data.metadata.adminPasswordHash) {
      ok = (await sha256(input)) === state.data.metadata.adminPasswordHash;
    }
    if (!ok) {
      elements.adminError.textContent = "Falsches Passwort.";
      return;
    }
    state.adminUnlocked = true;
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    elements.adminLock.classList.add("hidden");
    elements.adminPanel.classList.remove("hidden");
    renderAdmin();
  }

  function renderAdmin() {
    if (!state.adminUnlocked) return;
    elements.playerList.innerHTML = state.data.players
      .slice()
      .sort(function (a, b) { return a.name.localeCompare(b.name, "de"); })
      .map(function (player) {
        return '<article class="player-card"><h3>' + escapeHtml(player.name) + '</h3><div class="player-meta"><span>Status: ' + (player.active ? "Aktiv" : "Inaktiv") + '</span></div><div class="form-actions"><button class="button button-secondary" data-action="edit" data-player-id="' + player.id + '">Bearbeiten</button><button class="button button-secondary" data-action="delete" data-player-id="' + player.id + '">Löschen</button></div></article>';
      })
      .join("");

    elements.playerList.querySelectorAll('[data-action="edit"]').forEach(function (button) {
      button.addEventListener("click", function () {
        const player = state.data.players.find(function (item) { return item.id === button.dataset.playerId; });
        if (player) fillPlayerForm(player);
      });
    });
    elements.playerList.querySelectorAll('[data-action="delete"]').forEach(function (button) {
      button.addEventListener("click", function () {
        deletePlayer(button.dataset.playerId);
      });
    });
  }

  function fillPlayerForm(player) {
    elements.playerId.value = player.id;
    elements.playerName.value = player.name;
    elements.playerActive.checked = !!player.active;
    elements.playerFormStatus.textContent = "Bearbeitung: " + player.name;
  }

  function resetPlayerForm() {
    elements.playerForm.reset();
    elements.playerId.value = "";
    elements.playerActive.checked = true;
    elements.playerFormStatus.textContent = "";
  }

  async function onPlayerSubmit(event) {
    event.preventDefault();
    const payload = {
      id: elements.playerId.value || createId("player"),
      name: elements.playerName.value.trim(),
      active: elements.playerActive.checked
    };
    const index = state.data.players.findIndex(function (player) { return player.id === payload.id; });
    if (index >= 0) state.data.players[index] = payload;
    else state.data.players.push(payload);
    await persistData(state.data);
    resetPlayerForm();
    renderAdmin();
  }

  async function deletePlayer(playerId) {
    state.data.players = state.data.players.filter(function (player) { return player.id !== playerId; });
    state.data.sessions.forEach(function (session) {
      session.results = (session.results || []).filter(function (result) { return result.playerId !== playerId; });
    });
    await persistData(state.data);
    resetPlayerForm();
    renderAdmin();
  }

  async function loadData() {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const parsed = JSON.parse(localData);
      normalizeData(parsed);
      return parsed;
    }
    try {
      const response = await fetch("./data/data.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Die JSON-Daten konnten nicht geladen werden.");
      const parsed = await response.json();
      normalizeData(parsed);
      return parsed;
    } catch (_error) {
      return cloneData(defaultData);
    }
  }

  function normalizeData(data) {
    data.metadata = data.metadata || {};
    if (!data.metadata.adminPassword) data.metadata.adminPassword = "HCWAP";
    data.players = (data.players || []).map(function (player) {
      return { id: player.id, name: player.name, active: player.active !== false };
    });
    data.teams = [
      { id: "team-blau", name: "Blau" },
      { id: "team-weiss", name: "Weiß" }
    ];
    data.sessions = (data.sessions || []).map(function (session) {
      return {
        id: session.id,
        date: session.date,
        label: session.label,
        results: (session.results || []).map(function (result) {
          return {
            playerId: result.playerId,
            teamId: result.teamId === "team-gruen" ? "team-blau" : result.teamId,
            goalsFor: Number(result.goalsFor) || 0,
            goalsAgainst: Number(result.goalsAgainst) || 0
          };
        })
      };
    });
  }

  function persistData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  async function sha256(value) {
    const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(buffer)).map(function (item) { return item.toString(16).padStart(2, "0"); }).join("");
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function createId(prefix) {
    if (window.crypto && window.crypto.randomUUID) return prefix + "-" + window.crypto.randomUUID().slice(0, 8);
    return prefix + "-" + Math.random().toString(36).slice(2, 10);
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getDefaultData() {
    return {
      metadata: {
        appTitle: "Wacker Cup",
        seasonLabel: "Saison 2025/2026",
        adminPassword: "HCWAP",
        adminPasswordHash: "7a12c01c30a5f3abedd5ec43ff6a3f84cd5a404b4860e9f6d476074f7e287a3a"
      },
      teams: [
        { id: "team-blau", name: "Blau" },
        { id: "team-weiss", name: "Weiß" }
      ],
      players: [
        { id: "p1", name: "Max Bauer", active: true },
        { id: "p2", name: "Tobias Lang", active: true },
        { id: "p3", name: "Lukas Schmid", active: true },
        { id: "p4", name: "Felix Meier", active: true },
        { id: "p5", name: "Jonas Huber", active: true },
        { id: "p6", name: "David Koch", active: true },
        { id: "p7", name: "Jonas Fischer", active: true },
        { id: "p8", name: "Felix Winkliner", active: true }
      ],
      sessions: []
    };
  }
})();
