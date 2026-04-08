# Wacker Cup

Statische Wacker-Cup-Webseite fuer GitHub Pages.

## Struktur

- `index.html`: Landing Page mit Monats- und Saisontabelle
- `trainings.html`: alle Trainingsergebnisse mit Seitenleiste
- `training.html`: Training hinzufuegen und bearbeiten
- `admin.html`: Spieler anlegen, bearbeiten, loeschen
- `data/data.json`: Datenquelle fuer GitHub Pages

## Lokal testen

1. `index.html` direkt im Browser oeffnen
2. Fuer Aenderungen `admin.html` und `training.html` verwenden
3. Passwort: `HCWAP`

Die Seite funktioniert ohne Build-Schritt und ohne Backend.

## Workflow fuer Datenupdates

1. Lokal auf `admin.html` oder `training.html` Aenderungen machen
2. `JSON exportieren` klicken
3. Die exportierte Datei `data.json` nach [data/data.json](/Users/jonasfischer/Wacker-Cup/data/data.json) kopieren bzw. ersetzen
4. Aenderungen committen und nach GitHub pushen

## GitHub Pages

1. Repository nach GitHub pushen
2. In GitHub unter `Settings -> Pages` die Branch `main` und den Root-Ordner `/` waehlen
3. Speichern
4. Nach dem ersten Build ist die Seite ueber GitHub Pages erreichbar

## Hinweis

- Secrets gehoeren nicht in GitHub Pages
- Die Seite benutzt absichtlich nur statische Dateien plus `data/data.json`
- Browser-Aenderungen landen zunaechst im `localStorage`, bis du sie exportierst
