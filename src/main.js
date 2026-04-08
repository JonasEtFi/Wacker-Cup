import { DEFAULT_PLAYER_RESULT, EMPTY_SESSION_LABEL } from "./constants.js";
import { loadData, persistData, resetToSourceData } from "./store.js";
import { buildMonthlyStandings, buildSeasonStandings, getMonthOptions } from "./table.js";
import {
  createId,
  downloadJson,
  formatDate,
  formatMonth,
  getCurrentMonthKey,
  monthKeyFromDate,
  sha256,
  sortByDateDesc
} from "./utils.js";

const state = {
  data: null,
  selectedMonth: null,
  adminUnlocked: false,
  currentView: "month",
  sidebarOpen: false
};

const elements = {
  appTitle: document.querySelector("#app-title"),
  seasonLabel: document.querySelector("#season-label"),
  tableTitle: document.querySelector("#tabellen-titel"),
  tableSubtitle: document.querySelector("#tabellen-subtitle"),
  rankingTable: document.querySelector("#rangliste"),
  monthField: document.querySelector("#monat-feld"),
  monthSelect: document.querySelector("#monat-auswahl"),
  monthViewButton: document.querySelector("#ansicht-monat"),
  seasonViewButton: document.querySelector("#ansicht-saison"),
  navMonth: document.querySelector("#nav-monat"),
  navSeason: document.querySelector("#nav-saison"),
  navPlayers: document.querySelector("#nav-spieler"),
  playerList: document.querySelector("#spieler-liste"),
  playerSection: document.querySelector("#spieler-sektion"),
  rankingSection: document.querySelector("#rangliste-sektion"),
  sidebar: document.querySelector("#admin-sidebar"),
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  openSidebar: document.querySelector("#admin-sidebar-open"),
  closeSidebar: document.querySelector("#admin-sidebar-close"),
  adminLock: document.querySelector("#admin-sperre"),
  adminPanel: document.querySelector("#admin-panel"),
  adminPassword: document.querySelector("#admin-passwort"),
  adminLogin: document.querySelector("#admin-login"),
  adminError: document.querySelector("#admin-fehler"),
  playerForm: document.querySelector("#spieler-form"),
  playerFormStatus: document.querySelector("#spieler-form-status"),
  playerId: document.querySelector("#spieler-id"),
  playerName: document.querySelector("#spieler-name"),
  playerNumber: document.querySelector("#spieler-nummer"),
  playerTeam: document.querySelector("#spieler-team"),
  playerActive: document.querySelector("#spieler-aktiv"),
  playerReset: document.querySelector("#spieler-form-reset"),
  sessionForm: document.querySelector("#ergebnis-form"),
  sessionFormStatus: document.querySelector("#ergebnis-form-status"),
  sessionId: document.querySelector("#einheit-id"),
  sessionDate: document.querySelector("#einheit-datum"),
  sessionLabel: document.querySelector("#einheit-label"),
  resultRows: document.querySelector("#ergebnis-zeilen"),
  sessionReset: document.querySelector("#ergebnis-form-reset"),
  sessionList: document.querySelector("#einheiten-liste"),
  resetData: document.querySelector("#daten-zuruecksetzen"),
  exportData: document.querySelector("#daten-export"),
  importData: document.querySelector("#daten-import")
};

bootstrap().catch((error) => {
  document.body.innerHTML = `<main class="page-shell"><section class="card"><h1>Fehler</h1><p>${error.message}</p></section></main>`;
});

async function bootstrap() {
  state.data = await loadData();
  seedCurrentMonthSessions(state.data);
  state.selectedMonth = getDefaultMonth(state.data);

  bindEvents();
  render();
}

function bindEvents() {
  elements.monthViewButton.addEventListener("click", () => {
    state.currentView = "month";
    renderTables();
    renderNav();
  });

  elements.seasonViewButton.addEventListener("click", () => {
    state.currentView = "season";
    renderTables();
    renderNav();
  });

  elements.navMonth.addEventListener("click", () => {
    state.currentView = "month";
    renderTables();
    renderNav();
    elements.rankingSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.navSeason.addEventListener("click", () => {
    state.currentView = "season";
    renderTables();
    renderNav();
    elements.rankingSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.navPlayers.addEventListener("click", () => {
    renderNav("players");
    elements.playerSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.monthSelect.addEventListener("change", (event) => {
    state.selectedMonth = event.target.value;
    renderTables();
  });

  elements.openSidebar.addEventListener("click", () => {
    state.sidebarOpen = true;
    renderSidebar();
  });

  elements.closeSidebar.addEventListener("click", closeSidebar);
  elements.sidebarBackdrop.addEventListener("click", closeSidebar);

  elements.adminLogin.addEventListener("click", unlockAdmin);
  elements.playerForm.addEventListener("submit", onPlayerSubmit);
  elements.playerReset.addEventListener("click", resetPlayerForm);
  elements.sessionForm.addEventListener("submit", onSessionSubmit);
  elements.sessionReset.addEventListener("click", resetSessionForm);

  elements.resetData.addEventListener("click", async () => {
    state.data = await resetToSourceData();
    seedCurrentMonthSessions(state.data);
    state.selectedMonth = getDefaultMonth(state.data);
    resetPlayerForm();
    resetSessionForm();
    render();
  });

  elements.exportData.addEventListener("click", () => {
    downloadJson("wacker-cup-data.json", state.data);
  });

  elements.importData.addEventListener("change", async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) return;
    const content = await file.text();
    state.data = JSON.parse(content);
    seedCurrentMonthSessions(state.data);
    persistData(state.data);
    state.selectedMonth = getDefaultMonth(state.data);
    resetPlayerForm();
    resetSessionForm();
    render();
    event.target.value = "";
  });
}

async function unlockAdmin() {
  const input = elements.adminPassword.value.trim();
  const hash = await sha256(input);

  if (hash !== state.data.metadata.adminPasswordHash) {
    elements.adminError.textContent = "Falsches Passwort.";
    return;
  }

  state.adminUnlocked = true;
  elements.adminError.textContent = "";
  elements.adminLock.classList.add("hidden");
  elements.adminPanel.classList.remove("hidden");
  renderAdmin();
}

function closeSidebar() {
  state.sidebarOpen = false;
  renderSidebar();
}

function render() {
  elements.appTitle.textContent = state.data.metadata.appTitle;
  elements.seasonLabel.textContent = state.data.metadata.seasonLabel;
  renderMonthSelect();
  renderTables();
  renderPlayers();
  renderAdmin();
  renderSidebar();
  renderNav();
}

function renderMonthSelect() {
  const options = getAvailableMonthOptions(state.data);
  elements.monthSelect.innerHTML = options
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === state.selectedMonth ? "selected" : ""}>${option.label}</option>`
    )
    .join("");
}

function renderTables() {
  const seasonStandings = buildSeasonStandings(state.data);
  const monthlyStandings = state.selectedMonth
    ? buildMonthlyStandings(state.data, state.selectedMonth)
    : [];

  const seasonMode = state.currentView === "season";
  const standings = seasonMode ? seasonStandings : monthlyStandings;

  elements.tableTitle.textContent = seasonMode ? "Saisontabelle" : "Monatstabelle";
  elements.tableSubtitle.textContent = seasonMode
    ? "Grün für obere Hälfte, Rot für untere Hälfte"
    : `Auswahl: ${formatMonth(state.selectedMonth)}`;
  elements.monthField.classList.toggle("hidden", seasonMode);
  elements.monthViewButton.classList.toggle("is-active", !seasonMode);
  elements.seasonViewButton.classList.toggle("is-active", seasonMode);
  elements.rankingTable.innerHTML = renderTable(standings, seasonMode);
}

function renderNav(active = state.currentView) {
  elements.navMonth.classList.toggle("is-active", active === "month");
  elements.navSeason.classList.toggle("is-active", active === "season");
  elements.navPlayers.classList.toggle("is-active", active === "players");
}

function renderTable(standings, seasonMode) {
  if (!standings.length) {
    return "<p>Keine Ergebnisse vorhanden.</p>";
  }

  const countedPlayers = standings.filter((entry) => !entry.ohneSpiele);
  const midpoint = Math.ceil(countedPlayers.length / 2);
  const topHalfIds = new Set(countedPlayers.slice(0, midpoint).map((entry) => entry.playerId));
  const bottomHalfIds = new Set(countedPlayers.slice(midpoint).map((entry) => entry.playerId));

  return `
    <table>
      <thead>
        <tr>
          <th>Platz</th>
          <th>Spieler</th>
          <th>Trainings</th>
          <th>Punkte</th>
          <th>Diff</th>
          <th>Sieg %</th>
          ${seasonMode ? "<th>Markierung</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${standings
          .map((entry, index) => {
            const classes = [];
            if (entry.platz === 1) classes.push("platz-1");
            if (entry.ohneSpiele) {
              classes.push("ohne-spiele");
            } else if (seasonMode && topHalfIds.has(entry.playerId)) {
              classes.push("obere-haelfte");
            } else if (seasonMode && bottomHalfIds.has(entry.playerId)) {
              classes.push("untere-haelfte");
            }

            let marker = "";
            if (seasonMode && topHalfIds.has(entry.playerId)) {
              marker = `<span class="markierung">🍺 Obere Hälfte</span>`;
            } else if (seasonMode && bottomHalfIds.has(entry.playerId)) {
              marker = `<span class="markierung">💸 Untere Hälfte</span>`;
            } else if (seasonMode) {
              marker = `<span class="markierung">Noch ohne Einsatz</span>`;
            }

            return `
              <tr class="${classes.join(" ")}">
                <td class="ranking-cell">${entry.platz}</td>
                <td>${entry.name}</td>
                <td>${entry.spiele}</td>
                <td>${entry.punkte}</td>
                <td>${entry.differenz > 0 ? `+${entry.differenz}` : entry.differenz}</td>
                <td>${entry.siegProzent} %</td>
                ${seasonMode ? `<td>${marker}</td>` : ""}
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderPlayers() {
  const teamsById = new Map(state.data.teams.map((team) => [team.id, team.name]));
  const players = [...state.data.players].sort((left, right) => left.name.localeCompare(right.name, "de"));

  elements.playerList.innerHTML = players
    .map(
      (player) => `
        <article class="player-card">
          <h3>${player.name}</h3>
          <div class="player-meta">
            <span>Nummer: ${player.number || "-"}</span>
            <span>Team: ${teamsById.get(player.teamId) || "-"}</span>
            <span>Status: ${player.active ? "Aktiv" : "Inaktiv"}</span>
          </div>
          ${
            state.adminUnlocked
              ? `<button class="button button-secondary" data-action="edit-player" data-player-id="${player.id}">Bearbeiten</button>`
              : ""
          }
        </article>
      `
    )
    .join("");

  if (state.adminUnlocked) {
    elements.playerList.querySelectorAll('[data-action="edit-player"]').forEach((button) => {
      button.addEventListener("click", () => {
        const player = state.data.players.find((item) => item.id === button.dataset.playerId);
        if (!player) return;
        fillPlayerForm(player);
      });
    });
  }
}

function renderAdmin() {
  if (!state.adminUnlocked) {
    return;
  }

  elements.playerTeam.innerHTML = state.data.teams
    .map((team) => `<option value="${team.id}">${team.name}</option>`)
    .join("");

  renderSessionRows();
  renderSessionList();
}

function renderSidebar() {
  elements.sidebar.classList.toggle("is-open", state.sidebarOpen);
  elements.sidebarBackdrop.classList.toggle("hidden", !state.sidebarOpen);
}

function renderSessionRows(session = null) {
  const sortedPlayers = [...state.data.players].sort((left, right) => left.name.localeCompare(right.name, "de"));
  const resultsByPlayerId = new Map((session?.results ?? []).map((result) => [result.playerId, result]));

  elements.resultRows.innerHTML = sortedPlayers
    .map((player) => {
      const result = resultsByPlayerId.get(player.id) ?? {
        playerId: player.id,
        teamId: player.teamId,
        ...DEFAULT_PLAYER_RESULT
      };

      return `
        <div class="result-row">
          <span>${player.name}${player.active ? "" : " (inaktiv)"}</span>
          <select data-field="teamId" data-player-id="${player.id}">
            ${state.data.teams
              .map(
                (team) =>
                  `<option value="${team.id}" ${team.id === result.teamId ? "selected" : ""}>${team.name}</option>`
              )
              .join("")}
          </select>
          <input data-field="goalsFor" data-player-id="${player.id}" type="number" min="0" value="${result.goalsFor}" />
          <input data-field="goalsAgainst" data-player-id="${player.id}" type="number" min="0" value="${result.goalsAgainst}" />
        </div>
      `;
    })
    .join("");
}

function renderSessionList() {
  const entries = sortByDateDesc(state.data.sessions, (session) => session.date);

  elements.sessionList.innerHTML = entries
    .map(
      (session) => `
        <article class="session-item">
          <div class="session-meta">
            <strong>${session.label || EMPTY_SESSION_LABEL}</strong>
            <span>${formatDate(session.date)}</span>
          </div>
          <button class="button button-secondary" data-action="edit-session" data-session-id="${session.id}">
            Bearbeiten
          </button>
        </article>
      `
    )
    .join("");

  elements.sessionList.querySelectorAll('[data-action="edit-session"]').forEach((button) => {
    button.addEventListener("click", () => {
      const session = state.data.sessions.find((item) => item.id === button.dataset.sessionId);
      if (!session) return;
      fillSessionForm(session);
    });
  });
}

function fillPlayerForm(player) {
  elements.playerId.value = player.id;
  elements.playerName.value = player.name;
  elements.playerNumber.value = player.number ?? "";
  elements.playerTeam.value = player.teamId ?? state.data.teams[0]?.id ?? "";
  elements.playerActive.checked = Boolean(player.active);
  elements.playerFormStatus.textContent = `Bearbeitung: ${player.name}`;
}

function resetPlayerForm() {
  elements.playerForm.reset();
  elements.playerId.value = "";
  elements.playerActive.checked = true;
  elements.playerTeam.value = state.data.teams[0]?.id ?? "";
  elements.playerFormStatus.textContent = "";
}

function fillSessionForm(session) {
  elements.sessionId.value = session.id;
  elements.sessionDate.value = session.date;
  elements.sessionLabel.value = session.label ?? "";
  renderSessionRows(session);
  elements.sessionFormStatus.textContent = `Bearbeitung: ${session.label || EMPTY_SESSION_LABEL} (${formatDate(session.date)})`;
}

function resetSessionForm() {
  elements.sessionForm.reset();
  elements.sessionId.value = "";
  elements.sessionLabel.value = "";
  elements.sessionDate.value = "";
  renderSessionRows();
  elements.sessionFormStatus.textContent = "";
}

function onPlayerSubmit(event) {
  event.preventDefault();

  const payload = {
    id: elements.playerId.value || createId("player"),
    name: elements.playerName.value.trim(),
    number: elements.playerNumber.value ? Number(elements.playerNumber.value) : null,
    teamId: elements.playerTeam.value,
    active: elements.playerActive.checked
  };

  const index = state.data.players.findIndex((player) => player.id === payload.id);
  if (index >= 0) {
    state.data.players[index] = payload;
  } else {
    state.data.players.push(payload);
  }

  persistData(state.data);
  resetPlayerForm();
  render();
}

function onSessionSubmit(event) {
  event.preventDefault();

  const results = [...elements.resultRows.querySelectorAll(".result-row")]
    .map((row) => {
      const playerId = row.querySelector("[data-field='teamId']").dataset.playerId;
      const teamId = row.querySelector("[data-field='teamId']").value;
      const goalsFor = Number(row.querySelector("[data-field='goalsFor']").value) || 0;
      const goalsAgainst = Number(row.querySelector("[data-field='goalsAgainst']").value) || 0;

      return { playerId, teamId, goalsFor, goalsAgainst };
    });

  const payload = {
    id: elements.sessionId.value || createId("session"),
    date: elements.sessionDate.value,
    label: elements.sessionLabel.value.trim() || EMPTY_SESSION_LABEL,
    monthKey: monthKeyFromDate(elements.sessionDate.value),
    results
  };

  const index = state.data.sessions.findIndex((session) => session.id === payload.id);
  if (index >= 0) {
    state.data.sessions[index] = payload;
  } else {
    state.data.sessions.push(payload);
  }

  persistData(state.data);
  state.selectedMonth = monthKeyFromDate(payload.date);
  resetSessionForm();
  render();
}

function getAvailableMonthOptions(data) {
  const options = getMonthOptions(data);
  const currentMonth = getCurrentMonthKey();

  if (!options.some((option) => option.value === currentMonth)) {
    options.push({
      value: currentMonth,
      label: formatMonth(currentMonth)
    });
  }

  return options.sort((left, right) => left.value.localeCompare(right.value));
}

function getDefaultMonth(data) {
  return getCurrentMonthKey() || getMonthOptions(data).at(-1)?.value || null;
}

function seedCurrentMonthSessions(data) {
  const monthKey = getCurrentMonthKey();
  if (data.sessions.some((session) => session.date.startsWith(monthKey))) {
    return;
  }

  const demoSessions = [
    {
      id: createId("session"),
      date: `${monthKey}-02`,
      label: "Monatsstart",
      results: [
        { playerId: "p1", teamId: "team-gruen", goalsFor: 4, goalsAgainst: 2 },
        { playerId: "p2", teamId: "team-gruen", goalsFor: 4, goalsAgainst: 2 },
        { playerId: "p3", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 },
        { playerId: "p4", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 },
        { playerId: "p5", teamId: "team-gruen", goalsFor: 4, goalsAgainst: 2 },
        { playerId: "p6", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 },
        { playerId: "p7", teamId: "team-gruen", goalsFor: 4, goalsAgainst: 2 },
        { playerId: "p8", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 }
      ]
    },
    {
      id: createId("session"),
      date: `${monthKey}-07`,
      label: "Technikabend",
      results: [
        { playerId: "p1", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 3 },
        { playerId: "p2", teamId: "team-gruen", goalsFor: 5, goalsAgainst: 3 },
        { playerId: "p3", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 },
        { playerId: "p4", teamId: "team-gruen", goalsFor: 5, goalsAgainst: 3 },
        { playerId: "p5", teamId: "team-gruen", goalsFor: 5, goalsAgainst: 3 },
        { playerId: "p6", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 },
        { playerId: "p7", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 3 },
        { playerId: "p8", teamId: "team-gruen", goalsFor: 5, goalsAgainst: 3 }
      ]
    }
  ];

  data.sessions.push(...demoSessions);
  persistData(data);
}
