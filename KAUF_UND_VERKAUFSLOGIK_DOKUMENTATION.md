# Kauf- und Verkaufslogik - Detaillierte Dokumentation

Diese Dokumentation beschreibt die komplette Kauf- und Verkaufslogik des Crypto Trading Systems bis ins kleinste Detail.

---

## Inhaltsverzeichnis

1. [Übersicht des Systems](#übersicht-des-systems)
2. [Supabase-Datenbankstruktur](#supabase-datenbankstruktur)
3. [Signal-Generierung](#signal-generierung)
4. [Kauf-Logik (BUY)](#kauf-logik-buy)
5. [Verkauf-Logik (SELL)](#verkauf-logik-sell)
6. [Stop Loss & Take Profit](#stop-loss--take-profit)
7. [Trailing Stop Loss](#trailing-stop-loss)
8. [Cooldown-Mechanismen](#cooldown-mechanismen)
9. [Risk Management](#risk-management)
10. [Frontend-Integration](#frontend-integration)
11. [Fehlerbehandlung & Idempotenz](#fehlerbehandlung--idempotenz)

---

## Übersicht des Systems

Das System besteht aus drei Hauptkomponenten:

1. **Backend (server.js)**: Führt alle Trading-Operationen aus, verwaltet Positionen, generiert Signale
2. **Frontend (Next.js)**: Zeigt Daten an, ermöglicht Konfiguration, zeigt Positionen und Trades
3. **Supabase**: Speichert alle Daten (Strategien, Trades, Positionen, Logs)

### Datenfluss

```
WebSocket (Binance) → server.js → Signal-Generierung → Trade-Ausführung → Supabase → Frontend
```

---

## Supabase-Datenbankstruktur

### 1. Tabelle: `positions`

Speichert alle offenen Positionen mit allen relevanten Informationen.

#### Wichtige Felder:

| Feld | Typ | Beschreibung | Bedeutung für Trading |
|------|-----|--------------|------------------------|
| `id` | UUID | Eindeutige Position-ID | Identifikation der Position |
| `strategy_id` | UUID | Verknüpfung zur Strategie | Welche Strategie hat diese Position eröffnet |
| `symbol` | TEXT | Trading-Paar (z.B. "BTCUSDT") | Für welches Asset wird gehandelt |
| `quantity` | DECIMAL(20,8) | Anzahl der Coins | Wie viele Coins werden gehalten |
| `entry_price` | DECIMAL(20,8) | Durchschnittlicher Einstiegspreis | Zu welchem Preis wurde gekauft (gewichteter Durchschnitt bei mehreren Käufen) |
| `total_buy_quantity` | DECIMAL(20,8) | Gesamte gekaufte Menge | Summe aller Käufe (für Average-Down/Up Berechnung) |
| `total_buy_value` | DECIMAL(20,8) | Gesamter Kaufwert | Summe aller Kaufwerte (für gewichteten Durchschnitt) |
| `status` | TEXT | Status: 'open', 'closed', 'partial' | Aktueller Status der Position |
| `highest_price` | DECIMAL(20,8) | Höchstpreis seit Eröffnung | Wichtig für Trailing Stop Loss |
| `trailing_stop_price` | DECIMAL(20,8) | Aktueller Trailing Stop Preis | Dynamischer Stop Loss Preis |
| `use_trailing_stop` | BOOLEAN | Ob Trailing Stop aktiv ist | Steuert ob statischer oder Trailing Stop verwendet wird |
| `trailing_stop_activation_threshold` | DECIMAL(5,2) | Mindest-Gewinn für Aktivierung | Trailing Stop wird erst nach X% Gewinn aktiv |
| `opened_at` | TIMESTAMPTZ | Eröffnungszeitpunkt | Wann wurde die Position eröffnet |
| `updated_at` | TIMESTAMPTZ | Letztes Update | Wann wurde die Position zuletzt aktualisiert |
| `closed_at` | TIMESTAMPTZ | Schließungszeitpunkt | Wann wurde die Position geschlossen |

#### Bedeutung für die Logik:

- **`entry_price`**: Wird bei jedem Kauf neu berechnet als gewichteter Durchschnitt aller Käufe
- **`highest_price`**: Wird kontinuierlich aktualisiert wenn der aktuelle Preis höher ist
- **`trailing_stop_price`**: Wird basierend auf `highest_price` und `stop_loss_percent` berechnet
- **`status`**: 
  - `'open'`: Position ist aktiv, kann verkauft werden
  - `'partial'`: Position wurde teilweise verkauft (nicht vollständig implementiert)
  - `'closed'`: Position wurde vollständig geschlossen

### 2. Tabelle: `trades`

Speichert alle ausgeführten Trades (Käufe und Verkäufe).

#### Wichtige Felder:

| Feld | Typ | Beschreibung | Bedeutung |
|------|-----|--------------|-----------|
| `id` | UUID | Eindeutige Trade-ID | Identifikation |
| `strategy_id` | UUID | Verknüpfung zur Strategie | Welche Strategie hat diesen Trade ausgelöst |
| `symbol` | TEXT | Trading-Paar | Asset |
| `side` | TEXT | 'buy' oder 'sell' | Trade-Richtung |
| `price` | DECIMAL(20,8) | Ausführungspreis | Zu welchem Preis wurde gehandelt |
| `quantity` | DECIMAL(20,8) | Gehandelte Menge | Wie viele Coins |
| `total` | DECIMAL(20,8) | Gesamtwert (price * quantity) | Wert des Trades in USDT |
| `pnl` | DECIMAL(20,8) | Profit/Loss | Gewinn/Verlust beim Verkauf |
| `status` | TEXT | 'pending', 'executed', 'failed' | Status des Trades |
| `order_id` | TEXT | Binance Order ID | Referenz zur Binance Order |
| `executed_at` | TIMESTAMPTZ | Ausführungszeitpunkt | Wann wurde der Trade ausgeführt |
| `created_at` | TIMESTAMPTZ | Erstellungszeitpunkt | Wann wurde der Trade erstellt |

### 3. Tabelle: `coin_strategies`

Speichert Coin-spezifische Konfigurationen.

#### Wichtige Felder:

| Feld | Typ | Beschreibung | Bedeutung |
|------|-----|--------------|-----------|
| `symbol` | TEXT | Trading-Paar | Asset |
| `strategy_id` | UUID | Zugewiesene Strategie | Welche Strategie wird für diesen Coin verwendet |
| `active` | BOOLEAN | Ob Coin aktiv ist | Nur aktive Coins werden gehandelt |
| `config` | JSONB | Coin-spezifische Konfiguration | Enthält Settings und Risk Management |

#### `config` Struktur:

```json
{
  "settings": {
    "signal_threshold_percent": 0.001,  // Minimale MA-Differenz für Signal
    "signal_cooldown_ms": 60000,        // Pause zwischen Signalen
    "trade_cooldown_ms": 300000         // Pause zwischen Trades (5 Minuten)
  },
  "risk": {
    "max_trade_size_usdt": 10.0,         // Maximale Trade-Größe in USDT
    "stop_loss_percent": 2.0,            // Stop Loss in %
    "take_profit_percent": 5.0,          // Take Profit in %
    "use_trailing_stop": false,           // Trailing Stop aktivieren?
    "trailing_stop_activation_threshold": 0.0  // Mindest-Gewinn für Aktivierung
  }
}
```

### 4. Tabelle: `strategies`

Speichert Basis-Strategien (ohne Coin-Zuordnung).

#### Wichtige Felder:

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Eindeutige Strategie-ID |
| `name` | TEXT | Name der Strategie |
| `config` | JSONB | Strategie-Konfiguration (Indikatoren, etc.) |
| `active` | BOOLEAN | Ob Strategie aktiv ist |

---

## Signal-Generierung

### Ablauf

1. **WebSocket empfängt Preis-Update** von Binance
2. **Preis wird in `priceHistory` gespeichert** (pro Symbol)
3. **Für jede aktive Strategie wird `generateSignal()` aufgerufen**
4. **Signal wird generiert basierend auf Indikatoren**

### Funktion: `generateSignal()`

**Location**: `server.js` Zeile 2535-2776

#### Eingabeparameter:

- `currentPrice`: Aktueller Preis des Assets
- `strategy`: Strategie-Objekt mit Konfiguration
- `priceHistory`: Array von historischen Preisen (für Indikatoren)

#### Indikatoren-Berechnung:

1. **Moving Averages (MA)**:
   - `maShort`: Kurzer Moving Average (Standard: 20 Perioden)
   - `maLong`: Langer Moving Average (Standard: 50 Perioden)
   - Berechnung: Einfacher Durchschnitt der letzten N Preise

2. **RSI (Relative Strength Index)**:
   - Optional, wenn konfiguriert
   - Standard: 14 Perioden

3. **MACD (Moving Average Convergence Divergence)**:
   - Optional, wenn konfiguriert

4. **Bollinger Bands**:
   - Optional, wenn konfiguriert

#### Signal-Logik:

```javascript
difference = maShort - maLong
differencePercent = (difference / maLong) * 100
threshold = signal_threshold_percent (aus Coin-Config)
```

**Kauf-Signal (BUY)**:
- Wenn `differencePercent > threshold`
- Bedingung: Kurzer MA über langem MA (Bullish Crossover)
- Zusätzliche Bestätigung durch RSI, MACD, Bollinger Bands (optional)

**Verkauf-Signal (SELL)**:
- Wenn `differencePercent < -threshold`
- Bedingung: Kurzer MA unter langem MA (Bearish Crossover)
- Oder: Stop Loss / Take Profit ausgelöst

**Hold-Signal**:
- Wenn `-threshold <= differencePercent <= threshold`
- Kein klares Signal, warte auf weitere Entwicklungen

#### Signal-Objekt:

```javascript
{
  action: 'buy' | 'sell' | 'hold' | 'wait',
  price: currentPrice,
  reason: "Beschreibung des Signals",
  maShort: "Wert",
  maLong: "Wert",
  difference: "Wert",
  differencePercent: "Wert",
  confidence: "0-100%",
  indicators: { rsi, macd, bollinger }
}
```

---

## Kauf-Logik (BUY)

### Ablauf eines Kaufs

#### 1. Signal-Generierung

- WebSocket empfängt Preis-Update
- `generateSignal()` wird aufgerufen
- Signal mit `action: 'buy'` wird generiert

#### 2. Signal-Logging

**Location**: `server.js` Zeile 3127-3165

- Signal wird in `bot_logs` Tabelle gespeichert
- Log-Eintrag enthält: action, price, reason, Indikatoren-Werte

#### 3. Trade-Prüfung: `canTrade()`

**Location**: `server.js` Zeile 3259-3494

##### Prüfungen (in dieser Reihenfolge):

1. **Trading Master-Switch**:
   ```javascript
   if (!tradingEnabled) return { allowed: false, reason: 'Trading deaktiviert' }
   ```

2. **Binance Client verfügbar?**:
   ```javascript
   if (!binanceClient) return { allowed: false, reason: 'Binance Client nicht verfügbar' }
   ```

3. **USDT-Guthaben prüfen**:
   ```javascript
   if (signal.action === 'buy') {
     const usdtBalance = getUSDTBalance();
     const requiredUSDT = max_trade_size_usdt;
     if (usdtBalance < requiredUSDT) {
       return { allowed: false, reason: 'Nicht genügend USDT' }
     }
   }
   ```

4. **Max Total Exposure prüfen**:
   ```javascript
   const totalExposure = calculateTotalExposure();
   const maxExposure = botSettings.max_total_exposure_usdt;
   if (totalExposure + max_trade_size_usdt > maxExposure) {
     return { allowed: false, reason: 'Max Exposure überschritten' }
   }
   ```

5. **Max Concurrent Trades prüfen**:
   ```javascript
   const openPositionsCount = openPositions.size;
   const maxConcurrent = botSettings.max_concurrent_trades;
   if (openPositionsCount >= maxConcurrent) {
     return { allowed: false, reason: 'Max Concurrent Trades erreicht' }
   }
   ```

6. **Bereits offene Position prüfen**:
   ```javascript
   const positionKey = `${strategy.id}_${symbol}`;
   const memPosition = openPositions.get(positionKey);
   if (memPosition && memPosition.quantity > 0.0001) {
     return { allowed: false, reason: 'Bereits offene Position vorhanden' }
   }
   ```
   
   **WICHTIG**: Prüfung erfolgt sowohl in Memory-Map als auch in Datenbank (Fallback)

#### 4. Trade-Ausführung: `executeTrade()`

**Location**: `server.js` Zeile 3499-3969

##### 4.1 Trade-Queue (Race Condition Prevention)

```javascript
// Promise-basierte Queue pro Symbol
const previousTrade = tradeQueues.get(symbol);
if (previousTrade) {
  await previousTrade; // Warte auf vorherigen Trade
}
```

**Zweck**: Verhindert, dass mehrere Trades gleichzeitig für dasselbe Symbol ausgeführt werden.

##### 4.2 Cooldown-Prüfung

```javascript
const now = Date.now();
const tradeCooldown = strategy.config.settings?.trade_cooldown_ms;
const lastTradeTime = lastTradeTimes.get(symbol) || 0;
const cooldownRemaining = tradeCooldown - (now - lastTradeTime);

if (cooldownRemaining > 0) {
  return null; // Trade wird abgelehnt
}
```

**Zweck**: Verhindert zu häufige Trades für denselben Coin.

##### 4.3 Menge berechnen: `calculateQuantity()`

**Location**: `server.js` Zeile 3198-3239

```javascript
// Basis-Berechnung
quantity = max_trade_size_usdt / price;

// Lot Size Rundung (Binance-Anforderungen)
quantity = Math.floor(quantity / lotSize.stepSize) * lotSize.stepSize;
quantity = parseFloat(quantity.toFixed(lotSize.decimals));

// Min/Max Prüfung
if (quantity < lotSize.minQty) quantity = lotSize.minQty;
if (quantity > lotSize.maxQty) quantity = lotSize.maxQty;
```

**Wichtige Werte**:
- `max_trade_size_usdt`: Aus Coin-Config (`coin_strategies.config.risk.max_trade_size_usdt`)
- `lotSize`: Aus `bot_settings` (z.B. `lot_size_BTCUSDT`)

##### 4.4 Idempotenz-Check (vor Order-Platzierung)

**Location**: `server.js` Zeile 3635-3660

```javascript
// Prüfe ob identischer Trade in letzten 5 Sekunden existiert
const recentTradeCheck = await supabase
  .from('trades')
  .select('id, order_id, created_at')
  .eq('strategy_id', strategy.id)
  .eq('symbol', symbol)
  .eq('side', 'buy')
  .gte('created_at', new Date(Date.now() - 5000).toISOString())
  .maybeSingle();

if (recentTradeCheck.data) {
  return null; // Trade bereits ausgeführt
}
```

**Zweck**: Verhindert doppelte Trades bei WebSocket-Duplikaten.

##### 4.5 Binance Order platzieren

```javascript
const order = await binanceClient.order({
  symbol: symbol,
  side: 'BUY',
  type: 'MARKET',
  quantity: quantity.toString()
});
```

**Order-Typ**: `MARKET` (sofortige Ausführung zum aktuellen Marktpreis)

##### 4.6 Idempotenz-Check (nach Order-Platzierung)

**Location**: `server.js` Zeile 3672-3692

```javascript
// Prüfe ob Order-ID bereits in DB existiert
const existingOrderCheck = await supabase
  .from('trades')
  .select('id')
  .eq('order_id', order.orderId.toString())
  .maybeSingle();

if (existingOrderCheck.data) {
  return order; // Order bereits verarbeitet, überspringe DB-Speicherung
}
```

**Zweck**: Verhindert doppelte DB-Einträge bei wiederholter Verarbeitung.

##### 4.7 Durchschnittspreis berechnen

```javascript
const avgPrice = order.fills && order.fills.length > 0
  ? order.fills.reduce((sum, fill) => sum + parseFloat(fill.price), 0) / order.fills.length
  : parseFloat(signal.price);

const executedQty = parseFloat(order.executedQty);
```

**Wichtig**: Market Orders können zu mehreren Fills führen, daher Durchschnittspreis.

##### 4.8 Position öffnen/erweitern: `openOrUpdatePosition()`

**Location**: `server.js` Zeile 83-241

**Fall 1: Neue Position**:
```javascript
INSERT INTO positions (
  strategy_id, symbol, quantity, entry_price,
  total_buy_quantity, total_buy_value, status,
  highest_price, trailing_stop_price, use_trailing_stop
) VALUES (...)
```

**Fall 2: Position erweitern (Average Up/Down)**:
```javascript
newTotalValue = existingPosition.total_buy_value + (quantity * price);
newTotalQuantity = existingPosition.quantity + quantity;
newEntryPrice = newTotalValue / newTotalQuantity;

// Trailing Stop: highest_price = MAX(altes_highest_price, neuer_entry_price)
newHighestPrice = Math.max(oldHighestPrice, newEntryPrice);
newTrailingStopPrice = newHighestPrice * (1 - stopLossPercent / 100);

UPDATE positions SET
  quantity = newTotalQuantity,
  entry_price = newEntryPrice,
  total_buy_value = newTotalValue,
  highest_price = newHighestPrice,
  trailing_stop_price = newTrailingStopPrice
WHERE id = positionId
```

**Wichtig**: 
- `entry_price` wird als gewichteter Durchschnitt aller Käufe berechnet
- `highest_price` wird nur erhöht, nie verringert
- `trailing_stop_price` wird nur aktualisiert wenn Trailing Stop aktiv ist

##### 4.9 In-Memory Map aktualisieren

```javascript
const positionKey = `${strategy.id}_${symbol}`;
openPositions.set(positionKey, {
  symbol: symbol,
  entryPrice: avgPrice,
  quantity: executedQty,
  orderId: order.orderId,
  timestamp: new Date(),
  strategyId: strategy.id,
  highestPrice: newHighestPrice,
  trailingStopPrice: newTrailingStopPrice,
  useTrailingStop: useTrailingStop
});
```

**Zweck**: Schneller Zugriff ohne Datenbank-Abfrage.

##### 4.10 Trade in Datenbank speichern

```javascript
INSERT INTO trades (
  strategy_id, symbol, side, price, quantity, total,
  order_id, status, executed_at, pnl
) VALUES (
  strategy.id, symbol, 'buy', avgPrice, executedQty, total,
  order.orderId, 'executed', NOW(), NULL
)
```

**Wichtig**: 
- `pnl` ist bei Käufen immer `NULL` (wird erst beim Verkauf berechnet)
- `status` ist `'executed'` wenn Order erfolgreich war

##### 4.11 Cooldown setzen

```javascript
lastTradeTimes.set(symbol, Date.now());
```

**Zweck**: Verhindert weitere Trades für diesen Coin während Cooldown-Periode.

##### 4.12 Trade-Queue auflösen

```javascript
resolveTrade(); // Promise auflösen
tradeQueues.delete(symbol); // Queue freigeben
```

---

## Verkauf-Logik (SELL)

### Verkaufs-Signale

Es gibt **drei Arten** von Verkaufs-Signalen:

1. **MA Crossover Bearish**: Kurzer MA kreuzt unter langem MA
2. **Stop Loss**: Preis fällt unter Stop Loss Preis
3. **Take Profit**: Preis steigt über Take Profit Preis

### Ablauf eines Verkaufs

#### 1. Signal-Generierung

**MA Crossover**:
- `generateSignal()` erkennt `differencePercent < -threshold`
- Signal mit `action: 'sell'` wird generiert

**Stop Loss / Take Profit**:
- `checkStopLossTakeProfit()` wird kontinuierlich aufgerufen
- Wenn Bedingung erfüllt, wird SELL-Signal erstellt

#### 2. Trade-Prüfung: `canTrade()`

**Location**: `server.js` Zeile 3468-3491

##### Prüfungen:

1. **Offene Position vorhanden?**:
   ```javascript
   if (signal.action === 'sell') {
     const position = await supabase
       .from('positions')
       .select('*')
       .eq('strategy_id', strategy.id)
       .eq('symbol', symbol)
       .in('status', ['open', 'partial'])
       .gt('quantity', 0)
       .maybeSingle();
     
     if (!position || parseFloat(position.quantity) <= 0) {
       return { allowed: false, reason: 'Keine offene Position' }
     }
   }
   ```

**Wichtig**: Verkauf ist nur möglich wenn offene Position existiert!

#### 3. Trade-Ausführung: `executeTrade()`

##### 3.1 Menge bestimmen

**Location**: `server.js` Zeile 3578-3625

```javascript
if (side === 'SELL') {
  // IMMER die gesamte Position verkaufen
  const positionKey = `${strategy.id}_${symbol}`;
  const position = openPositions.get(positionKey);
  
  if (!position || position.quantity <= 0) {
    // Fallback: Prüfe in Datenbank
    const dbPosition = await supabase
      .from('positions')
      .select('quantity')
      .eq('strategy_id', strategy.id)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .gt('quantity', 0)
      .maybeSingle();
    
    quantity = parseFloat(dbPosition.quantity);
  } else {
    quantity = position.quantity;
  }
  
  // Lot Size Rundung
  quantity = Math.floor(quantity / lotSize.stepSize) * lotSize.stepSize;
  quantity = parseFloat(quantity.toFixed(lotSize.decimals));
}
```

**Wichtig**: 
- **IMMER** die gesamte Position wird verkauft (kein Teilverkauf)
- Menge wird aus Position entnommen (Memory oder DB)

##### 3.2 Binance Order platzieren

```javascript
const order = await binanceClient.order({
  symbol: symbol,
  side: 'SELL',
  type: 'MARKET',
  quantity: quantity.toString()
});
```

##### 3.3 Position schließen: `reduceOrClosePosition()`

**Location**: `server.js` Zeile 3800-3900

```javascript
// Position aus Datenbank holen
const position = await supabase
  .from('positions')
  .select('*')
  .eq('strategy_id', strategy.id)
  .eq('symbol', symbol)
  .in('status', ['open', 'partial'])
  .gt('quantity', 0)
  .maybeSingle();

// Position schließen
UPDATE positions SET
  quantity = 0,
  status = 'closed',
  closed_at = NOW()
WHERE id = position.id;
```

**Wichtig**: Position wird vollständig geschlossen (quantity = 0).

##### 3.4 PnL berechnen

```javascript
const entryPrice = position.entry_price;
const sellPrice = avgPrice;
const pnl = (sellPrice - entryPrice) * executedQty;
const pnlPercent = ((sellPrice - entryPrice) / entryPrice) * 100;
```

**Berechnung**:
- `pnl = (Verkaufspreis - Einstiegspreis) * Menge`
- `pnlPercent = ((Verkaufspreis - Einstiegspreis) / Einstiegspreis) * 100`

##### 3.5 Trade speichern

```javascript
INSERT INTO trades (
  strategy_id, symbol, side, price, quantity, total,
  order_id, status, executed_at, pnl
) VALUES (
  strategy.id, symbol, 'sell', avgPrice, executedQty, total,
  order.orderId, 'executed', NOW(), pnl
)
```

**Wichtig**: `pnl` wird jetzt gespeichert (Gewinn/Verlust).

##### 3.6 In-Memory Map aktualisieren

```javascript
openPositions.delete(positionKey); // Position entfernen
```

**Zweck**: Position ist geschlossen, aus Memory entfernen.

---

## Stop Loss & Take Profit

### Funktion: `checkStopLossTakeProfit()`

**Location**: `server.js` Zeile 2818-3122

**Wird aufgerufen**: Bei jedem Preis-Update für alle offenen Positionen

### Statischer Stop Loss

#### Logik:

```javascript
const stopLossPercent = strategy.config.risk?.stop_loss_percent ?? 0;
const entryPrice = position.entry_price;
const currentPrice = // aktueller Preis
const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;

if (!useTrailingStop && stopLossPercent > 0 && priceChangePercent <= -stopLossPercent) {
  // Stop Loss ausgelöst!
  // Erstelle SELL-Signal
  const stopLossSignal = {
    action: 'sell',
    price: currentPrice,
    reason: `Stop-Loss ausgelöst: ${priceChangePercent.toFixed(2)}% <= -${stopLossPercent}%`,
    stopLoss: true,
    takeProfit: false,
    trailingStop: false
  };
  
  await executeTrade(stopLossSignal, strategy);
}
```

#### Beispiel:

- Einstiegspreis: 100 USDT
- Stop Loss: 2%
- Stop Loss Preis: 98 USDT
- Wenn aktueller Preis <= 98 USDT → Verkauf

### Take Profit

#### Logik:

```javascript
const takeProfitPercent = strategy.config.risk?.take_profit_percent ?? 0;
const entryPrice = position.entry_price;
const currentPrice = // aktueller Preis
const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;

if (takeProfitPercent > 0 && priceChangePercent >= takeProfitPercent) {
  // Take Profit ausgelöst!
  // Erstelle SELL-Signal
  const takeProfitSignal = {
    action: 'sell',
    price: currentPrice,
    reason: `Take-Profit ausgelöst: ${priceChangePercent.toFixed(2)}% >= +${takeProfitPercent}%`,
    stopLoss: false,
    takeProfit: true,
    trailingStop: false
  };
  
  await executeTrade(takeProfitSignal, strategy);
}
```

#### Beispiel:

- Einstiegspreis: 100 USDT
- Take Profit: 5%
- Take Profit Preis: 105 USDT
- Wenn aktueller Preis >= 105 USDT → Verkauf

---

## Trailing Stop Loss

### Konzept

Trailing Stop Loss ist ein dynamischer Stop Loss, der dem Preis nach oben folgt, aber nicht nach unten.

### Funktionsweise

#### 1. Initialisierung

**Beim Kauf**:
```javascript
const initialHighestPrice = avgPrice;
const initialTrailingStopPrice = useTrailingStop && stopLossPercent > 0 && activationThreshold === 0
  ? initialHighestPrice * (1 - stopLossPercent / 100)
  : null;
```

**Wichtig**: 
- Wenn `activationThreshold === 0`: Trailing Stop ist sofort aktiv
- Wenn `activationThreshold > 0`: Trailing Stop wird erst nach X% Gewinn aktiviert

#### 2. Kontinuierliche Überwachung

**Location**: `server.js` Zeile 2901-3020

**WICHTIG**: Trailing Stop ist bereits beim Kauf aktiviert (wenn `use_trailing_stop === true` in den Einstellungen). Bei jedem Preis-Update wird nur geprüft:

1. **Initialisierung** (nur beim ersten Mal): Wenn `trailing_stop_price` noch `null` ist und Aktivierungsschwelle erreicht ist
2. **Update**: Wenn `currentPrice > highestPrice` → Update `highestPrice` und `trailing_stop_price`
3. **Auslösung**: Wenn `currentPrice <= trailing_stop_price` → Verkauf auslösen

```javascript
// Bei jedem Preis-Update
if (useTrailingStop && stopLossPercent > 0) {
  let highestPrice = position.highest_price ?? position.entry_price;
  let trailingStopPrice = position.trailing_stop_price;
  const activationThreshold = position.trailing_stop_activation_threshold ?? 0;
  
  // SCHRITT 1: Prüfe ob trailing_stop_price initialisiert werden muss
  // Dies passiert nur beim ersten Mal, wenn Aktivierungsschwelle erreicht ist
  if (trailingStopPrice === null || trailingStopPrice === undefined) {
    const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Prüfe ob Aktivierungsschwelle erreicht ist
    if (activationThreshold === 0 || priceChangePercent >= activationThreshold) {
      // Aktivierungsschwelle erreicht → Initialisiere trailing_stop_price
      highestPrice = Math.max(highestPrice, currentPrice);
      trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
      
      // Update in Datenbank
      UPDATE positions SET
        highest_price = highestPrice,
        trailing_stop_price = trailingStopPrice
      WHERE id = position.id;
    } else {
      // Aktivierungsschwelle noch nicht erreicht → Warte weiter
      return; // Kein Update, kein Verkauf
    }
  } else {
    // SCHRITT 2: Trailing Stop ist bereits aktiviert → Update wenn nötig
    if (currentPrice > highestPrice) {
      highestPrice = currentPrice;
      trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
      
      // Update in Datenbank
      UPDATE positions SET
        highest_price = highestPrice,
        trailing_stop_price = trailingStopPrice
      WHERE id = position.id;
    }
  }
  
  // SCHRITT 3: Prüfe ob Trailing Stop ausgelöst wurde (Verkauf)
  // WICHTIG: Nur prüfen wenn trailing_stop_price bereits gesetzt ist
  if (trailingStopPrice !== null && trailingStopPrice !== undefined && !isNaN(trailingStopPrice)) {
    if (currentPrice <= trailingStopPrice) {
      // Verkauf auslösen!
      const trailingStopSignal = {
        action: 'sell',
        price: currentPrice,
        reason: `Trailing Stop-Loss ausgelöst: ${currentPrice} <= ${trailingStopPrice}`,
        stopLoss: true,
        takeProfit: false,
        trailingStop: true
      };
      
      await executeTrade(trailingStopSignal, strategy);
    }
  }
}
```

**Wichtig**: 
- Trailing Stop wird **nicht** bei jedem Preis-Update aktiviert/deaktiviert
- Trailing Stop ist **bereits aktiviert** wenn `use_trailing_stop === true` beim Kauf
- Die Aktivierungsschwelle wird nur beim **ersten Mal** geprüft, um `trailing_stop_price` zu initialisieren
- Nach der Initialisierung bleibt Trailing Stop **immer aktiv** und wird nur noch aktualisiert/ausgelöst

#### 3. Beispiel-Ablauf

**Szenario**: 
- Einstiegspreis: 100 USDT
- Stop Loss: 2%
- Trailing Stop aktiviert
- Aktivierungsschwelle: 0% (sofort aktiv)

**Preis-Entwicklung**:

1. **Kauf bei 100 USDT**:
   - `highest_price = 100`
   - `trailing_stop_price = 98` (100 * 0.98)

2. **Preis steigt auf 105 USDT**:
   - `highest_price = 105` (aktualisiert)
   - `trailing_stop_price = 102.9` (105 * 0.98) ← **Nach oben angepasst!**

3. **Preis fällt auf 102 USDT**:
   - `highest_price = 105` (bleibt unverändert)
   - `trailing_stop_price = 102.9` (bleibt unverändert)
   - Kein Verkauf (102 > 102.9)

4. **Preis fällt auf 102.5 USDT**:
   - `highest_price = 105` (bleibt unverändert)
   - `trailing_stop_price = 102.9` (bleibt unverändert)
   - Kein Verkauf (102.5 > 102.9)

5. **Preis fällt auf 102.8 USDT**:
   - `highest_price = 105` (bleibt unverändert)
   - `trailing_stop_price = 102.9` (bleibt unverändert)
   - **Verkauf!** (102.8 <= 102.9)

**Ergebnis**: Gewinn von 2.8 USDT (2.8%) statt Verlust von 2%!

#### 4. Aktivierungsschwelle

Wenn `trailing_stop_activation_threshold > 0`:

```javascript
const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
const shouldActivateTrailing = priceChangePercent >= activationThreshold;

if (shouldActivateTrailing) {
  // Trailing Stop wird erst jetzt aktiviert
  if (!trailingStopPrice) {
    trailingStopPrice = currentPrice * (1 - stopLossPercent / 100);
  }
}
```

**Beispiel**:
- Aktivierungsschwelle: 3%
- Einstiegspreis: 100 USDT
- Trailing Stop wird erst aktiviert wenn Preis >= 103 USDT
- Dann: `trailing_stop_price = 103 * 0.98 = 100.94 USDT`

**Vorteil**: Verhindert frühe Auslösung bei kleinen Schwankungen.

---

## Cooldown-Mechanismen

### 1. Signal Cooldown

**Zweck**: Verhindert zu häufige Signale für denselben Coin

**Konfiguration**: `coin_strategies.config.settings.signal_cooldown_ms`

**Logik**: 
- Nach jedem Signal wird Cooldown gesetzt
- Während Cooldown werden neue Signale ignoriert

**Location**: Nicht explizit implementiert, könnte in `generateSignal()` ergänzt werden

### 2. Trade Cooldown

**Zweck**: Verhindert zu häufige Trades für denselben Coin

**Konfiguration**: `coin_strategies.config.settings.trade_cooldown_ms`

**Logik**:

**Location**: `server.js` Zeile 3521-3543

```javascript
const now = Date.now();
const tradeCooldown = strategy.config.settings?.trade_cooldown_ms;
const lastTradeTime = lastTradeTimes.get(symbol) || 0;
const cooldownRemaining = tradeCooldown - (now - lastTradeTime);

if (cooldownRemaining > 0) {
  const waitTime = Math.round(cooldownRemaining / 1000);
  console.log(`⏳ TRADE COOLDOWN AKTIV für ${symbol} - Warte noch ${waitTime}s`);
  return null; // Trade wird abgelehnt
}
```

**Nach Trade-Ausführung**:
```javascript
lastTradeTimes.set(symbol, Date.now());
```

**Beispiel**:
- Trade Cooldown: 300000 ms (5 Minuten)
- Trade bei 10:00 Uhr → nächster Trade frühestens 10:05 Uhr

**Wichtig**: 
- Cooldown ist **pro Coin** (nicht global)
- Jeder Coin hat eigenen Cooldown-Timer

---

## Risk Management

### 1. Max Trade Size

**Konfiguration**: `coin_strategies.config.risk.max_trade_size_usdt`

**Zweck**: Begrenzt die Größe eines einzelnen Trades

**Logik**: 
- Menge wird berechnet als: `quantity = max_trade_size_usdt / price`
- Wird dann auf Lot Size gerundet

### 2. Max Total Exposure

**Konfiguration**: `bot_settings.max_total_exposure_usdt`

**Zweck**: Begrenzt das Gesamt-Exposure über alle Positionen

**Logik**:

**Location**: `server.js` Zeile 3245-3251

```javascript
function calculateTotalExposure() {
  let total = 0;
  openPositions.forEach((position) => {
    total += position.entryPrice * position.quantity;
  });
  return total;
}
```

**Prüfung**:
```javascript
const totalExposure = calculateTotalExposure();
const maxExposure = botSettings.max_total_exposure_usdt;

if (totalExposure + max_trade_size_usdt > maxExposure) {
  return { allowed: false, reason: 'Max Exposure überschritten' };
}
```

**Beispiel**:
- Max Exposure: 100 USDT
- Aktuelles Exposure: 80 USDT
- Neuer Trade: 25 USDT → **Abgelehnt** (80 + 25 = 105 > 100)

### 3. Max Concurrent Trades

**Konfiguration**: `bot_settings.max_concurrent_trades`

**Zweck**: Begrenzt die Anzahl gleichzeitiger Positionen

**Prüfung**:
```javascript
const openPositionsCount = openPositions.size;
const maxConcurrent = botSettings.max_concurrent_trades;

if (openPositionsCount >= maxConcurrent) {
  return { allowed: false, reason: 'Max Concurrent Trades erreicht' };
}
```

**Beispiel**:
- Max Concurrent Trades: 5
- Aktuelle Positionen: 5
- Neuer Trade → **Abgelehnt**

### 4. USDT-Guthaben-Prüfung

**Prüfung**:
```javascript
if (signal.action === 'buy') {
  const accountInfo = await binanceClient.accountInfo();
  const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');
  const freeUSDT = parseFloat(usdtBalance.free);
  
  if (freeUSDT < max_trade_size_usdt) {
    return { allowed: false, reason: 'Nicht genügend USDT' };
  }
}
```

**Wichtig**: Prüfung erfolgt sowohl im Testnet als auch im Live-Netzwerk

---

## Frontend-Integration

### 1. API-Endpunkte

#### GET `/api/positions`

**Location**: `server.js` Zeile 1536-1749

**Zweck**: Lädt alle offenen Positionen für Frontend

**Response**:
```json
{
  "positions": [
    {
      "id": "uuid",
      "symbol": "BTCUSDT",
      "quantity": 0.001,
      "entryPrice": 50000,
      "currentPrice": 51000,
      "pnl": 10,
      "pnlPercent": 2.0,
      "strategyId": "uuid",
      "strategyName": "MA Crossover",
      "stopLossPrice": 49000,
      "trailingStopPrice": 49940,
      "useTrailingStop": true,
      "maShort": 51000,
      "maLong": 50500,
      "maCrossSellPrice": 50500,
      "tradeCooldownMs": 300000,
      "cooldownRemainingMs": 120000,
      "cooldownRemainingSeconds": 120,
      "cooldownRemainingMinutes": 2,
      "lastTradeTime": "2025-01-14T10:00:00Z"
    }
  ]
}
```

**Frontend-Verwendung**: `frontend/lib/api.ts` Zeile 140-175

```typescript
export const getPositions = async (): Promise<Position[]> => {
  const response = await api.get('/api/positions');
  return response.data.positions || [];
};
```

#### GET `/api/trades`

**Location**: `server.js` Zeile 1400-1535

**Zweck**: Lädt Trade-Historie

**Frontend-Verwendung**: `frontend/lib/api.ts` Zeile 78-110

#### GET `/api/coins`

**Location**: `server.js` Zeile 1950-2100

**Zweck**: Lädt Coin-Konfigurationen

**Frontend-Verwendung**: `frontend/lib/api.ts` Zeile 205-213

### 2. Frontend-Komponenten

#### `frontend/app/trades/page.tsx`

**Funktionen**:
- Zeigt Trade-Historie
- Zeigt offene Positionen
- Zeigt Cooldown-Status
- Zeigt Verkaufsbedingungen (MA Cross, Stop Loss, Trailing Stop)

**Wichtige Features**:

1. **Cooldown-Anzeige**:
   ```typescript
   const positionsWithCooldown = useMemo(() => {
     return positions.map(position => {
       const lastTradeTime = new Date(position.lastTradeTime).getTime();
       const elapsed = currentTime - lastTradeTime;
       const remainingMs = Math.max(0, position.tradeCooldownMs - elapsed);
       const remainingSeconds = Math.floor(remainingMs / 1000);
       
       return {
         ...position,
         cooldownRemainingSeconds: remainingSeconds
       };
     });
   }, [positions, currentTime]);
   ```

2. **Verkaufsbedingungen anzeigen**:
   - MA Cross Strategie: Zeigt wann Verkauf ausgelöst wird
   - Stop Loss: Zeigt Stop Loss Preis
   - Trailing Stop: Zeigt aktuellen Trailing Stop Preis

#### `frontend/app/coins/page.tsx`

**Funktionen**:
- Zeigt alle verfügbaren Coins
- Ermöglicht Konfiguration pro Coin
- Aktiviert/Deaktiviert Coins

**Wichtige Einstellungen**:
- `strategy_id`: Zugewiesene Strategie
- `active`: Ob Coin aktiv ist
- `signal_threshold_percent`: Minimale MA-Differenz für Signal
- `trade_cooldown_ms`: Pause zwischen Trades
- `max_trade_size_usdt`: Maximale Trade-Größe
- `stop_loss_percent`: Stop Loss in %
- `take_profit_percent`: Take Profit in %
- `use_trailing_stop`: Trailing Stop aktivieren
- `trailing_stop_activation_threshold`: Mindest-Gewinn für Aktivierung

**API-Aufruf**: `frontend/lib/api.ts` Zeile 215-228

```typescript
export const updateCoinStrategy = async (
  symbol: string,
  updates: {
    strategy_id?: string | null;
    active?: boolean;
    config?: {
      settings?: Partial<CoinStrategy['config']['settings']>;
      risk?: Partial<CoinStrategy['config']['risk']>;
    };
  }
): Promise<CoinStrategy> => {
  const response = await api.put(`/api/coins/${symbol}`, updates);
  return response.data.coin;
};
```

#### `frontend/app/settings/page.tsx`

**Funktionen**:
- Globale Bot-Einstellungen
- Indikator-Defaults
- Trading-Einstellungen

**Wichtige Einstellungen**:
- `max_total_exposure_usdt`: Maximales Gesamt-Exposure
- `max_concurrent_trades`: Maximale Anzahl gleichzeitiger Trades
- `default_trade_size_usdt`: Standard Trade-Größe
- `signal_threshold_percent`: Standard Signal-Schwelle
- `default_indicators_ma_short`: Standard MA Short Period
- `default_indicators_ma_long`: Standard MA Long Period

**API-Aufruf**: `frontend/lib/api.ts` Zeile 253-257

### 3. Echtzeit-Updates

**Frontend aktualisiert sich automatisch**:

```typescript
useEffect(() => {
  loadData();
  const interval = setInterval(loadData, 5000); // Alle 5 Sekunden
  return () => clearInterval(interval);
}, [currentPage]);
```

**Zweck**: Positionen und Trades werden alle 5 Sekunden aktualisiert

---

## Fehlerbehandlung & Idempotenz

### 1. Idempotenz-Checks

**Zweck**: Verhindert doppelte Trades

#### Check 1: Vor Order-Platzierung

**Location**: `server.js` Zeile 3635-3660

```javascript
// Prüfe ob identischer Trade in letzten 5 Sekunden existiert
const recentTradeCheck = await supabase
  .from('trades')
  .select('id, order_id, created_at')
  .eq('strategy_id', strategy.id)
  .eq('symbol', symbol)
  .eq('side', signal.action)
  .gte('created_at', new Date(Date.now() - 5000).toISOString())
  .maybeSingle();

if (recentTradeCheck.data) {
  return null; // Trade bereits ausgeführt
}
```

#### Check 2: Nach Order-Platzierung

**Location**: `server.js` Zeile 3672-3692

```javascript
// Prüfe ob Order-ID bereits in DB existiert
const existingOrderCheck = await supabase
  .from('trades')
  .select('id')
  .eq('order_id', order.orderId.toString())
  .maybeSingle();

if (existingOrderCheck.data) {
  return order; // Order bereits verarbeitet
}
```

### 2. Trade-Queue

**Zweck**: Verhindert Race Conditions bei gleichzeitigen Signalen

**Location**: `server.js` Zeile 3502-3518

```javascript
// Promise-basierte Queue pro Symbol
const previousTrade = tradeQueues.get(symbol);
if (previousTrade) {
  await previousTrade; // Warte auf vorherigen Trade
}

// Erstelle neues Promise für diesen Trade
let resolveTrade;
const tradePromise = new Promise((resolve) => {
  resolveTrade = resolve;
});
tradeQueues.set(symbol, tradePromise);
```

**Funktionsweise**:
- Jedes Symbol hat eigene Queue
- Wenn Trade läuft, wird neuer Trade in Queue eingereiht
- Nach Abschluss wird Promise aufgelöst, nächster Trade kann starten

### 3. Fehlerbehandlung

#### Binance API Fehler

```javascript
try {
  const order = await binanceClient.order({...});
} catch (error) {
  console.error('❌ Fehler beim Platzieren der Order:', error);
  await logBotEvent('error', 'Order-Fehler', {
    error: error.message,
    symbol: symbol,
    strategy_id: strategy.id
  });
  resolveTrade();
  tradeQueues.delete(symbol);
  return null;
}
```

#### Datenbank-Fehler

```javascript
try {
  await openOrUpdatePosition(...);
} catch (error) {
  console.error('❌ Fehler beim Position-Update:', error);
  // Trade wurde bereits auf Binance ausgeführt, aber Position-Update fehlgeschlagen
  // Logge Fehler, aber Trade bleibt bestehen
}
```

### 4. Position-Consistency

**Problem**: In-Memory Map kann veraltet sein

**Lösung**: 
- Bei kritischen Prüfungen wird Datenbank als "Source of Truth" verwendet
- In-Memory Map wird nur für schnelle Zugriffe verwendet

**Beispiel**:
```javascript
// Bei BUY: Prüfe sowohl Memory als auch DB
const memPosition = openPositions.get(positionKey);
if (memPosition && memPosition.quantity > 0.0001) {
  return { allowed: false, reason: 'Position in Memory' };
}

// Fallback: Prüfe DB
const { data: dbPosition } = await supabase
  .from('positions')
  .select('*')
  .eq('strategy_id', strategy.id)
  .eq('symbol', symbol)
  .in('status', ['open', 'partial'])
  .gt('quantity', 0)
  .maybeSingle();

if (dbPosition && parseFloat(dbPosition.quantity) > 0) {
  return { allowed: false, reason: 'Position in DB' };
}
```

---

## Zusammenfassung: Kompletter Trade-Ablauf

### Kauf-Ablauf:

1. **WebSocket empfängt Preis-Update**
2. **Preis wird in `priceHistory` gespeichert**
3. **`generateSignal()` wird aufgerufen**
4. **Signal mit `action: 'buy'` wird generiert**
5. **Signal wird in `bot_logs` gespeichert**
6. **`canTrade()` prüft alle Bedingungen**:
   - Trading aktiv?
   - Binance Client verfügbar?
   - Genügend USDT?
   - Max Exposure OK?
   - Max Concurrent Trades OK?
   - Keine offene Position?
7. **`executeTrade()` wird aufgerufen**:
   - Trade-Queue prüfen (Race Condition Prevention)
   - Cooldown prüfen
   - Menge berechnen (`calculateQuantity()`)
   - Idempotenz-Check (vor Order)
   - Binance Order platzieren
   - Idempotenz-Check (nach Order)
   - Durchschnittspreis berechnen
   - Position öffnen/erweitern (`openOrUpdatePosition()`)
   - In-Memory Map aktualisieren
   - Trade in DB speichern
   - Cooldown setzen
   - Trade-Queue auflösen

### Verkauf-Ablauf:

1. **Verkaufs-Signal wird generiert**:
   - MA Crossover Bearish ODER
   - Stop Loss ausgelöst ODER
   - Take Profit ausgelöst ODER
   - Trailing Stop ausgelöst
2. **`canTrade()` prüft**: Offene Position vorhanden?
3. **`executeTrade()` wird aufgerufen**:
   - Trade-Queue prüfen
   - Cooldown prüfen
   - Menge aus Position entnehmen (gesamte Position)
   - Lot Size Rundung
   - Idempotenz-Check (vor Order)
   - Binance Order platzieren
   - Idempotenz-Check (nach Order)
   - Durchschnittspreis berechnen
   - Position schließen (`reduceOrClosePosition()`)
   - PnL berechnen
   - Trade in DB speichern (mit PnL)
   - In-Memory Map aktualisieren (Position entfernen)
   - Cooldown setzen
   - Trade-Queue auflösen

---

## Wichtige Code-Stellen

### Server.js:

- **Signal-Generierung**: Zeile 2535-2776 (`generateSignal()`)
- **Trade-Prüfung**: Zeile 3259-3494 (`canTrade()`)
- **Trade-Ausführung**: Zeile 3499-3969 (`executeTrade()`)
- **Menge-Berechnung**: Zeile 3198-3239 (`calculateQuantity()`)
- **Position öffnen/erweitern**: Zeile 83-241 (`openOrUpdatePosition()`)
- **Position schließen**: Zeile 3800-3900 (`reduceOrClosePosition()`)
- **Stop Loss/Take Profit**: Zeile 2818-3122 (`checkStopLossTakeProfit()`)
- **Trailing Stop Logik**: Zeile 2902-3026 (in `checkStopLossTakeProfit()`)

### Frontend:

- **Positionen anzeigen**: `frontend/app/trades/page.tsx`
- **Coins konfigurieren**: `frontend/app/coins/page.tsx`
- **Einstellungen**: `frontend/app/settings/page.tsx`
- **API-Calls**: `frontend/lib/api.ts`

### Supabase:

- **Positionen-Tabelle**: `Supabase SQL Setups/positions_table.sql`
- **Trailing Stop Migration**: `Supabase SQL Setups/trailing_stop_loss_migration.sql`

---

## Fazit

Das System verwendet eine mehrschichtige Architektur mit:

1. **Signal-Generierung** basierend auf technischen Indikatoren
2. **Umfassende Prüfungen** vor jedem Trade (Risk Management)
3. **Idempotenz-Mechanismen** zur Verhinderung doppelter Trades
4. **Trade-Queues** zur Verhinderung von Race Conditions
5. **Cooldown-Mechanismen** zur Begrenzung der Trade-Frequenz
6. **Stop Loss & Take Profit** zum Risikomanagement
7. **Trailing Stop Loss** zur Maximierung von Gewinnen
8. **Frontend-Integration** für Monitoring und Konfiguration

Alle Komponenten arbeiten zusammen, um ein robustes und zuverlässiges Trading-System zu gewährleisten.

