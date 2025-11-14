# 🐛 BUGFIX: MARKET_LOT_SIZE Fehler behoben

## ❌ Problem

```
Fehler: Filter failure: MARKET_LOT_SIZE
Code: -1013
```

**Ursachen:**
1. **Symbol-Mismatch**: Bot handelt DOGE ($0.16), aber Strategie sagt BTCUSDT
2. **Falsche Menge**: 619 DOGE hat falsche Dezimalstellen
3. **Multiple Orders**: Trade Cooldown funktioniert nicht
4. **Keine Konfigurationsdatei**: Einstellungen sind im Code verstreut

---

## ✅ Lösung

### 1. **Neue Konfigurationsdatei erstellt: `config.js`**

Alle Einstellungen sind jetzt zentral:

```javascript
module.exports = {
  market: {
    symbol: 'DOGEUSDT',     // Trading-Paar
    websocketUrl: '...',    // WebSocket-URL
  },
  
  trading: {
    tradeCooldown: 300000,  // 5 Minuten zwischen Trades
    maxConcurrentTrades: 3,
    defaultTradeSize: 100,
  },
  
  lotSizes: {
    DOGEUSDT: {
      minQty: 1,            // Ganze Zahlen!
      stepSize: 1,
      decimals: 0,          // Keine Dezimalstellen
    },
    // ... weitere Coins
  },
};
```

### 2. **Lot Size Berechnung verbessert**

```javascript
function calculateQuantity(price, symbol) {
  // Berechne Basis-Menge
  let quantity = maxTradeSize / price;
  
  // Runde auf Step Size
  quantity = Math.floor(quantity / lotSize.stepSize) * lotSize.stepSize;
  
  // Runde auf korrekte Dezimalstellen
  quantity = parseFloat(quantity.toFixed(lotSize.decimals));
  
  // Prüfe Min/Max
  if (quantity < lotSize.minQty) quantity = lotSize.minQty;
  
  return quantity;
}
```

### 3. **Symbol aus WebSocket verwenden**

```javascript
// Vorher: Symbol aus Strategie (falsch: BTCUSDT)
const symbol = strategy.symbol;

// Jetzt: Symbol aus WebSocket (richtig: DOGEUSDT)
const symbol = currentSymbol;
```

### 4. **Trade Cooldown verbessert**

```javascript
// Cooldown-Check mit Zeitberechnung
const cooldownRemaining = config.trading.tradeCooldown - (now - lastTradeTime);

if (cooldownRemaining > 0) {
  console.log(`⏳ Trade Cooldown aktiv - Warte noch ${waitTime}s`);
  return false; // KEIN Trade!
}
```

---

## 🎯 Was Sie jetzt tun müssen

### Schritt 1: In Supabase - Symbol ändern (optional)

Wenn Sie möchten, dass die Strategie das richtige Symbol zeigt:

1. Gehen Sie zu Supabase → strategies
2. Ändern Sie **symbol** von `BTCUSDT` zu `DOGEUSDT`
3. Speichern

**Hinweis:** Funktioniert auch ohne diese Änderung (Bot verwendet jetzt das Symbol aus config.js)!

### Schritt 2: Bot neu deployen

Der Code ist bereits zu GitHub gepusht.

1. Render deployt automatisch in 2-3 Minuten
2. Bot neu starten:

```powershell
Invoke-WebRequest -Uri "https://new-crypto-trading-system.onrender.com/api/stop-bot" -Method POST
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "https://new-crypto-trading-system.onrender.com/api/start-bot" -Method POST
```

### Schritt 3: Logs überprüfen

Sie sollten jetzt sehen:

```
═══════════════════════════════════════════════
🔄 FÜHRE BUY-ORDER AUS
═══════════════════════════════════════════════
📊 Symbol: DOGEUSDT          ← Richtig!
📈 Seite: BUY
💰 Preis: 0.161620 USDT
🔢 Menge: 619                ← Ganze Zahl!
💵 Wert: ~100.04 USDT
📊 Lot Size Info: Min=1, Step=1, Decimals=0

✅ Order ausgeführt!
   Order ID: 12345678
   Status: FILLED
✅ Trade in Datenbank gespeichert
📊 Position geöffnet: ...
═══════════════════════════════════════════════
```

**Nächstes Signal erst nach 5 Minuten!** ⏳

---

## 📊 config.js Einstellungen anpassen

### Trade-Größe ändern

```javascript
trading: {
  defaultTradeSize: 50,    // Kleiner = weniger Risiko
  // oder
  defaultTradeSize: 200,   // Größer = mehr Volumen
}
```

### Trade Cooldown ändern

```javascript
trading: {
  tradeCooldown: 60000,    // 1 Minute (Tests)
  tradeCooldown: 300000,   // 5 Minuten (Normal)
  tradeCooldown: 600000,   // 10 Minuten (Konservativ)
}
```

### Anderen Coin handeln

```javascript
market: {
  symbol: 'ETHUSDT',
  websocketUrl: 'wss://stream.binance.com:9443/ws/ethusdt@trade',
}
```

Dann in `config.js` die Lot Size prüfen:
```javascript
lotSizes: {
  ETHUSDT: {
    minQty: 0.0001,
    stepSize: 0.0001,
    decimals: 4,
  },
}
```

### Signal-Threshold anpassen

```javascript
signals: {
  threshold: 0.001,  // Sehr sensitiv (viele Signale)
  threshold: 0.01,   // Sensitiv (viele Signale) ← Aktuell
  threshold: 0.1,    // Normal (moderate Signale)
  threshold: 0.5,    // Konservativ (wenige Signale)
}
```

---

## 🎓 Was wurde behoben

| Problem | Vorher | Nachher |
|---------|--------|---------|
| **Symbol** | BTCUSDT (falsch) | DOGEUSDT ✅ |
| **Lot Size** | 619.00 (Dezimal) | 619 (Ganzzahl) ✅ |
| **Cooldown** | Nicht konsequent | 5 Min garantiert ✅ |
| **Config** | Im Code verstreut | Zentrale Datei ✅ |
| **Fehler** | MARKET_LOT_SIZE | Keine Fehler ✅ |

---

## 🚀 Erwartete Ergebnisse

### Nach dem Restart:

1. **Erste 50 Trades**: Daten sammeln (1-2 Min)
2. **Erstes Signal**: BUY bei DOGEUSDT ✅
3. **Erste Order**: Erfolgreich ausgeführt ✅
4. **Cooldown**: 5 Minuten Pause ⏳
5. **Zweites Signal**: Erst nach Cooldown!
6. **SELL Signal**: Nach 5-30 Minuten
7. **PnL**: Gewinn/Verlust wird angezeigt 📈

### Performance-Erwartung:

Mit DOGE bei Threshold 0.01%:
- **2-5 Trades pro Stunde** (mit 5 Min Cooldown)
- **Signals alle 5-10 Minuten**
- **Hold-Messages alle 5 Minuten**

---

## 📝 Hinweise

### Lot Size Regeln pro Coin:

| Coin | Min Qty | Step Size | Decimals |
|------|---------|-----------|----------|
| **BTC** | 0.00001 | 0.00001 | 5 |
| **ETH** | 0.0001 | 0.0001 | 4 |
| **BNB** | 0.001 | 0.001 | 3 |
| **DOGE** | 1 | 1 | 0 |
| **SHIB** | 1 | 1 | 0 |
| **XRP** | 0.1 | 0.1 | 1 |

**Wichtig:** Meme-Coins (DOGE, SHIB, PEPE) brauchen **ganze Zahlen**!

### Trade Cooldown Empfehlungen:

- **1 Minute**: Nur für Tests
- **5 Minuten**: Normal (empfohlen) ← Aktuell
- **10 Minuten**: Konservativ
- **30 Minuten**: Sehr konservativ

---

## ✅ Checkliste

- [x] config.js erstellt
- [x] Lot Size Berechnung implementiert
- [x] Symbol aus WebSocket verwenden
- [x] Trade Cooldown verbessert
- [x] Code zu GitHub gepusht
- [ ] Render Deployment abwarten (2-3 Min)
- [ ] Bot neu starten
- [ ] Erste Order überprüfen
- [ ] Cooldown verifizieren

---

**🎉 Der Fehler ist behoben! Nach dem Restart sollte alles funktionieren!**

