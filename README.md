# Schafkopf

Schafkopf als Web-App (PWA): Du spielst gegen drei Computergegner (Sepp, Vroni, Xaver).
Die App lässt sich auf PC und Handy installieren und läuft danach auch offline.

- Spielarten: **Sauspiel**, **Wenz**, **Farbsolo**
- Abrechnung mit Tarif: Sauspiel 10 ct, Wenz/Solo 50 ct, Schneider, Schwarz, Laufende
- Der Kontostand wird im Browser gespeichert
- Knopf für den letzten Stich und eine Regel-Hilfe
- Karten im bayerischen Stil, selbst gezeichnet (SVG). Eigene Bilder gehen auch, siehe `karten/LIESMICH.txt`

## Starten

Die App braucht einen kleinen Webserver, weil Browser JavaScript-Module nicht direkt aus einer Datei laden:

```bash
cd schafkopf
python3 -m http.server 8000
```

Dann im Browser **http://localhost:8000** öffnen.

## Als App installieren

- **PC (Chrome/Edge):** In der Adressleiste auf das Installieren-Symbol klicken („App installieren“).
- **Handy:** Die App muss über **HTTPS** erreichbar sein, z. B. kostenlos über GitHub Pages:
  den Ordner `schafkopf` in ein GitHub-Repository hochladen und unter *Settings → Pages* einschalten.
  Danach die Seite am Handy öffnen und „Zum Startbildschirm hinzufügen“ wählen.

Wenn du später Dateien änderst, erhöhe in `sw.js` die Versionsnummer (`schafkopf-v1` → `schafkopf-v2`).
Sonst zeigen bereits installierte Apps weiter die alte Version.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/rules.js` | Karten, Trumpfreihenfolge, erlaubte Karten (Farbzwang, Rufsau), Stiche, Abrechnung |
| `js/ai.js` | Computergegner: Faustregeln und Monte-Carlo-Suche |
| `js/cards.js` | Kartenbilder (SVG) und eigene Bilder aus `karten/` |
| `js/app.js` | Spielablauf und Oberfläche |
| `sw.js`, `manifest.webmanifest` | Installierbarkeit und Offline-Betrieb |
| `tests/test.js` | Regeltests und Computer-gegen-Computer-Spiele |

## Wie die KI denkt

Ist ein Computer dran, verteilt er die Karten, die er nicht kennt, viele Male zufällig auf die anderen.
Dabei hält er sich an alles, was er beobachtet hat: Wer nicht bedienen konnte, hat die Farbe nicht.
Wer gesucht wurde und die Sau nicht gebracht hat, hat sie nicht. Und wer ein Solo spielt, hat viele Trümpfe.
Für jede dieser Verteilungen spielt er jede erlaubte Karte bis zum Ende durch und nimmt die Karte
mit dem besten Durchschnittsergebnis. Beim Reizen probiert er jedes mögliche Spiel in vielen
Probespielen aus und spielt nur, wenn er oft genug gewinnt.

Die Monte-Carlo-KI holt in Tests im Schnitt etwa 7 Augen pro Spiel mehr als die einfachen Faustregeln.

## Tests

```bash
node tests/test.js        # 40 Spiele
node tests/test.js 200    # mehr Spiele
```

## Vereinfachungen

- Wollen mehrere spielen, gewinnt das höhere Spiel (Solo > Wenz > Sauspiel). Bei Gleichstand hat der Vorrang, der früher dran ist. Ein Nachreizen gibt es nicht.
- Kein Ramsch, kein Klopfen/Kontra, kein Tout. Sagen alle „weiter“, wird neu gegeben.
