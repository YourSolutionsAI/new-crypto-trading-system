# 🪙 Multi-Coin Trading Setup

## 🎯 Ziel: Mehrere Coins handeln können

Dieses Guide zeigt Ihnen:
1. ✅ **Phase 1:** Zwischen einzelnen Coins wechseln (JETZT verfügbar)
2. 🔄 **Phase 2:** Mehrere Coins gleichzeitig handeln (später)

---

## 📋 **PHASE 1: Setup - Strategien hinzufügen**

### **Schritt 1: SQL-Script ausführen**

1. Öffnen Sie [Supabase Dashboard](https://supabase.com/dashboard)
2. **SQL Editor** → **New Query**
3. Öffnen Sie die Datei: `Supabase SQL Setups/add_multi_coin_strategies.sql`
4. Kopieren Sie **ALLES** und fügen Sie es ein
5. Klicken Sie auf **Run**

**Ergebnis:**
```
✅ 8 Strategien erstellt:
- MA Cross - DOGE (aktiv)
- MA Cross - BTC
- MA Cross - ETH
- MA Cross - BNB
- MA Cross - SOL
- MA Cross - XRP
- MA Cross - ADA
- MA Cross - SHIB
```

### **Schritt 2: Überprüfen**

**Table Editor → strategies**

Sie sollten jetzt 8 Strategien sehen:

| Name | Symbol | Active | MA Short/Long |
|------|--------|--------|---------------|
| MA Cross - DOGE | DOGEUSDT | ✅ true | 20/50 |
| MA Cross - BTC | BTCUSDT | ❌ false | 20/50 |
| MA Cross - ETH | ETHUSDT | ❌ false | 20/50 |
| MA Cross - BNB | BNBUSDT | ❌ false | 20/50 |
| MA Cross - SOL | SOLUSDT | ❌ false | 15/40 |
| MA Cross - XRP | XRPUSDT | ❌ false | 20/50 |
| MA Cross - ADA | ADAUSDT | ❌ false | 20/50 |
| MA Cross - SHIB | SHIBUSDT | ❌ false | 10/30 |

---

## 🔄 **Zwischen Coins wechseln (Phase 1 - JETZT)**

### **Methode 1: UI (einfach)**

**Von DOGE zu ETH wechseln:**

1. **Table Editor** → **strategies**
2. Klicken Sie auf **MA Cross - DOGE**
3. Setzen Sie **active** auf `false`
4. **Save**
5. Klicken Sie auf **MA Cross - ETH**
6. Setzen Sie **active** auf `true`
7. **Save**
8. **Bot neu starten:**
   ```powershell
   Invoke-WebRequest -Uri "https://ihre-url/api/stop-bot" -Method POST
   Start-Sleep -Seconds 5
   Invoke-WebRequest -Uri "https://ihre-url/api/start-bot" -Method POST
   ```

**Ergebnis:**
```
📊 Aktives Symbol: ETHUSDT
🔌 Stelle Verbindung zu Binance her: wss://.../ethusdt@trade
✅ Bot handelt jetzt Ethereum!
```

### **Methode 2: SQL (schnell)**

**Von DOGE zu BTC wechseln:**

```sql
-- DOGE deaktivieren
UPDATE strategies SET active = false WHERE name = 'MA Cross - DOGE';

-- BTC aktivieren
UPDATE strategies SET active = true WHERE name = 'MA Cross - BTC';
```

Bot neu starten → ✅ Handelt jetzt Bitcoin!

### **Methode 3: SQL (direkt mehrere)**

**Alle deaktivieren, nur ETH aktivieren:**

```sql
-- Alle deaktivieren
UPDATE strategies SET active = false;

-- Nur ETH aktivieren
UPDATE strategies SET active = true WHERE name = 'MA Cross - ETH';
```

---

## 📊 **Trading-Performance pro Coin**

### **View erstellen für Übersicht:**

```sql
-- Performance pro Coin
CREATE OR REPLACE VIEW v_coin_performance AS
SELECT 
  s.name as strategy_name,
  s.symbol,
  s.active,
  COUNT(t.id) as total_trades,
  SUM(CASE WHEN t.side = 'buy' THEN 1 ELSE 0 END) as buy_trades,
  SUM(CASE WHEN t.side = 'sell' THEN 1 ELSE 0 END) as sell_trades,
  SUM(t.pnl) as total_pnl,
  AVG(t.pnl) as avg_pnl,
  MAX(t.pnl) as best_trade,
  MIN(t.pnl) as worst_trade,
  SUM(t.total) as total_volume
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id
GROUP BY s.id, s.name, s.symbol, s.active
ORDER BY total_pnl DESC NULLS LAST;

-- Anzeigen
SELECT * FROM v_coin_performance;
```

---

## 🎯 **Welcher Coin für welchen Zweck?**

### **Zum Testen (viele Signale):**

| Coin | Volatilität | Signale/Std | Empfehlung |
|------|-------------|-------------|------------|
| **DOGE** | Sehr hoch 🔥 | 10-30 | ⭐⭐⭐⭐⭐ Perfekt für Tests |
| **SHIB** | Extrem 🔥🔥 | 20-50 | ⭐⭐⭐⭐ Sehr schnell |
| **SOL** | Hoch 🔥 | 8-20 | ⭐⭐⭐⭐ Gut für Tests |

### **Für echtes Trading (später):**

| Coin | Volatilität | Signale/Std | Empfehlung |
|------|-------------|-------------|------------|
| **BTC** | Niedrig | 1-5 | ⭐⭐⭐⭐⭐ Stabil, große Werte |
| **ETH** | Mittel | 5-15 | ⭐⭐⭐⭐⭐ Gutes Gleichgewicht |
| **BNB** | Mittel | 3-10 | ⭐⭐⭐⭐ Stabil |

### **Riskant:**

| Coin | Volatilität | Signale/Std | Empfehlung |
|------|-------------|-------------|------------|
| **XRP** | Hoch | 4-12 | ⚠️ Regulierungs-Risiko |
| **ADA** | Mittel | 3-10 | ⚠️ Langsame Entwicklung |

---

## 🔄 **PHASE 2: Mehrere Coins gleichzeitig (Vorbereitung)**

### **Was muss im Code angepasst werden:**

**Aktuell:**
```javascript
// Eine WebSocket-Verbindung
const ws = new WebSocket(url);
currentSymbol = activeStrategies[0].symbol;
```

**Phase 2:**
```javascript
// Mehrere WebSocket-Verbindungen
activeStrategies.forEach(strategy => {
  const ws = new WebSocket(getWebSocketUrl(strategy.symbol));
  connections.set(strategy.symbol, ws);
  
  ws.on('message', (data) => {
    // Handel für dieses Symbol
    analyzeAndTrade(data, strategy);
  });
});
```

### **Vorteile Phase 2:**

✅ **Diversifikation:** Nicht alle Eier in einen Korb
✅ **Mehr Trades:** Mehrere Märkte gleichzeitig
✅ **Risiko-Verteilung:** Verluste in einem Markt, Gewinne in anderem
✅ **24/7 Opportunities:** Immer ein aktiver Markt

### **Herausforderungen:**

⚠️ **Komplexität:** Code wird komplexer
⚠️ **Ressourcen:** Mehr WebSocket-Verbindungen
⚠️ **Position Tracking:** Mehrere offene Positionen gleichzeitig
⚠️ **Risk Management:** Gesamt-Exposure im Auge behalten

---

## 🧪 **Test-Strategie:**

### **Woche 1: Einzelne Coins testen**
```
Tag 1-2: DOGE (viele Signale)
Tag 3-4: ETH (moderate Signale)
Tag 5-6: BTC (wenige Signale)
Tag 7: Auswerten, besten Coin wählen
```

### **Woche 2-3: Optimierung**
```
- MA-Perioden anpassen
- Trade-Größen optimieren
- Beste Coins identifizieren
```

### **Woche 4: Multi-Coin (Phase 2)**
```
- Code für Multi-Symbol erweitern
- 2-3 beste Coins gleichzeitig
- Live-Tests
```

---

## 📝 **Schnellreferenz: Coin wechseln**

### **Zu DOGE wechseln:**
```sql
UPDATE strategies SET active = false;
UPDATE strategies SET active = true WHERE symbol = 'DOGEUSDT';
```

### **Zu ETH wechseln:**
```sql
UPDATE strategies SET active = false;
UPDATE strategies SET active = true WHERE symbol = 'ETHUSDT';
```

### **Zu BTC wechseln:**
```sql
UPDATE strategies SET active = false;
UPDATE strategies SET active = true WHERE symbol = 'BTCUSDT';
```

### **Zu SOL wechseln:**
```sql
UPDATE strategies SET active = false;
UPDATE strategies SET active = true WHERE symbol = 'SOLUSDT';
```

**Dann immer:** Bot neu starten!

---

## 🎛️ **Strategie pro Coin anpassen:**

### **SOL aggressiver machen:**
```sql
UPDATE strategies
SET config = jsonb_set(
  jsonb_set(config, '{indicators,ma_short}', '10'),
  '{indicators,ma_long}', '25'
)
WHERE name = 'MA Cross - SOL';
```

### **BTC konservativer:**
```sql
UPDATE strategies
SET config = jsonb_set(
  jsonb_set(config, '{indicators,ma_short}', '50'),
  '{indicators,ma_long}', '200'
)
WHERE name = 'MA Cross - BTC';
```

### **DOGE Trade-Größe verkleinern:**
```sql
UPDATE strategies
SET config = jsonb_set(config, '{risk,max_trade_size_usdt}', '50')
WHERE name = 'MA Cross - DOGE';
```

---

## 📊 **Monitoring mehrerer Coins:**

### **Welcher Coin läuft aktuell:**
```sql
SELECT name, symbol FROM strategies WHERE active = true;
```

### **Performance Vergleich:**
```sql
SELECT 
  s.symbol,
  COUNT(t.id) as trades,
  SUM(t.pnl) as profit,
  AVG(t.pnl) as avg_profit
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id
GROUP BY s.symbol
ORDER BY profit DESC;
```

### **Bester Coin heute:**
```sql
SELECT 
  s.symbol,
  SUM(t.pnl) as today_profit
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id
WHERE DATE(t.created_at) = CURRENT_DATE
GROUP BY s.symbol
ORDER BY today_profit DESC
LIMIT 1;
```

---

## ✅ **Checkliste:**

### **Phase 1 (Jetzt):**
- [x] SQL-Script ausführen
- [x] 8 Strategien in Supabase
- [ ] Zwischen Coins wechseln testen
- [ ] Jeden Coin 1-2 Tage testen
- [ ] Performance vergleichen

### **Phase 2 (Später):**
- [ ] Code für Multi-WebSocket erweitern
- [ ] Position Tracking verbessern
- [ ] Gesamt-Risk Management
- [ ] 2-3 Coins gleichzeitig handeln

---

## 🎯 **Zusammenfassung:**

**Jetzt nach SQL-Script:**
- ✅ 8 Coins verfügbar
- ✅ Einfach zwischen Coins wechseln
- ✅ Jeder Coin eigene Einstellungen
- ✅ Alle Lot Sizes bereits konfiguriert

**Workflow:**
1. Coin auswählen (active = true)
2. Bot neu starten
3. Trades beobachten
4. Performance tracken
5. Zum nächsten Coin wechseln
6. Vergleichen & optimieren

---

**Führen Sie jetzt das SQL-Script aus und Sie können sofort zwischen allen Coins wechseln!** 🚀

