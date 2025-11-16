# 🔧 Backend Setup Checklist - Exchange Info Sync

## ❌ Fehler: 500 Internal Server Error bei `/api/exchange-info/sync`

### Mögliche Ursachen & Lösungen

---

## 1. ✅ Axios installiert prüfen

```bash
# Im Backend-Verzeichnis (Projekt-Root)
npm list axios

# Sollte zeigen:
# ├── axios@1.6.2
```

**Falls nicht installiert:**
```bash
npm install axios
```

---

## 2. 🔍 SQL-Tabellen angelegt?

**WICHTIGSTE URSACHE!**

Die Tabellen `binance_rate_limits` und `coin_exchange_info` müssen existieren!

### Prüfung in Supabase:

1. Öffne Supabase Dashboard
2. Gehe zu **Table Editor**
3. Prüfe ob folgende Tabellen existieren:
   - ✅ `binance_rate_limits`
   - ✅ `coin_exchange_info`
   - ✅ `coin_exchange_info_history`
   - ✅ `coin_alerts`

### Wenn Tabellen FEHLEN:

```sql
-- In Supabase SQL Editor
-- Datei: Supabase SQL Setups/coin_exchange_info.sql
-- → Kompletten Inhalt kopieren
-- → In SQL Editor einfügen
-- → "Run" klicken (oder F5)
-- → Sollte "Success" zeigen
```

---

## 3. 🌐 Binance API erreichbar?

### Test:

```bash
# In Browser oder Terminal
curl https://testnet.binance.vision/api/v3/exchangeInfo

# Sollte JSON mit "symbols" zurückgeben
```

**Falls nicht erreichbar:**
- Prüfe Internetverbindung
- Prüfe Firewall
- Testnet könnte down sein (selten)

---

## 4. 🔑 Supabase-Verbindung OK?

### Prüfung:

```bash
# Backend-Logs prüfen beim Start
node server.js

# Sollte zeigen:
# ✅ Supabase-Key: ✅ gesetzt
```

**Falls FEHLT:**
```bash
# Environment Variable setzen
export SUPABASE_SERVICE_KEY="dein-key-hier"
```

---

## 5. 📊 Backend-Logs prüfen

### Wenn Sync fehlschlägt:

```bash
# Terminal wo node server.js läuft
# Sollte zeigen:
# 🔄 Starting Exchange Info Sync...
# ❌ Fehler ... (mit Details)
```

**Häufige Fehler:**

### Fehler: "relation does not exist"
```
Lösung: SQL-Tabellen fehlen!
→ coin_exchange_info.sql in Supabase ausführen
```

### Fehler: "ENOTFOUND" oder "ECONNREFUSED"
```
Lösung: Binance API nicht erreichbar
→ Internetverbindung prüfen
→ URL prüfen: https://testnet.binance.vision/api/v3/exchangeInfo
```

### Fehler: "permission denied"
```
Lösung: Supabase Service Key fehlt oder falsch
→ .env prüfen
→ SUPABASE_SERVICE_KEY setzen
```

---

## 6. ✅ Erfolgreicher Sync

### Was du sehen solltest:

**Backend-Logs:**
```
🔄 Starting Exchange Info Sync...
📊 Syncing 5 symbols: [ 'BTCUSDT', 'ETHUSDT', ... ]
✅ Loaded 2000 symbols from Binance
📊 Syncing Rate Limits...
✅ Synced 3 Rate Limits
✅ Synced BTCUSDT
✅ Synced ETHUSDT
...
🎉 Sync completed: 5 success, 0 errors
```

**Frontend:**
```
✅ Synchronisiert: 5 von 5 Symbolen
```

---

## 🚀 Quick Fix Workflow

### Schritt 1: SQL ausführen
```
1. Supabase Dashboard öffnen
2. SQL Editor
3. coin_exchange_info.sql kopieren & ausführen
4. "Success" bestätigen
```

### Schritt 2: Backend neu starten
```bash
# Strg+C zum Stoppen
node server.js
# Backend startet neu
```

### Schritt 3: Frontend Sync testen
```
1. /coins Seite neu laden
2. "Exchange-Info synchronisieren" klicken
3. Sollte ✅ Erfolg zeigen
```

---

## 📞 Noch Probleme?

### Debug-Modus aktivieren:

```javascript
// server.js - Zeile 1525 (temporär für Debugging)
app.post('/api/exchange-info/sync', async (req, res) => {
  try {
    console.log('🔍 DEBUG: Sync started');
    console.log('🔍 DEBUG: Request Body:', req.body);
    
    // ... rest of code
    
  } catch (error) {
    console.error('🔍 DEBUG: Full Error Object:', error);
    // ... error handling
  }
});
```

### Supabase-Tabellen manuell prüfen:

```sql
-- Prüfe ob Tabellen existieren
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
  'binance_rate_limits',
  'coin_exchange_info',
  'coin_exchange_info_history',
  'coin_alerts'
);

-- Sollte 4 Zeilen zurückgeben
```

---

## ✅ Checkliste

- [ ] `axios` installiert im Backend
- [ ] SQL-Tabellen in Supabase angelegt
- [ ] Binance API erreichbar (Test-URL)
- [ ] Supabase Service Key gesetzt
- [ ] Backend läuft ohne Fehler
- [ ] Sync-Request erfolgreich

---

**Häufigste Ursache: SQL-Tabellen nicht angelegt!** 🎯

