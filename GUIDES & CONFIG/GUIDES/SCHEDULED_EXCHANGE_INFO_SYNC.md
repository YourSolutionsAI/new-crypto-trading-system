# 🕐 AUTOMATISCHE EXCHANGE-INFO SYNCHRONISIERUNG

## 📋 Übersicht

Das System synchronisiert automatisch Exchange-Informationen und Lot Sizes von Binance:
- ✅ **Täglich um 3:00 Uhr UTC** (automatisch)
- ✅ **Manuell über Button** auf `/coins` Seite
- ✅ **Lot Sizes werden immer aktualisiert**

---

## 🔄 Was wird synchronisiert?

### 1. **Exchange-Informationen** (`coin_exchange_info`)
- Trading-Status (TRADING, BREAK, HALT)
- Filter (PRICE_FILTER, LOT_SIZE, NOTIONAL)
- Permissions & Features
- Testnet-Verfügbarkeit

### 2. **Lot Sizes** (`bot_settings`)
Für jeden synchronisierten Coin:
```json
{
  "minQty": 0.00001,
  "maxQty": 9000,
  "stepSize": 0.00001,
  "decimals": 5
}
```
Gespeichert als: `lot_size_BTCUSDT`, `lot_size_ETHUSDT`, etc.

### 3. **Rate Limits** (`binance_rate_limits`)
- REQUEST_WEIGHT
- ORDERS
- RAW_REQUESTS

---

## 📅 Automatischer Sync (Cron Job)

### Konfiguration

**Zeitpunkt:** Täglich um **3:00 Uhr UTC**

**Cron-Ausdruck:** `0 3 * * *`

**Was passiert:**
1. Lädt alle Coins aus `coin_strategies`
2. Ruft Binance API auf (exchangeInfo)
3. Aktualisiert `coin_exchange_info` Tabelle
4. Aktualisiert `lot_sizes` in `bot_settings`
5. Lädt Bot Settings neu
6. Loggt Ergebnis in Supabase (`bot_events`)

### Logs

```
═══════════════════════════════════════════════
🕐 [SCHEDULED] Starting automatic Exchange-Info Sync...
═══════════════════════════════════════════════
📊 [SCHEDULED] Synchronisiere 5 Symbole...
✅ [SCHEDULED] 3 Rate Limits gespeichert
  ✅ BTCUSDT synced (Testnet: ✓)
  ✅ ETHUSDT synced (Testnet: ✓)
  ✅ BNBUSDT synced (Testnet: ✓)
═══════════════════════════════════════════════
✅ [SCHEDULED] Sync completed: 5 success, 0 errors
═══════════════════════════════════════════════
```

---

## 🖱️ Manueller Sync (Frontend)

### Über `/coins` Seite

1. **Button "Exchange-Info synchronisieren" klicken**
2. **Sync läuft** (Spinner wird angezeigt)
3. **Erfolg-Meldung:**
   ```
   ✅ Synchronisiert: 5 von 5 Symbolen
   Lot Sizes aktualisiert: 5
   ```

### API-Endpoint

```javascript
POST /api/exchange-info/sync
Body: { symbols?: string[] }  // Optional

Response: {
  success: true,
  message: "Synchronisiert: 5 von 5 Symbolen",
  synced: 5,
  lotSizesUpdated: 5,
  timestamp: "2025-01-16T12:00:00Z"
}
```

---

## 🔧 Cron-Schedule ändern

### Aktuell: Täglich um 3:00 Uhr UTC

```javascript
// server.js Zeile ~6320
cron.schedule('0 3 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

### Andere Optionen:

#### Alle 12 Stunden (00:00 und 12:00 UTC)
```javascript
cron.schedule('0 */12 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

#### Alle 6 Stunden
```javascript
cron.schedule('0 */6 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

#### Jede Stunde
```javascript
cron.schedule('0 * * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

#### Mehrmals täglich (6:00, 12:00, 18:00, 00:00 UTC)
```javascript
cron.schedule('0 6,12,18,0 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

### Cron-Syntax Erklärung

```
┌───────────── Minute (0 - 59)
│ ┌───────────── Stunde (0 - 23)
│ │ ┌───────────── Tag des Monats (1 - 31)
│ │ │ ┌───────────── Monat (1 - 12)
│ │ │ │ ┌───────────── Tag der Woche (0 - 7) (Sonntag = 0 oder 7)
│ │ │ │ │
* * * * *
```

**Beispiele:**
- `0 3 * * *` = Täglich um 3:00 Uhr
- `0 */6 * * *` = Alle 6 Stunden (0:00, 6:00, 12:00, 18:00)
- `30 2 * * 1` = Jeden Montag um 2:30 Uhr
- `0 0 1 * *` = Am 1. jedes Monats um Mitternacht

---

## 📊 Ablauf-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRIGGER                                                  │
│    ├─ Cron Job (täglich 3:00 UTC)                          │
│    └─ Manueller Button (/coins Seite)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. COINS LADEN                                              │
│    SELECT symbol FROM coin_strategies                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BINANCE API AUFRUFEN                                     │
│    GET https://api.binance.com/api/v3/exchangeInfo          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RATE LIMITS SPEICHERN                                    │
│    UPSERT INTO binance_rate_limits                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. FÜR JEDEN COIN:                                          │
│    ├─ Filter extrahieren (PRICE, LOT_SIZE, NOTIONAL)       │
│    ├─ UPSERT coin_exchange_info                            │
│    └─ UPSERT lot_size_${SYMBOL} in bot_settings            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. BOT SETTINGS NEU LADEN                                   │
│    loadBotSettings(true)                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. LOGGING                                                  │
│    ├─ Console Logs                                          │
│    └─ Supabase bot_events Tabelle                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Vorteile

### Vorher (Manuell)
❌ Lot Sizes mussten manuell aktualisiert werden  
❌ Veraltete Binance-Filter führten zu Trade-Fehlern  
❌ Exchange-Info nur bei manuellem Sync  
❌ Keine regelmäßige Prüfung auf Änderungen

### Jetzt (Automatisch)
✅ **Täglich automatische Synchronisierung**  
✅ **Lot Sizes immer aktuell** (auch bei manuellem Sync)  
✅ **Bot Settings werden automatisch neu geladen**  
✅ **Vollständiges Logging** (Console + Supabase)  
✅ **Manueller Sync weiterhin möglich**  
✅ **Fehler-Handling** mit detaillierten Logs

---

## 🔍 Monitoring & Logs

### 1. **Console Logs**
Beim Server-Start:
```
✅ Scheduled tasks configured:
   📅 Exchange-Info Sync @ 03:00 UTC daily
```

Beim Sync:
```
═══════════════════════════════════════════════
🕐 [SCHEDULED] Starting automatic Exchange-Info Sync...
═══════════════════════════════════════════════
```

### 2. **Supabase Logs** (`bot_events`)

**Erfolgreicher Sync:**
```sql
SELECT * FROM bot_events 
WHERE message = 'Scheduled Exchange-Info Sync completed'
ORDER BY created_at DESC
LIMIT 1;
```

**Fehlgeschlagener Sync:**
```sql
SELECT * FROM bot_events 
WHERE message = 'Scheduled Exchange-Info Sync failed'
ORDER BY created_at DESC
LIMIT 1;
```

### 3. **Letzte Aktualisierung prüfen**

```sql
-- Exchange-Info
SELECT symbol, last_updated_at 
FROM coin_exchange_info 
ORDER BY last_updated_at DESC;

-- Lot Sizes
SELECT key, updated_at 
FROM bot_settings 
WHERE key LIKE 'lot_size_%'
ORDER BY updated_at DESC;
```

---

## ⚠️ Troubleshooting

### Problem: Cron Job läuft nicht

**Symptome:**
- Keine `[SCHEDULED]` Logs um 3:00 UTC
- Exchange-Info veraltet

**Lösung:**
1. Server-Neustart:
   ```bash
   # Server neu starten
   npm start
   ```

2. Prüfen ob node-cron installiert:
   ```bash
   npm list node-cron
   # Sollte: node-cron@3.0.3 zeigen
   ```

3. Logs prüfen:
   ```bash
   # Bei Server-Start sollte erscheinen:
   ✅ Scheduled tasks configured:
      📅 Exchange-Info Sync @ 03:00 UTC daily
   ```

---

### Problem: Sync schlägt fehl

**Symptome:**
```
❌ [SCHEDULED] Exchange-Info Sync failed: ...
```

**Häufige Ursachen:**

#### 1. Binance API nicht erreichbar
```
Error: connect ENOTFOUND api.binance.com
```
**Lösung:** Internetverbindung prüfen, Firewall prüfen

#### 2. Supabase-Tabellen fehlen
```
Error: relation "coin_exchange_info" does not exist
```
**Lösung:** SQL-Setup ausführen:
```sql
-- In Supabase SQL Editor:
-- Datei: Supabase SQL Setups/coin_exchange_info.sql
```

#### 3. Rate Limit überschritten
```
Error: 429 Too Many Requests
```
**Lösung:** 
- Warten und später erneut versuchen
- Sync-Frequenz reduzieren (z.B. alle 12 Stunden statt täglich)

---

### Problem: Bot Settings werden nicht aktualisiert

**Symptome:**
- Sync erfolgreich, aber alte Werte werden verwendet
- `calculateQuantity()` verwendet alte lot_sizes

**Lösung:**
1. Manueller Reload der Settings:
   ```javascript
   // In server.js Console oder via API:
   loadBotSettings(false);
   ```

2. Bot neu starten:
   ```
   POST /api/stop-bot
   POST /api/start-bot
   ```

---

## 🧪 Testen

### 1. Manueller Sync testen

```bash
# Via curl:
curl -X POST http://localhost:10000/api/exchange-info/sync

# Response sollte sein:
{
  "success": true,
  "message": "Synchronisiert: X von Y Symbolen",
  "synced": 5,
  "lotSizesUpdated": 5,
  "timestamp": "..."
}
```

### 2. Cron Job manuell triggern

```javascript
// In server.js oder via Node REPL:
scheduledExchangeInfoSync();
```

### 3. Test-Cron (jede Minute)

**⚠️ Nur zum Testen!**

```javascript
// Temporär in server.js ändern:
cron.schedule('* * * * *', () => {  // Jede Minute!
  console.log('🧪 [TEST] Running test sync...');
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

**Nach Test:** Zurück auf täglichen Sync ändern!

---

## 📝 Code-Locations

### Backend (server.js)

#### 1. Import
```javascript
// Zeile 9
const cron = require('node-cron');
```

#### 2. Lot Size Update im Sync-Endpoint
```javascript
// Zeile 1859-1915
// Automatische LOT SIZE AKTUALISIERUNG
```

#### 3. Scheduled Sync Funktion
```javascript
// Zeile 6056-6242
async function scheduledExchangeInfoSync() { ... }
```

#### 4. Cron Job Konfiguration
```javascript
// Zeile 6319-6330
cron.schedule('0 3 * * *', () => {
  scheduledExchangeInfoSync();
}, { timezone: "UTC" });
```

### Package Dependencies

```json
// package.json
{
  "dependencies": {
    "node-cron": "^3.0.3"
  }
}
```

---

## 📚 Verwandte Dokumentation

- **Automatische Coin-Initialisierung:** `AUTOMATIC_COIN_INITIALIZATION.md`
- **Exchange-Info DB:** `DB_IMPLEMENTATION_COMPLETE.md`
- **Coins Page:** `COINS_PAGE_IMPLEMENTATION.md`
- **Bot Settings:** `SUPABASE_CONFIGURATION.md`

---

## 🎯 Zusammenfassung

**Was wurde implementiert:**
1. ✅ **node-cron** Package hinzugefügt
2. ✅ **Lot Size Auto-Update** beim Exchange-Info Sync
3. ✅ **Scheduled Sync Funktion** mit vollständigem Logging
4. ✅ **Cron Job** täglich um 3:00 UTC
5. ✅ **Fehler-Handling** und Monitoring

**Wie es funktioniert:**
- 🕐 Täglich um 3:00 UTC synchronisiert der Bot automatisch
- 🖱️ Manueller Sync über Button bleibt verfügbar
- 📊 Lot Sizes werden IMMER aktualisiert (automatisch + manuell)
- 📝 Vollständiges Logging in Console und Supabase

**Nächste Schritte:**
1. `npm install` ausführen (installiert node-cron)
2. Server neu starten
3. Prüfen ob Cron Job konfiguriert wurde (Console Log)
4. Optional: Test-Sync manuell ausführen

---

**Erstellt:** 16.01.2025  
**Letzte Aktualisierung:** 16.01.2025  
**Version:** 1.0

