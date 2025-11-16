# 🚀 QUICK START: Automatische Exchange-Info Synchronisierung

## ✅ Was wurde implementiert?

Das System synchronisiert jetzt **automatisch täglich** alle Exchange-Informationen und Lot Sizes von Binance!

---

## 📦 Installation

### 1. Dependencies installieren

```bash
npm install
```

Das installiert `node-cron@3.0.3` (wurde zu package.json hinzugefügt).

---

## 🎯 Features

### ✅ Automatischer Sync
- **Täglich um 3:00 Uhr UTC**
- Synchronisiert alle Coins aus `coin_strategies`
- Aktualisiert `coin_exchange_info` Tabelle
- Aktualisiert `lot_sizes` in `bot_settings`
- Vollständiges Logging

### ✅ Manueller Sync
- **Button "Exchange-Info synchronisieren"** auf `/coins` Seite
- **Funktioniert wie vorher**, aber jetzt mit Lot Size Update!

### ✅ Lot Size Auto-Update
- **Beim automatischen Sync** (täglich)
- **Beim manuellen Sync** (Button)
- Immer aktuell, keine manuellen Anpassungen mehr nötig!

---

## 🔧 Server starten

```bash
npm start
```

**Erwartete Ausgabe:**

```
═══════════════════════════════════════════════
🤖 Krypto-Trading-Bot Backend
═══════════════════════════════════════════════
🌐 Server läuft auf: http://0.0.0.0:10000
...
✅ Scheduled tasks configured:
   📅 Exchange-Info Sync @ 03:00 UTC daily
```

✅ Wenn du diese Zeile siehst, ist der Cron Job aktiv!

---

## 🧪 Testen

### 1. Manuellen Sync testen

**Option A: Über Frontend**
1. Gehe zu `http://localhost:3000/coins`
2. Klicke "Exchange-Info synchronisieren"
3. Warte auf Erfolgsmeldung

**Option B: Über API**
```bash
curl -X POST http://localhost:10000/api/exchange-info/sync
```

**Erwartete Response:**
```json
{
  "success": true,
  "message": "Synchronisiert: 5 von 5 Symbolen",
  "synced": 5,
  "lotSizesUpdated": 5,
  "timestamp": "2025-01-16T12:00:00Z"
}
```

### 2. Prüfen ob Lot Sizes aktualisiert wurden

**In Supabase:**
```sql
SELECT key, value, updated_at 
FROM bot_settings 
WHERE key LIKE 'lot_size_%'
ORDER BY updated_at DESC;
```

**Erwartetes Ergebnis:**
```
lot_size_BTCUSDT | {"minQty": 0.00001, ...} | 2025-01-16 12:00:00
lot_size_ETHUSDT | {"minQty": 0.0001, ...}  | 2025-01-16 12:00:00
...
```

---

## 🕐 Cron Job anpassen (optional)

### Standard: Täglich um 3:00 UTC

```javascript
// server.js Zeile ~6320
cron.schedule('0 3 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

### Alle 12 Stunden

```javascript
cron.schedule('0 */12 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

### Alle 6 Stunden

```javascript
cron.schedule('0 */6 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

---

## 📊 Monitoring

### Logs anschauen

**Bei automatischem Sync (täglich 3:00 UTC):**
```
═══════════════════════════════════════════════
🕐 [SCHEDULED] Starting automatic Exchange-Info Sync...
═══════════════════════════════════════════════
📊 [SCHEDULED] Synchronisiere 5 Symbole...
  ✅ BTCUSDT synced (Testnet: ✓)
  ✅ ETHUSDT synced (Testnet: ✓)
✅ [SCHEDULED] Sync completed: 5 success, 0 errors
═══════════════════════════════════════════════
```

### In Supabase prüfen

```sql
-- Letzte Sync-Events
SELECT * FROM bot_events 
WHERE message LIKE '%Exchange-Info Sync%'
ORDER BY created_at DESC
LIMIT 5;
```

---

## ⚠️ Troubleshooting

### "node-cron not found"

**Problem:** Package nicht installiert

**Lösung:**
```bash
npm install node-cron@3.0.3
```

### Cron Job läuft nicht

**Problem:** Keine `[SCHEDULED]` Logs

**Lösung:**
1. Server neu starten
2. Prüfen ob beim Start diese Zeile erscheint:
   ```
   ✅ Scheduled tasks configured:
      📅 Exchange-Info Sync @ 03:00 UTC daily
   ```

### Lot Sizes werden nicht aktualisiert

**Problem:** Sync läuft, aber `lot_sizes` bleiben alt

**Lösung:**
```bash
# Bot neu starten
curl -X POST http://localhost:10000/api/stop-bot
curl -X POST http://localhost:10000/api/start-bot
```

---

## 📚 Vollständige Dokumentation

Siehe: **`GUIDES & CONFIG/GUIDES/SCHEDULED_EXCHANGE_INFO_SYNC.md`**

Enthält:
- Detaillierte Ablaufdiagramme
- Code-Locations
- Erweiterte Konfiguration
- Fehlerbehandlung
- Monitoring-Strategien

---

## 🎯 Zusammenfassung

**Was du bekommst:**
- ✅ Automatische tägliche Synchronisierung (3:00 UTC)
- ✅ Lot Sizes immer aktuell
- ✅ Manueller Sync weiterhin verfügbar
- ✅ Vollständiges Logging
- ✅ Keine manuellen Eingriffe mehr nötig

**Was du tun musst:**
1. `npm install` ausführen
2. Server neu starten
3. Fertig! 🎉

**Nächste Schritte:**
- Ersten manuellen Sync über `/coins` Button durchführen
- Am nächsten Tag um 3:00 UTC automatischen Sync prüfen
- Optional: Cron-Schedule an deine Bedürfnisse anpassen

---

**Erstellt:** 16.01.2025  
**Version:** 1.0

