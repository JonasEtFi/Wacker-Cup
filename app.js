(function () {
  const STORAGE_KEY = "wacker-cup-data";
  const defaultData = getDefaultData();

  const state = {
    data: null,
    selectedMonth: null,
    currentView: "month"
  };

  const elements = {
    appTitle: document.querySelector("#app-title"),
    seasonLabel: document.querySelector("#season-label"),
    tableTitle: document.querySelector("#tabellen-titel"),
    tableSubtitle: document.querySelector("#tabellen-subtitle"),
    rankingTable: document.querySelector("#rangliste"),
    latestResult: document.querySelector("#letztes-ergebnis"),
    monthField: document.querySelector("#monat-feld"),
    monthSelect: document.querySelector("#monat-auswahl"),
    monthViewButton: document.querySelector("#ansicht-monat"),
    seasonViewButton: document.querySelector("#ansicht-saison"),
    navMonth: document.querySelector("#nav-monat"),
    navSeason: document.querySelector("#nav-saison"),
    navPlayers: document.querySelector("#nav-spieler"),
    playerList: document.querySelector("#spieler-liste"),
    playerSection: document.querySelector("#spieler-sektion"),
    rankingSection: document.querySelector("#rangliste-sektion")
  };

  bootstrap().catch(function (error) {
    document.body.innerHTML =
      '<main class="page-shell"><section class="card"><h1>Fehler</h1><p>' + escapeHtml(error.message) + "</p></section></main>";
  });

  async function bootstrap() {
    state.data = await loadData();
    normalizeData(state.data);
    seedCurrentMonthSessions(state.data);
    state.selectedMonth = getCurrentMonthKey();
    bindEvents();
    render();
  }

  function bindEvents() {
    elements.monthViewButton.addEventListener("click", function () {
      state.currentView = "month";
      renderTables();
      renderNav();
    });

    elements.seasonViewButton.addEventListener("click", function () {
      state.currentView = "season";
      renderTables();
      renderNav();
    });

    elements.navMonth.addEventListener("click", function () {
      state.currentView = "month";
      renderTables();
      renderNav();
      elements.rankingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    elements.navSeason.addEventListener("click", function () {
      state.currentView = "season";
      renderTables();
      renderNav();
      elements.rankingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    elements.navPlayers.addEventListener("click", function () {
      renderNav("players");
      elements.playerSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    elements.monthSelect.addEventListener("change", function (event) {
      state.selectedMonth = event.target.value;
      renderTables();
    });
  }

  function render() {
    elements.appTitle.textContent = state.data.metadata.appTitle;
    elements.seasonLabel.textContent = state.data.metadata.seasonLabel;
    renderMonthSelect();
    renderTables();
    renderLatestResult();
    renderPlayers();
    renderNav();
  }

  function renderLatestResult() {
    const latestSession = getLatestSession(state.data);

    if (!latestSession) {
      elements.latestResult.innerHTML = "<p>Kein Training vorhanden.</p>";
      return;
    }

    const score = getSessionScoreSummary(latestSession);
    elements.latestResult.innerHTML =
      '<div class="latest-result-card"><div><strong>' +
      escapeHtml(latestSession.label || "Training") +
      "</strong><p>" +
      formatDate(latestSession.date) +
      "</p></div>" +
      renderScoreboard(score) +
      "</div>";
  }

  function renderMonthSelect() {
    const options = getAvailableMonthOptions(state.data);
    elements.monthSelect.innerHTML = options
      .map(function (option) {
        return '<option value="' + option.value + '"' + (option.value === state.selectedMonth ? " selected" : "") + ">" + option.label + "</option>";
      })
      .join("");
  }

  function renderTables() {
    const seasonStandings = buildStandingsForSessions(state.data, state.data.sessions);
    const monthlyStandings = buildStandingsForSessions(
      state.data,
      state.data.sessions.filter(function (session) {
        return session.date.slice(0, 7) === state.selectedMonth;
      })
    );

    const seasonMode = state.currentView === "season";
    const standings = seasonMode ? seasonStandings : monthlyStandings;

    elements.tableTitle.textContent = seasonMode ? "Saisontabelle" : "Monatstabelle";
    elements.tableSubtitle.textContent = seasonMode ? "" : "Auswahl: " + formatMonth(state.selectedMonth);
    elements.monthField.classList.toggle("hidden", seasonMode);
    elements.monthViewButton.classList.toggle("is-active", !seasonMode);
    elements.seasonViewButton.classList.toggle("is-active", seasonMode);
    elements.rankingTable.innerHTML = renderTable(standings, seasonMode);
  }

  function renderNav(active) {
    const current = active || state.currentView;
    elements.navMonth.classList.toggle("is-active", current === "month");
    elements.navSeason.classList.toggle("is-active", current === "season");
    elements.navPlayers.classList.toggle("is-active", current === "players");
  }

  function renderTable(standings, seasonMode) {
    if (!standings.length) {
      return "<p>Keine Ergebnisse vorhanden.</p>";
    }

    const countedPlayers = standings.filter(function (entry) {
      return !entry.ohneSpiele;
    });
    const midpoint = Math.ceil(countedPlayers.length / 2);
    const topHalfIds = new Set(countedPlayers.slice(0, midpoint).map(function (entry) { return entry.playerId; }));
    const bottomHalfIds = new Set(countedPlayers.slice(midpoint).map(function (entry) { return entry.playerId; }));

    return (
      "<table><thead><tr><th>Platz</th><th>Spieler</th><th>Trainings</th><th>Punkte</th><th>Diff</th><th>Sieg %</th>" +
      (seasonMode ? "<th>Markierung</th>" : "") +
      "</tr></thead><tbody>" +
      standings
        .map(function (entry) {
          const classes = [];
          if (entry.platz === 1) classes.push("platz-1");
          if (entry.ohneSpiele) classes.push("ohne-spiele");
          else if (seasonMode && topHalfIds.has(entry.playerId)) classes.push("obere-haelfte");
          else if (seasonMode && bottomHalfIds.has(entry.playerId)) classes.push("untere-haelfte");

          let marker = "";
          if (seasonMode && topHalfIds.has(entry.playerId)) marker = '<span class="markierung">🍺</span>';
          else if (seasonMode && bottomHalfIds.has(entry.playerId)) marker = '<span class="markierung">💸</span>';
          else if (seasonMode) marker = '<span class="markierung">-</span>';

          return (
            '<tr class="' + classes.join(" ") + '">' +
            '<td class="ranking-cell">' + entry.platz + "</td>" +
            "<td>" + escapeHtml(entry.name) + "</td>" +
            "<td>" + entry.spiele + "</td>" +
            "<td>" + entry.punkte + "</td>" +
            "<td>" + (entry.differenz > 0 ? "+" + entry.differenz : entry.differenz) + "</td>" +
            "<td>" + entry.siegProzent + " %</td>" +
            (seasonMode ? "<td>" + marker + "</td>" : "") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function renderPlayers() {
    const players = state.data.players.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, "de");
    });

    elements.playerList.innerHTML = players
      .map(function (player) {
        return (
          '<article class="player-card"><h3>' + escapeHtml(player.name) + "</h3><div class=\"player-meta\"><span>Status: " +
          (player.active ? "Aktiv" : "Inaktiv") +
          "</span></div></article>"
        );
      })
      .join("");
  }

  async function loadData() {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      return JSON.parse(localData);
    }

    try {
      const response = await fetch("./data/data.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Die JSON-Daten konnten nicht geladen werden.");
      return await response.json();
    } catch (_error) {
      return cloneData(defaultData);
    }
  }

  function buildStandingsForSessions(data, sessions) {
    const map = new Map(
      data.players.map(function (player) {
        return [
          player.id,
          {
            playerId: player.id,
            name: player.name,
            spiele: 0,
            siege: 0,
            unentschieden: 0,
            niederlagen: 0,
            tore: 0,
            gegentore: 0,
            differenz: 0,
            punkte: 0,
            siegProzent: 0
          }
        ];
      })
    );

    sessions.forEach(function (session) {
      (session.results || []).forEach(function (result) {
        const standing = map.get(result.playerId);
        if (!standing) return;
        standing.spiele += 1;
        standing.tore += Number(result.goalsFor) || 0;
        standing.gegentore += Number(result.goalsAgainst) || 0;
        standing.differenz = standing.tore - standing.gegentore;
        if (result.goalsFor > result.goalsAgainst) {
          standing.siege += 1;
          standing.punkte += 3;
        } else if (result.goalsFor === result.goalsAgainst) {
          standing.unentschieden += 1;
          standing.punkte += 1;
        } else {
          standing.niederlagen += 1;
        }
      });
    });

    return Array.from(map.values())
      .sort(function (left, right) {
        if (right.punkte !== left.punkte) return right.punkte - left.punkte;
        if (right.spiele !== left.spiele) return right.spiele - left.spiele;
        if (right.differenz !== left.differenz) return right.differenz - left.differenz;
        return left.name.localeCompare(right.name, "de");
      })
      .map(function (standing, index) {
        standing.siegProzent = standing.spiele ? Math.round((standing.siege / standing.spiele) * 100) : 0;
        standing.ohneSpiele = standing.spiele === 0;
        standing.platz = index + 1;
        return standing;
      });
  }

  function getAvailableMonthOptions(data) {
    const options = Array.from(
      new Set(
        data.sessions.map(function (session) {
          return session.date.slice(0, 7);
        })
      )
    )
      .sort()
      .map(function (monthKey) {
        return { value: monthKey, label: formatMonth(monthKey) };
      });

    const currentMonth = getCurrentMonthKey();
    if (!options.some(function (option) { return option.value === currentMonth; })) {
      options.push({ value: currentMonth, label: formatMonth(currentMonth) });
    }

    return options.sort(function (left, right) {
      return left.value.localeCompare(right.value);
    });
  }

  function seedCurrentMonthSessions(data) {
    const monthKey = getCurrentMonthKey();
    if (data.sessions.some(function (session) { return session.date.slice(0, 7) === monthKey; })) return;

    data.sessions.push(
      { id: createId("session"), date: monthKey + "-02", label: "Monatsstart", results: baseMonthResultsA() },
      { id: createId("session"), date: monthKey + "-07", label: "Technikabend", results: baseMonthResultsB() }
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function baseMonthResultsA() {
    return [
      { playerId: "p1", teamId: "team-blau", goalsFor: 4, goalsAgainst: 2 },
      { playerId: "p2", teamId: "team-blau", goalsFor: 4, goalsAgainst: 2 },
      { playerId: "p3", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 },
      { playerId: "p4", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 },
      { playerId: "p5", teamId: "team-blau", goalsFor: 4, goalsAgainst: 2 },
      { playerId: "p6", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 },
      { playerId: "p7", teamId: "team-blau", goalsFor: 4, goalsAgainst: 2 },
      { playerId: "p8", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 4 }
    ];
  }

  function baseMonthResultsB() {
    return [
      { playerId: "p1", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 3 },
      { playerId: "p2", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 },
      { playerId: "p3", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 },
      { playerId: "p4", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 },
      { playerId: "p5", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 },
      { playerId: "p6", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 },
      { playerId: "p7", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 3 },
      { playerId: "p8", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 }
    ];
  }

  function normalizeData(data) {
    data.metadata = data.metadata || {};
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

  function getLatestSession(data) {
    return data.sessions
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      })[0] || null;
  }

  function getCurrentMonthKey() {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  function formatMonth(monthKey) {
    const parts = monthKey.split("-");
    return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(Number(parts[0]), Number(parts[1]) - 1, 1));
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
      sessions: [
        { id: "s1", date: "2026-01-14", label: "Dienstagstraining", results: [
          { playerId: "p1", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 },
          { playerId: "p2", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 },
          { playerId: "p3", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 },
          { playerId: "p4", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 },
          { playerId: "p5", teamId: "team-blau", goalsFor: 5, goalsAgainst: 3 },
          { playerId: "p6", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 }
        ] },
        { id: "s2", date: "2026-01-28", label: "Abendtraining", results: [
          { playerId: "p1", teamId: "team-weiss", goalsFor: 4, goalsAgainst: 4 },
          { playerId: "p2", teamId: "team-blau", goalsFor: 4, goalsAgainst: 4 },
          { playerId: "p3", teamId: "team-weiss", goalsFor: 4, goalsAgainst: 4 },
          { playerId: "p4", teamId: "team-blau", goalsFor: 4, goalsAgainst: 4 },
          { playerId: "p5", teamId: "team-blau", goalsFor: 4, goalsAgainst: 4 },
          { playerId: "p6", teamId: "team-weiss", goalsFor: 4, goalsAgainst: 4 }
        ] },
        { id: "s3", date: "2026-02-11", label: "Techniktraining", results: [
          { playerId: "p1", teamId: "team-blau", goalsFor: 6, goalsAgainst: 2 },
          { playerId: "p2", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 6 },
          { playerId: "p3", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 6 },
          { playerId: "p4", teamId: "team-blau", goalsFor: 6, goalsAgainst: 2 },
          { playerId: "p5", teamId: "team-blau", goalsFor: 6, goalsAgainst: 2 },
          { playerId: "p6", teamId: "team-weiss", goalsFor: 2, goalsAgainst: 6 }
        ] },
        { id: "s4", date: "2026-03-04", label: "Mittwochstraining", results: [
          { playerId: "p1", teamId: "team-weiss", goalsFor: 1, goalsAgainst: 2 },
          { playerId: "p2", teamId: "team-weiss", goalsFor: 1, goalsAgainst: 2 },
          { playerId: "p3", teamId: "team-blau", goalsFor: 2, goalsAgainst: 1 },
          { playerId: "p4", teamId: "team-blau", goalsFor: 2, goalsAgainst: 1 },
          { playerId: "p5", teamId: "team-blau", goalsFor: 2, goalsAgainst: 1 },
          { playerId: "p6", teamId: "team-weiss", goalsFor: 1, goalsAgainst: 2 }
        ] },
        { id: "s5", date: "2026-04-02", label: "April Auftakt", results: baseMonthResultsA() },
        { id: "s6", date: "2026-04-07", label: "April Technikabend", results: baseMonthResultsB() }
      ]
    };
  }
})();
