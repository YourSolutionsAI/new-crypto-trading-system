# 🤖 AUTOMATISCHE COIN INITIALISIERUNG

## 📋 Übersicht

Beim Hinzufügen eines neuen Coins auf der `/coins` Seite werden automatisch die erforderlichen `lot_sizes` und `websockets` in der `bot_settings` Tabelle initialisiert.

---

## 🔄 Was passiert automatisch?

### 1. **Neuen Coin über Frontend hinzufügen**
- Benutzer klickt "Neuen Coin hinzufügen"
- Wählt Symbol aus Dropdown (z.B. BTCUSDT)
- Klickt "Coin erstellen"

### 2. **Backend initialisiert automatisch**

#### A) **Lot Size Regeln**
Aus `coin_exchange_info` Tabelle:
```json
{
  "minQty": 0.00001,
  "maxQty": 9000,
  "stepSize": 0.00001,
  "decimals": 5
}
```

Gespeichert als: `lot_size_BTCUSDT` in `bot_settings`

#### B) **WebSocket URL**
Generiert aus Symbol:
```
wss://stream.binance.com:9443/ws/btcusdt@trade
```

Gespeichert als: `websocket_BTCUSDT` in `bot_settings`

### 3. **Bot Settings werden neu geladen**
- `loadBotSettings(true)` wird aufgerufen
- Neue Werte sind sofort verfügbar
- Trading kann starten

---

## 📊 Ablauf-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User fügt Coin hinzu (Frontend)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Backend: /api/coins/:symbol (PUT)                       │
│    ├─ Strategie validieren                                 │
│    ├─ Prüfen: lot_size & websocket vorhanden?             │
│    └─ Wenn NEIN → Initialisierung                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Exchange-Info aus coin_exchange_info holen              │
│    SELECT min_qty, max_qty, step_size                      │
│    WHERE symbol = 'BTCUSDT'                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Lot Size berechnen & speichern                          │
│    ├─ Decimals aus step_size ableiten                     │
│    ├─ JSON-Objekt erstellen                               │
│    └─ INSERT INTO bot_settings                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. WebSocket URL generieren & speichern                    │
│    ├─ URL: wss://.../{symbol.toLowerCase()}@trade         │
│    └─ INSERT INTO bot_settings                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Bot Settings neu laden                                  │
│    loadBotSettings(true)                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Coin-Strategie in coin_strategies speichern             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ Coin ist trading-ready!                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Für bereits existierende Coins

### SQL-Script ausführen

Wenn Coins bereits in `coin_strategies` existieren, aber `lot_sizes`/`websockets` fehlen:

```sql
-- In Supabase SQL Editor ausführen:
-- Datei: Supabase SQL Setups/initialize_coin_bot_settings.sql
```

**Was macht das Script?**
1. Liest alle Coins aus `coin_strategies`
2. Holt Lot Size Daten aus `coin_exchange_info`
3. Berechnet Dezimalstellen automatisch
4. Generiert WebSocket URLs
5. Fügt alles in `bot_settings` ein

---

## ⚠️ Voraussetzungen

### Exchange-Info muss synchronisiert sein

Bevor Coins hinzugefügt werden:

1. **Auf `/coins` Seite gehen**
2. **Button "Exchange-Info synchronisieren" klicken**
3. **Warten bis Sync abgeschlossen**
4. **Dann Coins hinzufügen**

**Warum?**
- `coin_exchange_info` muss Daten enthalten
- Lot Size Regeln kommen von Binance
- Ohne Exchange-Info → Keine automatische Initialisierung

---

## 🧪 Testen

### 1. Neuen Coin hinzufügen
```javascript
// Frontend: /coins
1. "Neuen Coin hinzufügen" klicken
2. Symbol auswählen (z.B. ETHUSDT)
3. "Coin erstellen" klicken
```

### 2. In Supabase prüfen
```sql
-- Prüfe lot_size
SELECT * FROM bot_settings 
WHERE key = 'lot_size_ETHUSDT';

-- Prüfe websocket
SELECT * FROM bot_settings 
WHERE key = 'websocket_ETHUSDT';
```

### 3. Server-Logs prüfen
```
🔄 Initialisiere bot_settings für ETHUSDT...
✅ Lot Size für ETHUSDT initialisiert: { minQty: 0.0001, ... }
✅ WebSocket für ETHUSDT initialisiert: wss://...
✅ Bot Settings aktualisiert für ETHUSDT
```

---

## 📝 Code-Location

### Backend
**Datei:** `server.js`  
**Endpoint:** `/api/coins/:symbol` (PUT)  
**Zeilen:** 1356-1433

```javascript
// Automatische Initialisierung: Lot Size & WebSocket
const symbolUpper = symbol.toUpperCase();
const lotSizeKey = `lot_size_${symbolUpper}`;
const websocketKey = `websocket_${symbolUpper}`;

// Prüfe ob bereits vorhanden...
// Wenn nicht → aus coin_exchange_info holen
// → In bot_settings speichern
// → Bot Settings neu laden
```

### SQL-Script für bestehende Coins
**Datei:** `Supabase SQL Setups/initialize_coin_bot_settings.sql`

---

## 🔍 Troubleshooting

### Problem: "Keine Exchange-Info gefunden"

**Symptom:**
```
⚠️  Keine Exchange-Info für BTCUSDT gefunden.
💡 Bitte Exchange-Info synchronisieren!
```

**Lösung:**
1. Frontend `/coins` öffnen
2. "Exchange-Info synchronisieren" klicken
3. Coin nochmal hinzufügen oder SQL-Script ausführen

---

### Problem: "Keine Lot Size Konfiguration gefunden"

**Symptom:**
```
❌ FEHLER: Keine Lot Size Konfiguration für BTCUSDT gefunden!
```

**Lösung:**
```sql
-- SQL-Script ausführen:
-- initialize_coin_bot_settings.sql
```

Oder manuell in `bot_settings` einfügen:
```sql
INSERT INTO bot_settings (key, value, description)
VALUES (
  'lot_size_BTCUSDT',
  '{"minQty": 0.00001, "maxQty": 9000, "stepSize": 0.00001, "decimals": 5}'::jsonb,
  'Lot Size Regeln für BTCUSDT'
);
```

---

### Problem: Bot lädt neue Werte nicht

**Symptom:**
- `lot_size` in DB vorhanden
- Aber Bot kann immer noch nicht traden

**Lösung:**
1. Bot neu starten (Stop + Start)
2. Oder API-Call: `POST /api/restart-bot`
3. `loadBotSettings()` wird automatisch aufgerufen

---

## 💡 Vorteile

### ✅ Früher (Manuell)
```sql
-- Für jeden Coin manuell:
INSERT INTO bot_settings (key, value, description)
VALUES 
  ('lot_size_BTCUSDT', '{"minQty": 0.00001, ...}'::jsonb, '...'),
  ('websocket_BTCUSDT', '"wss://..."'::jsonb, '...');
```

### ✅ Jetzt (Automatisch)
```javascript
// Einfach Coin im Frontend hinzufügen
// → lot_size & websocket werden automatisch erstellt
// → Trading sofort möglich
```

---

## 📚 Verwandte Dokumentation

- **Bot Settings:** `GUIDES & CONFIG/GUIDES/SUPABASE_CONFIGURATION.md`
- **Coin Management:** `GUIDES & CONFIG/GUIDES/SYMBOL_MANAGEMENT.md`
- **Multi-Coin Trading:** `GUIDES & CONFIG/GUIDES/MULTI_COIN_TRADING.md`
- **Exchange Info Sync:** `frontend/COINS_PAGE_IMPLEMENTATION.md`

---

## 🎯 Zusammenfassung

**Vor dieser Änderung:**
- ❌ Neue Coins wurden nur in `coin_strategies` gespeichert
- ❌ `lot_sizes` und `websockets` mussten manuell erstellt werden
- ❌ Trading war nicht möglich ohne manuelle Konfiguration

**Nach dieser Änderung:**
- ✅ Neue Coins werden vollständig initialisiert
- ✅ `lot_sizes` aus `coin_exchange_info` extrahiert
- ✅ `websockets` automatisch generiert
- ✅ Trading sofort möglich (wenn Strategie konfiguriert)

**Erstellt:** 16.01.2025  
**Letzte Aktualisierung:** 16.01.2025

