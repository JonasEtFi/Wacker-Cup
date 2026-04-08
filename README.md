# Wacker Cup

Wacker-Cup-Webseite mit lokalem Node-Server fuer direkte Updates an `data/data.json`.

## Struktur

- `index.html`: Landing Page mit Monats- und Saisontabelle
- `trainings.html`: alle Trainingsergebnisse mit Seitenleiste
- `training.html`: Training hinzufuegen und bearbeiten
- `admin.html`: Spieler anlegen, bearbeiten, loeschen
- `data/data.json`: Datenquelle fuer GitHub Pages
- `server.js`: lokaler Server mit Schreibzugriff auf `data/data.json`

## Lokal testen

1. In den Projektordner wechseln:
   `cd /Users/jonasfischer/Wacker-Cup`
2. Lokalen Server starten:
   `node server.js`
3. Im Browser oeffnen:
   `http://127.0.0.1:8000/index.html`
4. Fuer Aenderungen `admin.html` und `training.html` verwenden
5. Passwort: `HCWAP`

Wenn du lokal ueber `node server.js` arbeitest, speichert die App Aenderungen direkt in `data/data.json`.
Online auf GitHub Pages liest die App dieselbe Datei nur lesend.

## Workflow fuer Datenupdates

1. Server starten:
   `cd /Users/jonasfischer/Wacker-Cup`
   `node server.js`
2. Lokal auf `admin.html` oder `training.html` Aenderungen machen
3. Die App schreibt direkt nach [data/data.json](/Users/jonasfischer/Wacker-Cup/data/data.json)
4. Git-Status pruefen:
   `git status`
5. Nur die JSON pushen:
   `git add data/data.json`
   `git commit -m "Update training data"`
   `git push`

Wenn du auch Code-Aenderungen pushen willst:

- `git add admin.html admin.js app.js training.html training.js trainings.html trainings.js styles.css README.md server.js`
- `git commit -m "Update app"`
- `git push`

Es gibt keinen stillen `localStorage`-Stand.
Neu laden zeigt lokal und online denselben JSON-Stand.

## GitHub Pages

1. Repository nach GitHub pushen
2. In GitHub unter `Settings -> Pages` die Branch `main` und den Root-Ordner `/` waehlen
3. Speichern
4. Nach dem ersten Build ist die Seite ueber GitHub Pages erreichbar

## Hinweis

- Secrets gehoeren nicht in GitHub Pages
- GitHub Pages kann `data/data.json` nur lesen, nicht schreiben
- Direktes Schreiben funktioniert lokal nur ueber `node server.js`
