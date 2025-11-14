# 🪙 Coin-Konfiguration

## Aktuell aktiver Coin: **DOGECOIN (DOGE/USDT)** 🐕

DOGE ist sehr volatil und ideal für Tests - Sie sehen schnell Signale!

---

## 📊 Verfügbare Trading-Paare

### Sehr Volatil (viele Signale) 🔥
```javascript
// Dogecoin - Empfohlen für Tests!
wss://stream.binance.com:9443/ws/dogeusdt@trade

// Shiba Inu
wss://stream.binance.com:9443/ws/shibusdt@trade

// Pepe
wss://stream.binance.com:9443/ws/pepeusdt@trade
```

### Moderat Volatil (normale Signale) ⚡
```javascript
// Ethereum
wss://stream.binance.com:9443/ws/ethusdt@trade

// Solana
wss://stream.binance.com:9443/ws/solusdt@trade

// BNB
wss://stream.binance.com:9443/ws/bnbusdt@trade

// Cardano
wss://stream.binance.com:9443/ws/adausdt@trade

// XRP
wss://stream.binance.com:9443/ws/xrpusdt@trade
```

### Wenig Volatil (wenige Signale) 🐢
```javascript
// Bitcoin - Stabil, wenig Signale
wss://stream.binance.com:9443/ws/btcusdt@trade

// USDC
wss://stream.binance.com:9443/ws/usdcusdt@trade
```

---

## 🔧 Coin wechseln

### In `server.js` (Zeile ~306):

**Aktuell:**
```javascript
const binanceWsUrl = 'wss://stream.binance.com:9443/ws/dogeusdt@trade';
```

**Ändern zu einem anderen Coin:**
```javascript
// Ethereum
const binanceWsUrl = 'wss://stream.binance.com:9443/ws/ethusdt@trade';

// Solana
const binanceWsUrl = 'wss://stream.binance.com:9443/ws/solusdt@trade';
```

Dann:
```bash
git add server.js
git commit -m "chore: Wechsel zu [COIN_NAME]"
git push origin main
```

---

## 🎯 Erwartete Signale pro Stunde

| Coin | Signale/Stunde | Preis | Volatilität |
|------|----------------|-------|-------------|
| **DOGE** | 10-30 | ~$0.40 | Sehr hoch 🔥 |
| **SHIB** | 15-40 | ~$0.00003 | Sehr hoch 🔥 |
| **ETH** | 5-15 | ~$3,500 | Hoch ⚡ |
| **SOL** | 8-20 | ~$250 | Hoch ⚡ |
| **BNB** | 3-10 | ~$650 | Mittel ⚡ |
| **XRP** | 4-12 | ~$0.70 | Mittel ⚡ |
| **BTC** | 1-5 | ~$97,000 | Niedrig 🐢 |

---

## 💡 Tipps

### Für Tests (viele Signale)
- Verwenden Sie **DOGE, SHIB** oder **PEPE**
- Threshold: **0.001% - 0.01%**
- MA: **5/15** oder **10/30**

### Für echtes Trading (wenige, aber starke Signale)
- Verwenden Sie **BTC, ETH** oder **BNB**
- Threshold: **0.1% - 0.5%**
- MA: **20/50** oder **50/200**

---

## 🔄 Mehrere Coins gleichzeitig (zukünftig)

Um mehrere Coins parallel zu überwachen, müssten wir:

1. Mehrere WebSocket-Verbindungen öffnen
2. Separate Preis-Historien für jeden Coin
3. Strategien pro Symbol zuordnen

**Beispiel-Code (für später):**
```javascript
const coins = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT'];

coins.forEach(coin => {
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}@trade`);
  // ... Handler pro Coin
});
```

---

## 📊 Binance Stream-Format

Alle Binance WebSocket-URLs folgen diesem Muster:
```
wss://stream.binance.com:9443/ws/[SYMBOL]@trade
```

Wobei `[SYMBOL]` das Trading-Paar in **Kleinbuchstaben** ist:
- `btcusdt` = Bitcoin/USDT
- `ethusdt` = Ethereum/USDT
- `dogeusdt` = Dogecoin/USDT
- etc.

---

**🐕 Aktuell läuft DOGE - viel Erfolg beim Testen!**

