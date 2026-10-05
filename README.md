# 👑 Clash Royale Clan-Management Discord Bot

Ein professioneller, leichtgewichtiger und vollautomatischer Discord Bot für Clash Royale Clan-Leader und Co-Leader. Der Bot dient als **reines Admin-Tool** (keine störenden Pings an Spieler), überwacht Clankriege (River Race) und postet pünktlich zum Kriegsende einen detaillierten Abschlussbericht inklusive Verwarnung und automatischer Kick-Vorschläge.

---

## ⚡ Kernfunktionen

- **⏰ Pünktlicher Abschlussbericht:** Sendet zum eingestellten Kriegsende (standardmäßig 12:00 Uhr Berliner Zeit) einen formatierten Discord-Embed-Bericht.
- **🎯 Exakte Beteiligungsprüfung:** Erkennt Clanmitglieder, die weniger als 4 Angriffe durchgeführt haben (`4 - gespielte Decks`).
- **💾 SQLite-Datenbank (Persistent):** Speichert kumulativ alle verpassten Decks pro Spieler in einer lokalen Datenbank (`clashbot.db`).
- **🚨 Automatische Kick-Vorschläge:** Spieler mit **5 oder mehr verpassten Decks** werden im Tagesbericht prominent als Kick-Kandidaten ausgewiesen.
- **🛠️ Vollständige Admin & Co-Leader Slash-Commands:**
  - `/wasistdasproblem [user]` – Diagnose-Tool (für alle Rollen zugänglich): Prüft Berechtigungen, Rollen und Kanaleinstellungen.
  - `/erlauberolle [Rolle]` – Erlaubt einer Rolle (z. B. `@Co-Leader`) die volle Bot-Nutzung ohne Discord-Admin-Rechte.
  - *(Tipp: Nutzer mit der Rolle `Passkontroll-User` haben automatisch vollen Zugriff auf alle Befehle!)*
  - `/angriffe` – Live-Kriegsstatus sofort abrufen (welche Decks fehlen heute noch?).
  - `/erinnerung` – Erstellt eine fertige Erinnerungsnachricht (`@Name (offene Decks)`) zum Pingen/Kopieren.
  - `/verwarnungen` – Gesamtübersicht aller Spieler mit verpassten Decks & Kick-Kandidaten (ab 5+ Decks).
  - `/setclan [Clan-Tag]` – Clan festlegen oder wechseln (z. B. `#2PP`).
  - `/setchannel` – Aktuellen Kanal als Ziel für Berichte festlegen.
  - `/settime [HH:MM]` – Kriegsende-Uhrzeit in `Europe/Berlin` anpassen (z. B. `11:30`).
  - `/seterinnerung [Text]` – Eigenen Einleitungstext für die `/erinnerung` Nachricht hinterlegen.
  - `/resetstrikes [Spieler-Tag]` – Verpasste Decks für einen einzelnen Spieler auf 0 zurücksetzen.
  - `/resetallstrikes` – Setzt die Verwarnungen **aller** Spieler auf 0 zurück (mit Bestätigungsabfrage).
  - `/help` – Zeigt eine formatierte Übersicht aller Befehle.

---

## 📁 Projektstruktur

```
clash-royale-bot/
├── data/                      # Persistente SQLite-Datenbank (wird in Docker gemountet)
│   └── clashbot.db
├── src/
│   ├── commands/              # Slash Commands (/angriffe, /erinnerung, /warumgehtsnicht, etc.)
│   ├── services/
│   │   ├── clashRoyale.js     # Offizielle Supercell API Anbindung & Logik
│   │   ├── database.js        # better-sqlite3 / node:sqlite Verwaltung & Historie
│   │   ├── scheduler.js       # node-cron Zeitsteuerung (Europe/Berlin)
│   │   └── reportService.js   # Generierung des Abschlussberichts
│   ├── utils/
│   │   └── embeds.js          # Schöne Discord-Embed-Vorlagen
│   ├── config.js              # Konfiguration & Validierung
│   └── index.js               # Haupteinstiegspunkt & Bot-Client
├── Dockerfile                 # Multi-Stage Alpine Dockerfile (minimaler RAM-Bedarf)
├── docker-compose.yml         # Container-Orchestrierung mit Auto-Restart
├── .env.example               # Vorlage für Umgebungsvariablen
└── package.json
```

---

## 🚀 Schritt-für-Schritt-Anleitung: Deployment auf Google Cloud (e2-micro Free Tier)

Diese Anleitung ist so aufgebaut, dass du den Bot ohne Vorkenntnisse in weniger als 15 Minuten dauerhaft und **100% kostenlos** auf einer Google Cloud Compute Engine Instanz betreiben kannst.

---

### Schritt 1: Discord Bot erstellen & einladen

1. Öffne das [Discord Developer Portal](https://discord.com/developers/applications) und logge dich ein.
2. Klicke oben rechts auf **"New Application"**, vergib einen Namen (z. B. `Clash Royale Manager`) und klicke auf **Create**.
3. Gehe im linken Menü auf **"Bot"**:
   - Klicke auf **"Reset Token"** (oder Copy Token) und speichere dir diesen Token sicher ab (**`DISCORD_TOKEN`**).
4. Gehe im linken Menü auf **"General Information"**:
   - Kopiere die **APPLICATION ID** (**`DISCORD_CLIENT_ID`**).
5. Bot auf deinen Server einladen:
   - Gehe im linken Menü auf **"Installation"** (oder **OAuth2 ➔ URL Generator**).
   - Wähle unter Scopes: `bot` und `applications.commands`.
   - Wähle unter Bot Permissions: `Administrator` (oder mindestens `Send Messages`, `Embed Links`, `View Channels`).
   - Kopiere die generierte URL, öffne sie im Browser und lade den Bot auf deinen Discord-Server ein.

---

### Schritt 2: Kostenlose Google Cloud VM (e2-micro) erstellen

Google Cloud bietet dauerhaft **eine kostenlose `e2-micro` VM** im "Free Tier" an.

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/).
2. Navigiere zu **Compute Engine ➔ VM-Instanzen** und klicke auf **"Instanz erstellen"** (Create Instance).
3. Konfiguriere die Instanz wie folgt:
   - **Name:** `clash-bot-server`
   - **Region:** Wähle eine der kostenlosen Regionen:
     - `us-central1` (Iowa), `us-east1` (South Carolina) oder `us-west1` (Oregon)
   - **Maschinenkonfiguration:**
     - Serie: `E2`
     - Maschinentyp: `e2-micro` *(2 vCPU, 1 GB Arbeitsspeicher – für unseren schlanken Bot mehr als genug!)*
   - **Boot-Disk:**
     - Betriebssystem: `Ubuntu`
     - Version: `Ubuntu 22.04 LTS` (oder `Debian 12`)
     - Größentyp: Standard Persistent Disk (bis zu 30 GB sind im Free Tier kostenlos)
   - **Firewall:** Standard belassen (keine offenen Web-Ports nötig, da der Bot sich ausgehend zu Discord verbindet).
4. Klicke unten auf **"Erstellen"**. Nach ca. 30 Sekunden läuft deine VM!

---

### Schritt 3: Externe IP notieren & Clash Royale API-Key erstellen

Supercell schützt die API über eine IP-Freigabe. Dein API-Token muss die externe IP deiner VM kennen:

1. In der Google Cloud VM-Übersicht siehst du in der Spalte **"Externe IP"** eine IPv4-Adresse (z. B. `34.123.45.67`). **Kopiere diese IP!**
2. Gehe auf die offizielle [Clash Royale Developer Seite](https://developer.clashroyale.com/) und logge dich mit deiner Supercell-ID ein.
3. Klicke oben rechts auf deinen Accountnamen ➔ **"My Account"** ➔ **"Create New Key"**:
   - **Key Name:** `GCP Bot`
   - **Description:** `Discord Bot Server`
   - **Allowed IP Addresses:** Füge hier die soeben kopierte externe IP deiner Google Cloud VM ein.
4. Klicke auf **"Create Key"** und kopiere den langen Token-String (**`CLASH_ROYALE_API_KEY`**).

---

### Schritt 4: Auf der VM einloggen & Docker installieren

1. Klicke in der Google Cloud Konsole bei deiner VM einfach auf die blaue Schaltfläche **"SSH"**. Ein Terminal-Fenster im Browser öffnet sich direkt.
2. Führe im SSH-Terminal diesen Einzeiler aus, um Docker und Docker Compose automatisch zu installieren:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
3. Melde dich kurz neu an, damit die Docker-Gruppenrechte aktiv werden:
   ```bash
   newgrp docker
   ```
4. Überprüfe die Installation:
   ```bash
   docker --version
   docker compose version
   ```

---

### Schritt 5: Bot-Projekt auf die VM übertragen

#### Option A: Über Git / GitHub (Sehr empfohlen)
Klone dein Repository direkt mit einem Befehl auf die VM:
```bash
git clone https://github.com/leNyHo/passkontrolle.git clash-bot
cd clash-bot
```

#### Option B: Direkt per SCP / Google Cloud Upload
Alternativ kannst du oben rechts im SSH-Fenster auf das **Zahnrad-Symbol ➔ "Datei hochladen"** klicken und die Projektdateien als Zip hochladen und entpacken:
```bash
sudo apt update && sudo apt install -y unzip
unzip clash-royale-bot.zip -d clash-bot
cd clash-bot
```

---

### Schritt 6: `.env` Datei mit Tokens ausfüllen

Erstelle auf der VM im Bot-Ordner deine Konfigurationsdatei:
```bash
cp .env.example .env
nano .env
```
Fülle die drei Pflichtfelder mit deinen Daten aus:
```env
DISCORD_TOKEN=dein_discord_bot_token_aus_schritt_1
DISCORD_CLIENT_ID=deine_discord_client_id_aus_schritt_1
CLASH_ROYALE_API_KEY=dein_supercell_api_key_aus_schritt_3
DEFAULT_CLAN_TAG=#2PP
TZ=Europe/Berlin
```
*(Drücke `STRG + O` und `ENTER` zum Speichern, dann `STRG + X` zum Verlassen des Editors).*

---

### Schritt 7: Bot starten & überwachen

Starte den Bot mit Docker Compose im Hintergrund:
```bash
docker compose up -d --build
```

**Logs live ansehen:**
```bash
docker compose logs -f
```
Du wirst sehen:
```text
[Discord] Eingeloggt als Clash Royale Manager#1234
[Commands] Registriere 10 globale Slash-Commands bei Discord...
[Commands] Slash-Commands erfolgreich registriert!
[Scheduler] Kriegsende-Job für Server registriert: "0 12 * * *" (Europe/Berlin)
```
*(Mit `STRG + C` verlässt du die Log-Ansicht wieder. Der Bot läuft im Hintergrund weiter!)*

---

### Schritt 8: Bot im Discord einrichten

Gehe in deinen Discord-Server in deinen Admin-Kanal und führe nacheinander folgende Befehle aus:

1. **Clan festlegen:**
   ```
   /setclan tag:#DEIN_CLANTAG
   ```
   *Beispiel: `/setclan tag:#2PP`* – Der Bot bestätigt sofort Clan-Name und Mitgliederzahl.

2. **Admin-Kanal für den täglichen Report festlegen:**
   ```
   /setchannel
   ```
   *Führe dies direkt im gewünschten Zielkanal aus.*

3. **Rolle für Nicht-Admins freischalten (z. B. Co-Leader):**
   ```
   /erlauberolle rolle:@Co-Leader
   ```
   *Ermöglicht Mitgliedern mit dieser Rolle alle Befehle zu nutzen, ohne dass sie Discord-Administrator-Rechte auf dem Server besitzen müssen.*

4. **Kriegsende-Uhrzeit anpassen (optional, Standard ist 12:00 Uhr):**
   ```
   /settime uhrzeit:12:00
   ```

4. **Eigenen Erinnerungstext festlegen (optional):**
   ```
   /seterinnerung text:Folgende Spieler haben noch Decks offen:
   ```

5. **Erinnerungsnachricht für Clanmitglieder generieren:**
   ```
   /erinnerung
   ```
   *Generiert sofort den Text mit Spielernamen (`@Name (offene Decks)`) zum Kopieren oder Ankündigen.*

6. **Live-Zwischenstand abrufen:**
   ```
   /angriffe
   ```
   *Zeigt dir in Echtzeit ein übersichtliches Embed an, wer heute noch Angriffe offen hat.*

7. **Verwarnungsliste & Kick-Vorschläge einsehen:**
   ```
   /verwarnungen
   ```

8. **Verwarnungen eines Spielers zurücksetzen:**
   ```
   /resetstrikes tag:#SPIELERTAG
   ```

9. **Alle Verwarnungen zurücksetzen (mit Bestätigung):**
   ```
   /resetallstrikes
   ```

10. **Diagnose-Tool ausführen (für alle Rollen freigeschaltet):**
    ```
    /wasistdasproblem
    /wasistdasproblem user:@Name
    ```
    *Prüft sofort Bot-Rechte, Kanal-Sichtbarkeit und die Rolle `Passkontroll-User`. Gibt bei Fehlern eine genaue Fehlerursache aus.*

11. **Hilfe aufrufen:**
    ```
    /help
    ```

---

## 🔧 Nützliche Befehle & Wartung

- **Bot stoppen:**
  ```bash
  docker compose down
  ```
- **Bot neu starten:**
  ```bash
  docker compose restart
  ```
- **Neuen Code / Updates einspielen:**
  ```bash
  git pull
  docker compose up -d --build
  ```
- **Datenbank sichern:**
  Die SQLite-Datenbank liegt persistent in `data/clashbot.db` auf deinem Host-System und überlebt jeden Container-Neustart oder Rebuild. Du kannst die Datei einfach per SCP oder Cloud Console herunterladen.
