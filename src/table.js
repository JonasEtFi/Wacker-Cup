import { formatMonth } from "./utils.js";

function createEmptyStanding(player) {
  return {
    playerId: player.id,
    name: player.name,
    number: player.number ?? "",
    teamId: player.teamId ?? "",
    spiele: 0,
    siege: 0,
    unentschieden: 0,
    niederlagen: 0,
    tore: 0,
    gegentore: 0,
    differenz: 0,
    punkte: 0,
    siegProzent: 0
  };
}

function applyResult(standing, result) {
  standing.spiele += 1;
  standing.tore += Number(result.goalsFor) || 0;
  standing.gegentore += Number(result.goalsAgainst) || 0;
  standing.differenz = standing.tore - standing.gegentore;

  if (result.goalsFor > result.goalsAgainst) {
    standing.siege += 1;
    standing.punkte += 3;
    return;
  }

  if (result.goalsFor === result.goalsAgainst) {
    standing.unentschieden += 1;
    standing.punkte += 1;
    return;
  }

  standing.niederlagen += 1;
}

function sortStandings(standings) {
  return standings.sort((left, right) => {
    if (right.punkte !== left.punkte) return right.punkte - left.punkte;
    if (right.spiele !== left.spiele) return right.spiele - left.spiele;
    if (right.differenz !== left.differenz) return right.differenz - left.differenz;
    return left.name.localeCompare(right.name, "de");
  });
}

export function buildSeasonStandings(data) {
  return buildStandingsForSessions(data, data.sessions);
}

export function buildMonthlyStandings(data, monthKey) {
  const sessions = data.sessions.filter((session) => session.date.startsWith(monthKey));
  return buildStandingsForSessions(data, sessions);
}

function buildStandingsForSessions(data, sessions) {
  const map = new Map(data.players.map((player) => [player.id, createEmptyStanding(player)]));

  sessions.forEach((session) => {
    session.results.forEach((result) => {
      const standing = map.get(result.playerId);
      if (!standing) return;
      applyResult(standing, result);
      standing.teamId = result.teamId || standing.teamId;
    });
  });

  return sortStandings(Array.from(map.values())).map((standing, index) => ({
    ...standing,
    siegProzent: standing.spiele ? Math.round((standing.siege / standing.spiele) * 100) : 0,
    ohneSpiele: standing.spiele === 0,
    platz: index + 1
  }));
}

export function getMonthOptions(data) {
  const monthKeys = [...new Set(data.sessions.map((session) => session.date.slice(0, 7)))].sort();
  return monthKeys.map((monthKey) => ({
    value: monthKey,
    label: formatMonth(monthKey)
  }));
}
