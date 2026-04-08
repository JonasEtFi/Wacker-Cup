(function () {
  const ADMIN_SESSION_KEY = "wacker-cup-admin-session";
  const API_URL = "/api/data";

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
    try {
      const response = await fetch(getDataUrl(), { cache: "no-store" });
      if (!response.ok) throw new Error("Die JSON-Daten konnten nicht geladen werden.");
      const parsed = await response.json();
      normalizeData(parsed);
      return parsed;
    } catch (_error) {
      throw new Error("Die JSON-Daten konnten nicht geladen werden. Bitte die Seite ueber einen lokalen Server oder GitHub Pages aufrufen.");
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

  async function persistData(data) {
    if (!isLocalServer()) {
      return data;
    }
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error("Die JSON-Datei konnte nicht gespeichert werden.");
    }
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getDataUrl() {
    return isLocalServer() ? API_URL : "./data/data.json";
  }

  function isLocalServer() {
    return location.protocol.indexOf("http") === 0 && (location.hostname === "127.0.0.1" || location.hostname === "localhost");
  }

})();
