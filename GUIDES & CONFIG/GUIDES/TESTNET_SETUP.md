# 🧪 Binance Testnet Setup - Schritt für Schritt

## 🎯 Was Sie erreichen werden

Nach diesem Setup kann Ihr Bot:
- ✅ Echte Orders auf Binance Testnet platzieren
- ✅ Trades automatisch ausführen (mit Fake-Geld!)
- ✅ Trading-Performance tracken
- ✅ PnL (Profit & Loss) berechnen

**⚠️ WICHTIG:** Testnet verwendet **KEIN ECHTES GELD!** Perfekt zum Testen!

---

## 📋 Schritt 1: Binance Testnet Account erstellen

### 1.1 Zur Testnet-Website gehen
Öffnen Sie: **https://testnet.binance.vision/**

### 1.2 Mit GitHub anmelden
1. Klicken Sie oben rechts auf **"GitHub"**
2. Autorisieren Sie "Binance Testnet" (wenn Sie das erste Mal sind)
3. Sie werden automatisch eingeloggt
4. ✅ Sie haben jetzt einen Testnet-Account!

### 1.3 API Keys generieren
1. Auf der Hauptseite sehen Sie: **"Generate HMAC_SHA256 Key"**
2. Klicken Sie auf **"Generate"**
3. Sie erhalten:
   - **API Key** (öffentlich) - z.B. `XYZ123abc...`
   - **Secret Key** (geheim!) - z.B. `ABC789xyz...`

**⚠️ WICHTIG:**
- Kopieren Sie BEIDE Keys sofort!
- Secret Key wird nur EINMAL angezeigt!
- Speichern Sie sie sicher (z.B. in Notepad)

---

## 🔑 Schritt 2: API Keys in Render hinzufügen

### 2.1 Render Dashboard öffnen
1. Gehen Sie zu https://dashboard.render.com
2. Wählen Sie Ihren Service: **crypto-trading-bot**
3. Klicken Sie links auf **"Environment"**

### 2.2 Umgebungsvariablen hinzufügen
Klicken Sie auf **"Add Environment Variable"** und fügen Sie hinzu:

#### Variable 1: BINANCE_API_KEY
```
Key:   BINANCE_API_KEY
Value: [Ihr API Key von Testnet]
```

#### Variable 2: BINANCE_API_SECRET
```
Key:   BINANCE_API_SECRET
Value: [Ihr Secret Key von Testnet]
```

#### Variable 3: TRADING_ENABLED
```
Key:   TRADING_ENABLED
Value: true
```

### 2.3 Speichern & Neu deployen
1. Klicken Sie auf **"Save Changes"**
2. Render startet automatisch neu (~2-3 Minuten)
3. ✅ Fertig!

---

## 🎬 Schritt 3: Trading aktivieren

### 3.1 Bot neu starten
Öffnen Sie PowerShell:

```powershell
# Bot stoppen
Invoke-WebRequest -Uri "https://new-crypto-trading-system.onrender.com/api/stop-bot" -Method POST

# Warten Sie 5 Sekunden
Start-Sleep -Seconds 5

# Bot starten (jetzt mit Trading!)
Invoke-WebRequest -Uri "https://new-crypto-trading-system.onrender.com/api/start-bot" -Method POST
```

### 3.2 Logs beobachten
Gehen Sie zu **Render → Logs**. Sie sollten sehen:

```
✅ Binance Testnet Client initialisiert
📊 Lade Trading-Strategien von Supabase...
✅ 1 aktive Strategie(n) geladen
🔌 Stelle Verbindung zu Binance her...
✅ Verbindung zu Binance erfolgreich hergestellt
```

---

## 🎯 Schritt 4: Ersten Trade abwarten

### Was passiert automatisch:

#### Phase 1: Daten sammeln (30-60 Sekunden)
```
💰 DOGE/USDT: 0.401234 USDT
📊 Sammle Daten... 40/50 (80%)
```

#### Phase 2: Signal erkannt
```
═══════════════════════════════════════════════
🎯 TRADING SIGNAL: BUY
═══════════════════════════════════════════════
📊 Strategie: MA Cross Strategy
💰 Preis: 0.401678 USDT
📈 MA20: 0.401823
📉 MA50: 0.401234
═══════════════════════════════════════════════
```

#### Phase 3: ORDER WIRD AUSGEFÜHRT! 🚀
```
═══════════════════════════════════════════════
🔄 FÜHRE BUY-ORDER AUS
═══════════════════════════════════════════════
📊 Symbol: BTCUSDT
📈 Seite: BUY
💰 Preis: 0.401678 USDT
🔢 Menge: 249
💵 Wert: ~100.02 USDT

✅ Order ausgeführt!
   Order ID: 12345678
   Status: FILLED
   Ausgeführte Menge: 249.0
   Durchschnittspreis: 0.401680
═══════════════════════════════════════════════

✅ Trade in Datenbank gespeichert
```

#### Phase 4: Warte auf SELL-Signal (5-30 Minuten)
```
📊 Hold - MA20: 0.401823 | MA50: 0.401234 | Diff: 0.147%
```

#### Phase 5: SELL ORDER 📉
```
═══════════════════════════════════════════════
🔄 FÜHRE SELL-ORDER AUS
═══════════════════════════════════════════════
📊 Symbol: BTCUSDT
📈 Seite: SELL
💰 Preis: 0.403456 USDT

✅ Order ausgeführt!
✅ Trade in Datenbank gespeichert
📈 PnL: +0.44 USDT (+0.44%)
═══════════════════════════════════════════════
```

---

## 📊 Schritt 5: Trades in Supabase überprüfen

### 5.1 Supabase Table Editor öffnen
1. Gehen Sie zu https://supabase.com/dashboard
2. Wählen Sie Ihr Projekt
3. Klicken Sie auf **"Table Editor"**

### 5.2 Trades-Tabelle überprüfen
Öffnen Sie die **trades** Tabelle:

| Spalte | Beispiel | Bedeutung |
|--------|----------|-----------|
| **symbol** | BTCUSDT | Trading-Paar |
| **side** | buy / sell | Kauf oder Verkauf |
| **price** | 0.401680 | Ausführungspreis |
| **quantity** | 249.0 | Menge |
| **total** | 100.02 | Gesamtwert in USDT |
| **pnl** | +0.44 | Profit/Loss |
| **pnl_percent** | +0.44% | Profit/Loss in % |
| **status** | executed | Order-Status |
| **order_id** | 12345678 | Binance Order ID |

### 5.3 Trading-Performance anzeigen
Nutzen Sie die vorbereiteten Views:

```sql
-- Heutige Performance
SELECT * FROM v_today_performance;

-- Aktive Strategien mit Stats
SELECT * FROM v_active_strategies;
```

---

## ⚙️ Konfiguration & Einstellungen

### Trade-Größe anpassen
In Supabase → strategies → config:

```json
{
  "risk": {
    "max_trade_size_usdt": 100,     ← Trade-Größe ($10 - $1000)
    "stop_loss_percent": 2,         ← Stop-Loss (2%)
    "take_profit_percent": 5,       ← Take-Profit (5%)
    "max_concurrent_trades": 3      ← Max. gleichzeitige Trades
  }
}
```

### Trade-Cooldown anpassen
In `server.js` (Zeile 65):

```javascript
const TRADE_COOLDOWN = 300000;  // 5 Minuten (in Millisekunden)
```

**Empfohlene Werte:**
- **Tests**: 60000 (1 Minute)
- **Normal**: 300000 (5 Minuten)
- **Konservativ**: 600000 (10 Minuten)

---

## 🔍 Troubleshooting

### Problem: "BINANCE API Keys nicht gesetzt"
**Lösung:**
1. Überprüfen Sie Render → Environment
2. Stellen Sie sicher, dass BINANCE_API_KEY und BINANCE_API_SECRET gesetzt sind
3. Keys müssen vom Testnet stammen (nicht Live-API!)
4. Render neu deployen (Manual Deploy)

### Problem: "Trading ist global deaktiviert"
**Lösung:**
1. Setzen Sie TRADING_ENABLED=true in Render Environment
2. Bot neu starten

### Problem: "Order fehlgeschlagen - Invalid symbol"
**Lösung:**
1. Überprüfen Sie, dass die Strategie in Supabase das richtige Symbol hat
2. Testnet unterstützt nicht alle Symbols
3. Empfohlen: BTCUSDT, ETHUSDT, BNBUSDT

### Problem: "No offene Position zum Verkaufen"
**Lösung:**
- Das ist normal! Der Bot verkauft nur, wenn er vorher gekauft hat
- Warten Sie auf das nächste BUY-Signal

### Problem: "Maximum gleichzeitiger Trades erreicht"
**Lösung:**
- Erhöhen Sie `max_concurrent_trades` in der Strategie-Config
- Oder warten Sie, bis Positionen geschlossen werden

### Problem: "Account has insufficient balance for requested action" (Code -2010)
**Lösung:**
1. **Testnet-Guthaben prüfen:** Gehen Sie zu https://testnet.binance.vision/ und loggen Sie sich ein
2. **Faucet nutzen:** Holen Sie sich mehr Testnet-Tokens über den Faucet
3. **Dashboard prüfen:** Das Dashboard zeigt jetzt das verfügbare USDT-Guthaben an
4. **Balance-Check:** Der Bot prüft automatisch das Guthaben vor jeder BUY-Order
5. **Warnung:** Bei weniger als 100 USDT wird eine Warnung im Dashboard angezeigt

**Wichtig:** Auch im Testnet kann das Guthaben ausgehen! Der Bot prüft jetzt automatisch das verfügbare Guthaben und verhindert Orders bei unzureichendem Guthaben.

---

## 🎓 Was der Bot jetzt kann

### Automatisches Trading:
1. ✅ Empfängt Live-Marktdaten
2. ✅ Analysiert Preistrends (MA Crossover)
3. ✅ Generiert BUY/SELL Signale
4. ✅ **Führt automatisch Orders aus** 🆕
5. ✅ **Trackt offene Positionen** 🆕
6. ✅ **Berechnet Profit/Loss** 🆕
7. ✅ **Speichert alle Trades in Datenbank** 🆕

### Risk Management:
- ✅ Trade-Cooldown (verhindert Over-Trading)
- ✅ Max. gleichzeitige Trades
- ✅ Position-Tracking (nur verkaufen wenn gekauft)
- ✅ Quantity-Berechnung basierend auf Config
- ✅ **Balance-Prüfung vor BUY-Orders** 🆕 (verhindert "insufficient balance" Fehler)

### Logging & Monitoring:
- ✅ Alle Trades in `trades` Tabelle
- ✅ Fehler in `bot_logs` Tabelle
- ✅ PnL-Berechnung bei jedem SELL
- ✅ Performance-Views in Supabase
- ✅ **Testnet-Guthaben im Dashboard sichtbar** 🆕
- ✅ **Automatische Balance-Prüfung mit Warnungen** 🆕

---

## 📈 Nächste Schritte

### Kurzfristig (diese Woche):
1. ✅ Beobachten Sie die ersten Trades
2. ✅ Überprüfen Sie PnL in Supabase
3. ✅ Optimieren Sie die Strategie-Parameter

### Mittelfristig (nächste Woche):
1. 🔄 Stop-Loss & Take-Profit implementieren
2. 🔄 Weitere technische Indikatoren (RSI, MACD)
3. 🔄 Benachrichtigungen (E-Mail, Telegram)

### Langfristig (nächster Monat):
1. 🔄 Frontend-Dashboard entwickeln
2. 🔄 Backtesting-System
3. 🔄 Multi-Exchange-Support
4. 🔄 **Live-Trading** (mit echtem Geld - VORSICHTIG!)

---

## ⚠️ WICHTIGE SICHERHEITSHINWEISE

### Testnet:
- ✅ Verwendet **KEIN** echtes Geld
- ✅ Perfekt zum Lernen und Testen
- ✅ Alle Funktionen wie im echten Trading

### Bevor Sie Live gehen:
1. ⚠️ **Mindestens 1 Monat** im Testnet testen
2. ⚠️ **Positive PnL** im Testnet erreichen
3. ⚠️ **Kleine Beträge** starten ($10-50)
4. ⚠️ **Stop-Loss immer aktiv**
5. ⚠️ **Nur Geld einsetzen, das Sie verlieren können**

---

## 🎉 Herzlichen Glückwunsch!

Ihr Bot kann jetzt **automatisch traden**! 

Sie haben ein vollständiges Trading-System mit:
- ✅ Signal-Generierung
- ✅ Order-Ausführung  
- ✅ Risk Management
- ✅ Performance-Tracking

**Das ist ein großer Meilenstein!** 🚀

---

## 📞 Support

Bei Fragen:
- Prüfen Sie die Render Logs
- Schauen Sie in Supabase bot_logs nach Fehlern
- Öffnen Sie ein GitHub Issue

**Viel Erfolg mit Ihrem Trading Bot!** 💰📈

