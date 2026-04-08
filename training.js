(function () {
  const STORAGE_KEY = "wacker-cup-data";
  const ADMIN_SESSION_KEY = "wacker-cup-admin-session";
  const EMPTY_SESSION_LABEL = "Trainingseinheit";
  const defaultData = getDefaultData();

  const state = { data: null, adminUnlocked: false };

  const elements = {
    adminLock: document.querySelector("#admin-sperre"),
    adminPanel: document.querySelector("#admin-panel"),
    adminPassword: document.querySelector("#admin-passwort"),
    adminLogin: document.querySelector("#admin-login"),
    adminError: document.querySelector("#admin-fehler"),
    sessionForm: document.querySelector("#ergebnis-form"),
    sessionFormStatus: document.querySelector("#ergebnis-form-status"),
    sessionId: document.querySelector("#einheit-id"),
    sessionDate: document.querySelector("#einheit-datum"),
    sessionLabel: document.querySelector("#einheit-label"),
    scoreBlue: document.querySelector("#team-blau-tore"),
    scoreWhite: document.querySelector("#team-weiss-tore"),
    resultRows: document.querySelector("#ergebnis-zeilen"),
    sessionReset: document.querySelector("#ergebnis-form-reset"),
    sessionList: document.querySelector("#einheiten-liste"),
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
    setTodayAsDefault();
    bindEvents();
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      state.adminUnlocked = true;
      elements.adminLock.classList.add("hidden");
      elements.adminPanel.classList.remove("hidden");
      renderTraining();
    }
  }

  function bindEvents() {
    elements.adminLogin.addEventListener("click", unlockAdmin);
    elements.sessionForm.addEventListener("submit", onSessionSubmit);
    elements.sessionReset.addEventListener("click", resetSessionForm);
    elements.resultRows.addEventListener("change", onTeamToggle);
    elements.resetData.addEventListener("click", async function () {
      localStorage.removeItem(STORAGE_KEY);
      state.data = await loadData();
      resetSessionForm();
      renderTraining();
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
      resetSessionForm();
      renderTraining();
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
    renderTraining();
  }

  function renderTraining() {
    if (!state.adminUnlocked) return;
    renderSessionRows();
    renderSessionList();
  }

  function renderSessionRows(session) {
    const sortedPlayers = state.data.players.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });
    const resultsByPlayerId = new Map(((session && session.results) || []).map(function (result) { return [result.playerId, result]; }));

    elements.resultRows.innerHTML = sortedPlayers
      .map(function (player) {
        const result = resultsByPlayerId.get(player.id) || { teamId: "" };
        return (
          '<div class="result-row"><span>' + escapeHtml(player.name) + (player.active ? "" : " (inaktiv)") + '</span><label class="team-check"><input type="checkbox" data-player-id="' + player.id + '" data-team="team-blau"' + (result.teamId === "team-blau" ? " checked" : "") + " /></label><label class=\"team-check\"><input type=\"checkbox\" data-player-id=\"" + player.id + '" data-team="team-weiss"' + (result.teamId === "team-weiss" ? " checked" : "") + " /></label></div>"
        );
      })
      .join("");
  }

  function renderSessionList() {
    elements.sessionList.innerHTML = state.data.sessions
      .slice()
      .sort(function (a, b) { return b.date.localeCompare(a.date); })
      .map(function (session) {
        const score = getSessionScoreSummary(session);
        return '<article class="session-item"><div class="session-meta"><strong>' + escapeHtml(session.label || EMPTY_SESSION_LABEL) + '</strong><span class="session-line">' + formatDate(session.date) + "</span>" + renderScoreboard(score) + '</div><button class="button button-secondary" data-action="edit-session" data-session-id="' + session.id + '">Bearbeiten</button></article>';
      })
      .join("");

    elements.sessionList.querySelectorAll('[data-action="edit-session"]').forEach(function (button) {
      button.addEventListener("click", function () {
        const session = state.data.sessions.find(function (item) { return item.id === button.dataset.sessionId; });
        if (session) fillSessionForm(session);
      });
    });
  }

  function fillSessionForm(session) {
    elements.sessionId.value = session.id;
    elements.sessionDate.value = session.date;
    elements.sessionLabel.value = session.label || "";
    const score = getSessionScoreSummary(session);
    elements.scoreBlue.value = score.blau;
    elements.scoreWhite.value = score.weiss;
    elements.sessionFormStatus.textContent = "Bearbeitung: " + (session.label || EMPTY_SESSION_LABEL);
    renderSessionRows(session);
  }

  function resetSessionForm() {
    elements.sessionForm.reset();
    elements.sessionId.value = "";
    setTodayAsDefault();
    elements.sessionLabel.value = "";
    elements.scoreBlue.value = "0";
    elements.scoreWhite.value = "0";
    elements.sessionFormStatus.textContent = "";
    renderSessionRows();
  }

  function onTeamToggle(event) {
    const input = event.target;
    if (!input.matches("input[type='checkbox'][data-team]")) return;
    if (!input.checked) return;
    const selector = 'input[data-player-id="' + input.dataset.playerId + '"][data-team]';
    elements.resultRows.querySelectorAll(selector).forEach(function (checkbox) {
      if (checkbox !== input) checkbox.checked = false;
    });
  }

  async function onSessionSubmit(event) {
    event.preventDefault();
    const scoreBlue = Number(elements.scoreBlue.value) || 0;
    const scoreWhite = Number(elements.scoreWhite.value) || 0;
    const payload = {
      id: elements.sessionId.value || createId("session"),
      date: elements.sessionDate.value,
      label: elements.sessionLabel.value.trim() || EMPTY_SESSION_LABEL,
      results: buildResults(scoreBlue, scoreWhite)
    };
    const index = state.data.sessions.findIndex(function (session) { return session.id === payload.id; });
    if (index >= 0) state.data.sessions[index] = payload;
    else state.data.sessions.push(payload);
    await persistData(state.data);
    fillSessionForm(payload);
    renderSessionList();
  }

  function buildResults(scoreBlue, scoreWhite) {
    const results = [];
    elements.resultRows.querySelectorAll(".result-row").forEach(function (row) {
      const blue = row.querySelector('input[data-team="team-blau"]');
      const white = row.querySelector('input[data-team="team-weiss"]');
      const playerId = (blue || white).dataset.playerId;
      if (blue.checked) results.push({ playerId: playerId, teamId: "team-blau", goalsFor: scoreBlue, goalsAgainst: scoreWhite });
      if (white.checked) results.push({ playerId: playerId, teamId: "team-weiss", goalsFor: scoreWhite, goalsAgainst: scoreBlue });
    });
    return results;
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

  function getSessionScoreSummary(session) {
    const blue = (session.results || []).find(function (result) { return result.teamId === "team-blau"; });
    const white = (session.results || []).find(function (result) { return result.teamId === "team-weiss"; });
    return {
      blau: blue ? blue.goalsFor : white ? white.goalsAgainst : 0,
      weiss: white ? white.goalsFor : blue ? blue.goalsAgainst : 0
    };
  }

  function renderScoreboard(score) {
    return (
      '<div class="latest-score scoreboard"><span class="score-team score-team-blue"><span class="team-chip team-chip-blue"><img class="team-logo team-logo-inverted" src="./assets/hc-wacker-munchen.png" alt="Team Blau" /></span><span>' +
      score.blau +
      '</span></span><span class="score-separator">:</span><span class="score-team"><span class="team-chip"><img class="team-logo" src="./assets/hc-wacker-munchen.png" alt="Team Weiß" /></span><span>' +
      score.weiss +
      "</span></span></div>"
    );
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

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateString));
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

  function setTodayAsDefault() {
    elements.sessionDate.value = new Date().toISOString().slice(0, 10);
  }
})();
