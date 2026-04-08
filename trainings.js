(function () {
  const API_URL = "/api/data";

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
    try {
      const response = await fetch(getDataUrl(), { cache: "no-store" });
      if (!response.ok) throw new Error("Die JSON-Daten konnten nicht geladen werden.");
      return await response.json();
    } catch (_error) {
      throw new Error("Die JSON-Daten konnten nicht geladen werden. Bitte die Seite ueber einen lokalen Server oder GitHub Pages aufrufen.");
    }
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

  function formatDate(dateString) {
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateString));
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
