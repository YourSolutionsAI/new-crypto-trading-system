# 🎛️ **SUPABASE-BASIERTE KONFIGURATION**

## 🎯 **Das neue System:**

**ALLES wird über Supabase gesteuert!** 

Keine Code-Änderungen mehr nötig - einfach Einstellungen in der Datenbank ändern und Bot neu starten.

---

## ✅ **Setup: SQL-Script ausführen**

### **Schritt 1: SQL Editor öffnen**
1. Gehen Sie zu [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Wählen Sie Ihr Projekt
3. **SQL Editor** → **New Query**

### **Schritt 2: Konfiguration laden**
Kopieren Sie den Inhalt aus:
```
Supabase SQL Setups/bot_configuration.sql
```

Fügen Sie ihn ein und klicken Sie auf **Run**

### **Schritt 3: Fertig!** ✅

Jetzt sind alle Einstellungen in Supabase:
- ✅ Lot Size Regeln (8 Coins)
- ✅ WebSocket URLs
- ✅ Trading-Einstellungen
- ✅ Signal-Thresholds
- ✅ Logging-Optionen

---

## 📊 **Was wird wo gespeichert?**

### **1. strategies Tabelle**
```
- symbol: 'DOGEUSDT'        ← Trading-Paar
- active: true              ← Bot verwendet nur aktive
- config: {                 ← Strategie-Parameter
    indicators: {
      ma_short: 20,
      ma_long: 50
    },
    risk: {
      max_trade_size_usdt: 100
    }
  }
```

### **2. bot_settings Tabelle**
```
Key                          | Value           | Beschreibung
──────────────────────────────────────────────────────────────
lot_size_DOGEUSDT           | {...}           | Min/Max/Step für DOGE
trade_cooldown_ms           | 300000          | 5 Min zwischen Trades
signal_threshold_percent    | 0.01            | 0.01% für Signale
max_concurrent_trades       | 3               | Max. offene Positionen
logging_show_hold_signals   | true            | Hold-Signale anzeigen
```

---

## 🎛️ **Einstellungen ändern (UI)**

### **Trading-Größe anpassen:**
1. **Table Editor** → **strategies**
2. Klicken Sie auf die Strategie
3. Bearbeiten Sie **config**:
```json
{
  "risk": {
    "max_trade_size_usdt": 50  ← Von 100 auf 50 ändern
  }
}
```
4. **Save**
5. Bot neu starten

### **Trade Cooldown ändern:**
1. **Table Editor** → **bot_settings**
2. Finden Sie `trade_cooldown_ms`
3. Ändern Sie **value**:
```json
600000  ← 10 Minuten (war 300000 = 5 Min)
```
4. **Save**
5. Bot neu starten

### **Symbol wechseln:**
1. **Table Editor** → **strategies**
2. Ändern Sie **symbol** von `DOGEUSDT` zu `ETHUSDT`
3. **Save**
4. Bot neu starten
5. ✅ Bot handelt jetzt ETH!

---

## 🖥️ **Einstellungen ändern (SQL)**

### **Trade Cooldown: 5 → 10 Minuten**
```sql
UPDATE bot_settings
SET value = '600000'::jsonb
WHERE key = 'trade_cooldown_ms';
```

### **Signal Threshold: 0.01% → 0.05%**
```sql
UPDATE bot_settings
SET value = '0.05'::jsonb
WHERE key = 'signal_threshold_percent';
```

### **Trade-Größe: $100 → $50**
```sql
UPDATE strategies
SET config = jsonb_set(
  config,
  '{risk,max_trade_size_usdt}',
  '50'::jsonb
)
WHERE name = 'MA Cross Strategy';
```

### **Symbol wechseln: DOGE → ETH**
```sql
UPDATE strategies
SET symbol = 'ETHUSDT'
WHERE name = 'MA Cross Strategy';
```

---

## 🔄 **Workflow: Einstellungen ändern**

### **Typischer Ablauf:**

1. **Einstellung in Supabase ändern**
   - UI: Table Editor
   - Oder SQL: SQL Editor

2. **Bot neu starten**
   ```powershell
   Invoke-WebRequest -Uri "https://neue-url/api/stop-bot" -Method POST
   Start-Sleep -Seconds 5
   Invoke-WebRequest -Uri "https://neue-url/api/start-bot" -Method POST
   ```

3. **Logs überprüfen**
   - Render → Logs
   - Prüfen Sie: "✅ X Bot-Einstellungen geladen"

4. **Fertig!** ✅

---

## 📋 **Alle verfügbaren Einstellungen**

### **bot_settings Keys:**

| Key | Standard | Beschreibung |
|-----|----------|--------------|
| `trade_cooldown_ms` | 300000 | Pause zwischen Trades (ms) |
| `signal_cooldown_ms` | 60000 | Pause zwischen Signalen (ms) |
| `max_concurrent_trades` | 3 | Max. offene Positionen |
| `default_trade_size_usdt` | 100 | Standard Trade-Größe ($) |
| `signal_threshold_percent` | 0.01 | Min. MA-Differenz (%) |
| `logging_verbose` | false | Ausführliche Logs |
| `logging_show_hold_signals` | true | Hold-Signale anzeigen |
| `logging_price_log_interval` | 10 | Preis alle X Updates |
| `logging_hold_log_interval` | 50 | Hold alle X Updates |

### **Lot Sizes:**

Für jeden Coin: `lot_size_SYMBOLNAME`

Beispiel `lot_size_DOGEUSDT`:
```json
{
  "minQty": 1,
  "maxQty": 9000000,
  "stepSize": 1,
  "decimals": 0
}
```

### **WebSocket URLs:**

Für jeden Coin: `websocket_SYMBOLNAME`

Beispiel `websocket_DOGEUSDT`:
```json
"wss://stream.binance.com:9443/ws/dogeusdt@trade"
```

---

## 🎨 **Frontend-Integration (später)**

Mit diesem System können Sie später ein **Frontend** bauen:

```javascript
// React Component
function TradingSettings() {
  const [settings, setSettings] = useState({});

  // Einstellungen laden
  const loadSettings = async () => {
    const { data } = await supabase
      .from('bot_settings')
      .select('*');
    setSettings(data);
  };

  // Einstellung ändern
  const updateSetting = async (key, value) => {
    await supabase
      .from('bot_settings')
      .update({ value })
      .eq('key', key);
    
    // Bot neu starten via API
    await fetch('/api/restart-bot', { method: 'POST' });
  };

  return (
    <div>
      <input
        value={settings.trade_cooldown_ms}
        onChange={(e) => updateSetting('trade_cooldown_ms', e.target.value)}
      />
    </div>
  );
}
```

---

## 💡 **Vorteile dieses Systems:**

### **Für Sie jetzt:**
- ✅ Einfache Änderungen ohne Code-Deployment
- ✅ Alle Einstellungen an einem Ort
- ✅ Historie über `updated_at`
- ✅ Rollback möglich

### **Für Frontend später:**
- ✅ Alle Einstellungen über UI änderbar
- ✅ Keine Backend-Anpassungen nötig
- ✅ Real-time Updates mit Supabase Realtime
- ✅ Multi-User fähig

---

## 🔍 **Views für einfachen Zugriff**

### **Lot Sizes anzeigen:**
```sql
SELECT * FROM v_lot_sizes;
```

Ergebnis:
```
symbol    | min_qty | max_qty | step_size | decimals
──────────┼─────────┼─────────┼───────────┼──────────
DOGEUSDT  | 1       | 9000000 | 1         | 0
BTCUSDT   | 0.00001 | 9000    | 0.00001   | 5
ETHUSDT   | 0.0001  | 9000    | 0.0001    | 4
```

### **Trading-Settings anzeigen:**
```sql
SELECT * FROM v_trading_settings;
```

### **WebSocket URLs anzeigen:**
```sql
SELECT * FROM v_websockets;
```

---

## 🎯 **Quick Reference**

### **Häufige Änderungen:**

```sql
-- Trade-Größe ändern
UPDATE strategies SET config = jsonb_set(config, '{risk,max_trade_size_usdt}', '50');

-- Cooldown ändern
UPDATE bot_settings SET value = '600000' WHERE key = 'trade_cooldown_ms';

-- Symbol wechseln
UPDATE strategies SET symbol = 'ETHUSDT' WHERE name = 'MA Cross Strategy';

-- Threshold ändern
UPDATE bot_settings SET value = '0.05' WHERE key = 'signal_threshold_percent';

-- Logging anpassen
UPDATE bot_settings SET value = 'false' WHERE key = 'logging_show_hold_signals';
```

---

## ⚠️ **Wichtig:**

### **Nach JEDER Änderung:**
1. Bot neu starten
2. Logs überprüfen
3. Ersten Trade abwarten
4. Verifizieren dass Änderung wirkt

### **Fallback:**
Falls ein Wert nicht in Supabase ist:
- Bot verwendet `config.js` als Fallback
- Oder hartcodierte Defaults im Code

---

## 📞 **Support:**

**Problem:** Einstellung wird nicht übernommen
**Lösung:** 
1. Prüfen Sie, ob der Key korrekt ist
2. Bot neu starten
3. Logs prüfen: "✅ X Bot-Einstellungen geladen"

**Problem:** Bot startet nicht
**Lösung:**
1. Prüfen Sie, ob eine Strategie aktiv ist
2. Prüfen Sie Supabase Logs für Fehler

---

**🎉 Jetzt haben Sie volle Kontrolle über Ihren Bot - alles über Supabase!**

