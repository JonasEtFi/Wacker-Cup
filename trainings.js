(function () {
  const STORAGE_KEY = "wacker-cup-data";
  const defaultData = getDefaultData();

  const state = {
    data: null,
    selectedSessionId: null
  };

  const elements = {
    trainingList: document.querySelector("#training-liste"),
    trainingDetail: document.querySelector("#training-detail")
  };

  bootstrap().catch(function (error) {
    document.body.innerHTML =
      '<main class="page-shell"><section class="card"><h1>Fehler</h1><p>' + escapeHtml(error.message) + "</p></section></main>";
  });

  async function bootstrap() {
    state.data = await loadData();
    normalizeData(state.data);
    seedCurrentMonthSessions(state.data);
    state.selectedSessionId = getLatestSession(state.data) ? getLatestSession(state.data).id : null;
    render();
  }

  function render() {
    renderTrainings();
  }

  function renderTrainings() {
    const sessions = state.data.sessions.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    if (!sessions.length) {
      elements.trainingList.innerHTML = "<p>Keine Trainings vorhanden.</p>";
      elements.trainingDetail.innerHTML = '<div class="training-detail-card"><p>Keine Trainings vorhanden.</p></div>';
      return;
    }

    if (!state.selectedSessionId) {
      state.selectedSessionId = sessions[0].id;
    }

    elements.trainingList.innerHTML = sessions
      .map(function (session) {
        const score = getSessionScoreSummary(session);
        return (
          '<button class="session-item session-button' +
          (session.id === state.selectedSessionId ? " is-selected" : "") +
          '" data-session-id="' +
          session.id +
          '" type="button"><div class="session-meta"><strong>' +
          escapeHtml(session.label || "Training") +
          '</strong><span class="session-line">' +
          formatDate(session.date) +
          "</span>" +
          renderScoreboard(score) +
          "</div></button>"
        );
      })
      .join("");

    elements.trainingList.querySelectorAll("[data-session-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedSessionId = button.dataset.sessionId;
        renderTrainings();
      });
    });

    const selected = sessions.find(function (session) {
      return session.id === state.selectedSessionId;
    }) || sessions[0];

    elements.trainingDetail.innerHTML = renderTrainingDetail(selected);
  }

  function renderTrainingDetail(session) {
    const score = getSessionScoreSummary(session);
    const playersById = new Map(state.data.players.map(function (player) { return [player.id, player.name]; }));
    const blau = (session.results || [])
      .filter(function (result) { return result.teamId === "team-blau"; })
      .map(function (result) { return playersById.get(result.playerId) || result.playerId; })
      .sort(function (a, b) { return a.localeCompare(b, "de"); });
    const weiss = (session.results || [])
      .filter(function (result) { return result.teamId === "team-weiss"; })
      .map(function (result) { return playersById.get(result.playerId) || result.playerId; })
      .sort(function (a, b) { return a.localeCompare(b, "de"); });

    return (
      '<div class="training-detail-card"><div class="box-header"><div><h3>' +
      escapeHtml(session.label || "Training") +
      "</h3><p class=\"helper\">" +
      formatDate(session.date) +
      "</p></div>" +
      renderScoreboard(score) +
      '</div><div class="training-teams"><div class="team-panel"><h4 class="team-panel-title"><span class="team-chip team-chip-blue"><img class="team-logo team-logo-inverted" src="./assets/hc-wacker-munchen.png" alt="Team Blau" /></span><span>Blau</span></h4><ul>' +
      renderNameList(blau) +
      '</ul></div><div class="team-panel"><h4 class="team-panel-title"><span class="team-chip"><img class="team-logo" src="./assets/hc-wacker-munchen.png" alt="Team Weiß" /></span><span>Weiß</span></h4><ul>' +
      renderNameList(weiss) +
      "</ul></div></div></div>"
    );
  }

  function renderNameList(names) {
    if (!names.length) return "<li>Niemand</li>";
    return names.map(function (name) { return "<li>" + escapeHtml(name) + "</li>"; }).join("");
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
          { playerId: "p4", teamId: "team-weiss", goalsFor: 3, goalsAgainst: 5 }
        ] }
      ]
    };
  }
})();
