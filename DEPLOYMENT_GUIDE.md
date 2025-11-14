# 🚀 Deployment-Anleitung: Schritt für Schritt

Diese Anleitung führt Sie durch den kompletten Deployment-Prozess für Ihren Crypto Trading Bot.

---

## 📋 Checkliste

- [x] `.env` Datei mit Supabase Service Key erstellt
- [x] GitHub Repository erstellt
- [ ] Code zu GitHub pushen
- [ ] Supabase-Datenbank einrichten
- [ ] Render-Deployment konfigurieren
- [ ] Bot testen

---

## 1️⃣ CODE ZU GITHUB PUSHEN

Öffnen Sie ein Terminal/PowerShell im Projektverzeichnis und führen Sie folgende Befehle aus:

```bash
# Git initialisieren (falls noch nicht geschehen)
git init

# Alle Dateien zum Staging hinzufügen
git add .

# Ersten Commit erstellen
git commit -m "Initial commit: Trading Bot Backend mit Supabase Integration"

# Remote Repository hinzufügen
git remote add origin https://github.com/YourSolutionsAI/new-crypto-trading-system.git

# Branch umbenennen (falls nötig)
git branch -M main

# Code zu GitHub pushen
git push -u origin main
```

**✅ Ergebnis:** Ihr Code ist jetzt auf GitHub verfügbar!

---

## 2️⃣ SUPABASE DATENBANK EINRICHTEN

### Schritt 2.1: Supabase Dashboard öffnen
1. Gehen Sie zu [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Melden Sie sich an
3. Wählen Sie Ihr Projekt aus (ID: `snemqjltnqflyfrmjlpj`)

### Schritt 2.2: SQL Editor öffnen
1. Klicken Sie in der linken Seitenleiste auf **"SQL Editor"**
2. Klicken Sie auf **"New query"**

### Schritt 2.3: Datenbank-Schema erstellen
1. Öffnen Sie die Datei `supabase_setup.sql` in Ihrem Projekt
2. Kopieren Sie den **gesamten Inhalt**
3. Fügen Sie ihn in den SQL Editor ein
4. Klicken Sie auf **"Run"** (oder drücken Sie `Ctrl+Enter`)

**✅ Ergebnis:** Folgende Tabellen werden erstellt:
- `strategies` - Trading-Strategien
- `trades` - Handelshistorie
- `bot_logs` - Bot-Protokolle
- `market_data` - Marktdaten (optional)
- `bot_settings` - Globale Einstellungen

### Schritt 2.4: Tabellen überprüfen
1. Klicken Sie auf **"Table Editor"** in der Seitenleiste
2. Sie sollten alle erstellten Tabellen sehen
3. Die Tabelle `strategies` sollte bereits eine Beispiel-Strategie enthalten

---

## 3️⃣ RENDER DEPLOYMENT EINRICHTEN

### Schritt 3.1: Render Account erstellen
1. Gehen Sie zu [https://render.com](https://render.com)
2. Klicken Sie auf **"Get Started for Free"**
3. Melden Sie sich mit GitHub an (empfohlen)

### Schritt 3.2: Neuen Web Service erstellen
1. Klicken Sie im Dashboard auf **"New +"**
2. Wählen Sie **"Web Service"**

### Schritt 3.3: Repository verbinden
1. Suchen Sie nach `new-crypto-trading-system`
2. Klicken Sie auf **"Connect"**

### Schritt 3.4: Service konfigurieren
Füllen Sie das Formular wie folgt aus:

| Feld | Wert |
|------|------|
| **Name** | `crypto-trading-bot` (oder ein anderer Name) |
| **Region** | Europe (Frankfurt) - näher an Ihrem Standort |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (zunächst) |

### Schritt 3.5: Umgebungsvariablen hinzufügen
Scrollen Sie nach unten zu **"Environment Variables"**:

1. Klicken Sie auf **"Add Environment Variable"**
2. Fügen Sie hinzu:

```
Key: SUPABASE_SERVICE_KEY
Value: [Ihr Supabase Service Role Key aus der .env Datei]
```

**⚠️ WICHTIG:** Kopieren Sie den kompletten Service Key aus Ihrer `.env` Datei!

### Schritt 3.6: Deployment starten
1. Klicken Sie auf **"Create Web Service"**
2. Render beginnt automatisch mit dem Deployment
3. Warten Sie 2-3 Minuten

**✅ Ergebnis:** Ihr Bot läuft jetzt live auf Render!

### Schritt 3.7: URL notieren
Nach erfolgreichem Deployment finden Sie die URL oben:
```
https://crypto-trading-bot-xxxx.onrender.com
```

**Speichern Sie diese URL!** Sie benötigen sie später für das Frontend.

---

## 4️⃣ BOT TESTEN

### Test 1: Status abfragen
Öffnen Sie in einem Browser oder mit curl/Postman:

```
https://crypto-trading-bot-xxxx.onrender.com/api/status
```

**Erwartete Antwort:**
```json
{
  "status": "gestoppt",
  "timestamp": "2024-11-14T10:30:00.000Z"
}
```

### Test 2: Bot starten
Verwenden Sie curl oder Postman:

```bash
curl -X POST https://crypto-trading-bot-xxxx.onrender.com/api/start-bot
```

**Erwartete Antwort:**
```json
{
  "success": true,
  "message": "Trading-Bot wird gestartet",
  "status": "startet..."
}
```

### Test 3: Logs überprüfen
1. Gehen Sie zurück zu Render
2. Klicken Sie auf Ihren Service
3. Wählen Sie **"Logs"** aus
4. Sie sollten Meldungen wie diese sehen:

```
🚀 Trading-Bot wird gestartet...
📊 Lade Trading-Strategien von Supabase...
🔌 Stelle Verbindung zu Binance her...
✅ Verbindung zu Binance erfolgreich hergestellt
💰 BTC/USDT Preis: 37245.50 USDT
```

### Test 4: Bot stoppen
```bash
curl -X POST https://crypto-trading-bot-xxxx.onrender.com/api/stop-bot
```

**✅ Wenn alle Tests erfolgreich sind, funktioniert Ihr Bot!**

---

## 5️⃣ FRONTEND VORBEREITEN (Optional, für später)

Wenn Sie ein Frontend auf Vercel deployen möchten:

### Schritt 5.1: CORS-Konfiguration aktualisieren
Wenn Sie Ihre Vercel-URL kennen, aktualisieren Sie `server.js`:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://ihre-app.vercel.app',  // Ihre Vercel-URL hinzufügen
    /\.vercel\.app$/
  ],
  // ...
};
```

Pushen Sie die Änderung zu GitHub - Render wird automatisch neu deployen.

---

## 🎯 NÄCHSTE SCHRITTE

### Kurzfristig:
1. ✅ Bot läuft und ist erreichbar
2. 🔄 Strategien in Supabase anpassen und aktivieren
3. 🔄 Weitere API-Endpunkte hinzufügen (z.B. Statistiken abrufen)

### Mittelfristig:
1. 🔄 Frontend entwickeln (React + Vercel)
2. 🔄 Trading-Logik implementieren
3. 🔄 Binance API-Integration für echte Orders

### Langfristig:
1. 🔄 Erweiterte Strategien (ML, Technical Indicators)
2. 🔄 Backtesting-System
3. 🔄 Benachrichtigungen (E-Mail, Telegram)
4. 🔄 Multi-Exchange-Support

---

## 🆘 TROUBLESHOOTING

### Problem: "SUPABASE_SERVICE_KEY ist nicht gesetzt"
**Lösung:** Überprüfen Sie die Umgebungsvariablen in Render:
1. Gehen Sie zu Ihrem Service
2. Klicken Sie auf "Environment"
3. Stellen Sie sicher, dass `SUPABASE_SERVICE_KEY` gesetzt ist
4. Wenn Sie es ändern, klicken Sie auf "Manual Deploy" → "Deploy latest commit"

### Problem: "Connection refused" oder 502 Error
**Lösung:** 
- Warten Sie 1-2 Minuten nach dem Deployment
- Überprüfen Sie die Logs in Render
- Stellen Sie sicher, dass der Server auf Port `0.0.0.0` bindet (ist bereits konfiguriert)

### Problem: Bot startet nicht
**Lösung:**
1. Überprüfen Sie die Logs in Render
2. Testen Sie die Supabase-Verbindung
3. Prüfen Sie, ob `npm install` erfolgreich war

### Problem: CORS-Fehler im Browser
**Lösung:**
- Fügen Sie Ihre Frontend-URL zur `corsOptions` in `server.js` hinzu
- Pushen Sie die Änderung zu GitHub

---

## 📞 SUPPORT

Bei Fragen oder Problemen:
- GitHub Issues: [https://github.com/YourSolutionsAI/new-crypto-trading-system/issues](https://github.com/YourSolutionsAI/new-crypto-trading-system/issues)
- Render Docs: [https://render.com/docs](https://render.com/docs)
- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)

---

**🎉 Herzlichen Glückwunsch! Ihr Trading Bot ist jetzt live!**

