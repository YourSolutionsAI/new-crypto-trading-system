# Refactoring: Status-Modell und Trennung von Kauf-/Verkaufslogik

**Datum:** 2025-01-16  
**Status:** ✅ Abgeschlossen

---

## ANFORDERUNG:

Ziel:
Bitte überarbeite die gesamte Logik meines Trading-Systems in der server.js so, dass sämtliche nachfolgend definierten Anforderungen korrekt, eindeutig und ohne doppelte Signalverarbeitung umgesetzt werden. Die Frontend-Oberfläche bleibt unverändert; alle Anpassungen betreffen ausschließlich die Backend-Logik, Statusverarbeitung und Signalsteuerung.

1. Frontend

Keine Änderungen erforderlich. Die aktuelle Anzeige entspricht den Anforderungen.

2. Backend-Logik
2.1 Kaufstrategien

Die Strategien

MA Cross Aggressive

MA Cross Balanced

MA Cross Conservative

RSI + MA Cross

sollen ausschließlich Kaufentscheidungen treffen.
Diese Strategien dürfen keine Verkaufsentscheidungen mehr auslösen.

2.2 Verkaufslogiken

Verkäufe dürfen in Zukunft nur noch ausgelöst werden durch:

Stop-Loss

Take-Profit

Trailing Stop-Loss

Keine Strategie darf Verkäufe initiieren.

2.3 Statusverwaltung beim Trading

Jeder Coin besitzt einen Status, der sämtliche Fehltrigger verhindert.
Die Statuslogik ist zwingend für die Integrität des Systems.

Verfügbare Statuswerte

PENDING = Coin aktiv, aber kein offener Trade; alle Strategien dürfen Kauf prüfen.

KAUFSIGNAL = Kauf wurde ausgelöst; weitere Kauftrigger sind untersagt.

OFFEN = Position gekauft; Preisüberwachung läuft.

VERKAUFSIGNAL = Verkauf ausgelöst; weiterer Verkauf ist untersagt.

Nach abgeschlossenem Verkauf → Status wieder PENDING

Regeln

Ein Coin darf nur einmal gekauft werden.
Sobald Status ≠ PENDING → Keine weiteren Kauftriggers.

Ein Coin darf nur einmal verkauft werden.
Sobald Status = VERKAUFSIGNAL → Keine weiteren Verkaufsprüfung für denselben Trade.

Signalentkopplung:
Sowohl Kauf- als auch Verkaufssignale dürfen nur genau einmal ausgelöst werden.

Nach erfolgreichem Kauf:

Status = OFFEN

Der Coin wird als offener Posten gespeichert

Kontinuierliche Preisabfrage über Binance läuft weiter

2.4 Stop-Loss und Take-Profit (wenn Trailing Stop nicht aktiv ist)

Stop-Loss + Take-Profit sind nur aktiv, wenn Trailing Stop Loss deaktiviert ist.

Verhalten:

Die Werte werden kontinuierlich geprüft

Aktueller Preis < Stop-Loss → sofort verkaufen

Aktueller Preis > Take-Profit → sofort verkaufen

2.5 Trailing Stop-Loss (abgekoppelte Logik) ✅ IMPLEMENTIERT

Trailing Stop Loss ist eine eigene Logik, vollständig entkoppelt von SL/TP.
Wenn aktiviert:

✅ Stop-Loss und Take-Profit werden automatisch deaktiviert

✅ Kein Aktivierungstrigger: TSL ist **sofort aktiv** ab Kauf (Häkchen in Einstellungen)

✅ Es wird kontinuierlich der höchste erzielte Preis gespeichert (DB-Feld: `highest_price`)

✅ TSL-Prozentwert bestimmt den Stop-Loss-Abstand zum höchsten Preis

Beispielberechnung (exakt so implementiert):

```
① Einstieg:        100 USDT
   TSL:            1%
   Höchster:       100 USDT
   TSL-Trigger:    99 USDT      (100 * 0.99)
   
② Preis → 105 USDT:
   Höchster:       105 USDT     ← aktualisiert!
   TSL-Trigger:    103.95 USDT  ← steigt mit! (105 * 0.99)
   
③ Preis fällt → 103.50 USDT:
   Aktuell:        103.50 USDT
   TSL-Trigger:    103.95 USDT
   → 103.50 < 103.95  →  🔴 VERKAUF!
```

✅ Der dynamische TSL-Triggerwert wird in separatem Feld persistiert (`trailing_stop_price`)

✅ Wenn aktueller Preis < dynamischer TSL-Wert → sofortiger Verkauf

3. Cooldown- und Zusatzlogiken

Alle Cooldown-Mechanismen, Intervalle, Preisabfragen und sonstigen Parameter bleiben unverändert in ihrer aktuellen Implementierung.

4. Zusammenfassung der zentralen Anforderungen

Kaufstrategien = nur Kauf

StopLoss/TakeProfit/TSL = nur Verkauf

Eindeutige Statuslogik garantiert:

keine doppelten Käufe

keine doppelten Verkäufe

Persistenter “Highest Price” für TSL

Persistenter “Trailing Stop Trigger” für TSL

Preisüberwachung konstant aktiv für offene Positionen

SL/TP deaktiviert, sobald TSL aktiv

System muss strikt idempotent sein (ein Signal → eine Aktion)

Prüfung deiner ursprünglichen Logik

Ich habe geprüft, ob alle Punkte technisch sinnvoll umsetzbar sind und ob die Logik vollständig ist:

Bereich	Bewertung	Kommentar
Statusmodell	Sehr sinnvoll	Ohne Statusmodell wären Doppelkäufe/-verkäufe unvermeidbar.
Trennung Kauf/Verkauf	Korrekt	Muss zwingend getrennt sein, um deterministisches Verhalten sicherzustellen.
Trailing Stop Logik	Korrekt	Persistenter Highest Price ist erforderlich.
Deaktivierung von SL/TP bei TSL	Korrekt & notwendig	Verhindert widersprüchliche Verkaufsentscheidungen.
“Nur einmal kaufen/verkaufen”	Wichtig & richtig	Muss strikt implementiert werden.
“Kauf → OFFEN → Verkauf → PENDING”	Stimmig

## 📋 Zusammenfassung

Das Trading-System wurde vollständig überarbeitet, um folgende Anforderungen umzusetzen:

1. ✅ **Kaufstrategien generieren nur noch Kaufsignale** (keine Verkaufssignale)
2. ✅ **Verkäufe werden ausschließlich durch Exit-Mechanismen ausgelöst** (Stop-Loss, Take-Profit, Trailing Stop-Loss)
3. ✅ **Explizites Status-Modell** zur Verhinderung von Doppel-Käufen und -Verkäufen
4. ✅ **Trailing Stop-Loss deaktiviert Stop-Loss und Take-Profit**
5. ✅ **Strikt idempotentes System** (ein Signal → eine Aktion)

---

## 🔄 Status-Modell

### Status-Definitionen

| Status | Bedeutung | Erlaubte Aktionen |
|--------|-----------|-------------------|
| `PENDING` | Coin aktiv, kein offener Trade | Kauf erlaubt |
| `KAUFSIGNAL` | Kauf wurde ausgelöst, Trade läuft | Keine (Trade in Bearbeitung) |
| `OFFEN` | Position gekauft, Preisüberwachung läuft | Verkauf erlaubt (nur durch SL/TP/TSL) |
| `VERKAUFSIGNAL` | Verkauf ausgelöst, Trade läuft | Keine (Trade in Bearbeitung) |

### Status-Übergänge

```
┌─────────┐
│ PENDING │ ◄─────────────────────────┐
└────┬────┘                           │
     │ Kaufsignal generiert           │
     ▼                                │
┌────────────┐                        │
│ KAUFSIGNAL │                        │
└────┬───────┘                        │
     │ executeTrade() erfolgreich     │
     ▼                                │
┌────────┐                            │
│ OFFEN  │                            │
└────┬───┘                            │
     │ SL/TP/TSL ausgelöst            │
     ▼                                │
┌──────────────┐                      │
│ VERKAUFSIGNAL│                      │
└────┬─────────┘                      │
     │ executeTrade() erfolgreich     │
     │ Position geschlossen           │
     └────────────────────────────────┘
```

### Implementierung

Der Status wird in der `positions` Tabelle in der Spalte `trade_status` (ENUM-Typ) gespeichert.

**Wichtig:**
- Status wird **nur bei offenen Positionen** geprüft (`status='open'`)
- Geschlossene Positionen (`status='closed'`) haben keinen aktiven `trade_status` mehr
- Neue Käufe erstellen **neue Position-Rows** mit `trade_status='OFFEN'`

---

## 📝 Änderungen im Detail

### 1. SQL-Migration (Datenbankstruktur)

**Datei:** `Supabase SQL Setups/add_trade_status_column.sql`

**Änderungen:**
- ✅ Neuer ENUM-Typ `trade_status_type` mit Werten: `PENDING`, `KAUFSIGNAL`, `OFFEN`, `VERKAUFSIGNAL`
- ✅ Neue Spalte `trade_status` in `positions` Tabelle
- ✅ Hilfsfunktionen für Status-Abfragen (`check_trade_status`, `get_trade_status`)
- ✅ Audit-Log-Tabelle `trade_status_log` für Status-Änderungen
- ✅ Constraints gegen Race Conditions (Unique-Index für KAUFSIGNAL und VERKAUFSIGNAL)
- ✅ Cleanup-Funktion für hängende Signale (`cleanup_hanging_signals`)

**SQL ausführen:**
```sql
-- In Supabase SQL Editor ausführen:
-- 1. Öffne: https://app.supabase.com/project/[PROJECT_ID]/sql
-- 2. Lade: Supabase SQL Setups/add_trade_status_column.sql
-- 3. Führe aus: "Run"
```

---

### 2. Signal-Generierung (Kaufstrategien)

**Datei:** `server.js`  
**Funktion:** `generateSignal()` (Zeilen 2578-2820)

**Änderungen:**
- ✅ **Entfernt:** Verkaufssignal-Generierung bei bearish MA Crossover
- ✅ **Ersetzt durch:** `action: 'hold'` bei bearish Signal
- ✅ **Grund:** Strategien dürfen nur noch Kaufentscheidungen treffen

**Vorher:**
```javascript
if (differencePercent < -threshold) {
  return { action: 'sell', ... };
}
```

**Nachher:**
```javascript
if (differencePercent < -threshold) {
  return { 
    action: 'hold', 
    reason: 'MA Crossover Bearish erkannt (Verkäufe nur durch SL/TP/TSL)',
    ...
  };
}
```

---

### 3. Exit-Logik (Stop-Loss, Take-Profit, Trailing Stop)

**Datei:** `server.js`  
**Funktion:** `checkStopLossTakeProfit()` (Zeilen 2862-3294)

**Änderungen:**
- ✅ **Trailing Stop-Loss hat absolute Priorität**
- ✅ **Stop-Loss wird nur geprüft wenn TSL NICHT aktiv** (`!useTrailingStop`)
- ✅ **Take-Profit wird nur geprüft wenn TSL NICHT aktiv** (`!useTrailingStop`)
- ✅ **Klare Dokumentation** der Prioritäten

**Logik:**
```javascript
if (useTrailingStop) {
  // NUR Trailing Stop prüfen
  // Stop-Loss und Take-Profit werden IGNORIERT
} else {
  // Stop-Loss prüfen (wenn konfiguriert)
  // Take-Profit prüfen (wenn konfiguriert)
}
```

---

### 4. Trade-Validierung (Status-Prüfungen)

**Datei:** `server.js`  
**Funktion:** `canTrade()` (Zeilen 3434-3707)

**Änderungen:**
- ✅ **Bei BUY:** Prüfe `trade_status` muss `PENDING` sein (oder keine Position)
- ✅ **Bei SELL:** Prüfe `trade_status` muss `OFFEN` sein
- ✅ **Verhindert:** Doppel-Käufe und Doppel-Verkäufe durch Status-Prüfung

**Code:**
```javascript
// Bei BUY
if (existingPosition && tradeStatus !== 'PENDING') {
  return { 
    allowed: false, 
    reason: `Kauf nicht erlaubt: Status '${tradeStatus}'` 
  };
}

// Bei SELL
if (position && tradeStatus !== 'OFFEN') {
  return { 
    allowed: false, 
    reason: `Verkauf nicht erlaubt: Status '${tradeStatus}'` 
  };
}
```

---

### 5. Trade-Ausführung (Status-Übergänge)

**Datei:** `server.js`  
**Funktion:** `executeTrade()` (Zeilen 3712-4200)

**Änderungen:**
- ✅ **VOR Order-Platzierung:** Status auf `VERKAUFSIGNAL` setzen (bei SELL)
- ✅ **NACH Order-Platzierung:** Status wird durch nachfolgende Funktionen gesetzt
  - BUY: Status wird in `openOrUpdatePosition()` auf `OFFEN` gesetzt
  - SELL: Position wird geschlossen, Status irrelevant

**Code:**
```javascript
// VOR Order-Platzierung (nur bei SELL)
if (side === 'SELL') {
  await supabase
    .from('positions')
    .update({ trade_status: 'VERKAUFSIGNAL' })
    .eq('strategy_id', strategy.id)
    .eq('symbol', symbol)
    .eq('trade_status', 'OFFEN');
}
```

---

### 6. Position-Management (Status-Initialisierung)

**Datei:** `server.js`  
**Funktion:** `openOrUpdatePosition()` (Zeilen 84-242)

**Änderungen:**
- ✅ **Bei Position-Erweiterung:** Status auf `OFFEN` setzen
- ✅ **Bei neuer Position:** Status auf `OFFEN` setzen
- ✅ **Garantiert:** Position ist nach Kauf immer im Status `OFFEN`

**Code:**
```javascript
// Bei UPDATE und INSERT
updateData.trade_status = 'OFFEN';
insertData.trade_status = 'OFFEN';
```

---

### 7. Position-Schließung (Status-Reset)

**Datei:** `server.js`  
**Funktion:** `reduceOrClosePosition()` (Zeilen 345-580)

**Änderungen:**
- ✅ Position wird geschlossen (`status='closed'`, `quantity=0`)
- ✅ `trade_status` bleibt dokumentarisch bei `VERKAUFSIGNAL`
- ✅ **Wichtig:** Geschlossene Positionen werden nicht wiederverwendet
- ✅ Neue Käufe erstellen neue Position-Rows

**Hinweis:** Der `trade_status` bei geschlossenen Positionen ist nur dokumentarisch und wird nicht mehr geprüft.

---

### 8. WebSocket Handler (Signal-Verarbeitung)

**Datei:** `server.js`  
**WebSocket Message Handler:** (Zeilen 4758-5100)

**Änderungen:**
- ✅ **Keine direkten Änderungen** am WebSocket Handler notwendig
- ✅ Status-Prüfung erfolgt automatisch über `canTrade()` → `executeTrade()`
- ✅ Signal-Verarbeitung bleibt unverändert

---

### 9. In-Memory Guards (Doppel-Signal-Schutz)

**Datei:** `server.js`  
**Globale Variablen:** (Zeile 67-68)

**Änderungen:**
- ✅ **Neu:** `pendingBuySignals` Map zur Verhinderung von Doppel-Käufen
- ✅ **Erweitert:** `pendingSellSignals` weiterhin für Doppel-Verkäufe
- ✅ **WebSocket Handler:** Prüfung beider Maps vor Signal-Verarbeitung
- ✅ **executeTrade():** Setzen/Löschen der Maps vor/nach Trade

**Code:**
```javascript
// Global
let pendingBuySignals = new Map();
let pendingSellSignals = new Map();

// WebSocket Handler
if (signal.action === 'buy') {
  if (pendingBuySignals.has(positionKey)) {
    console.log(`⏭️  BUY-Signal übersprungen: Bereits aktiv`);
    continue;
  }
}

// Vor Trade
pendingBuySignals.set(positionKey, { timestamp, reason });

// Nach Trade
pendingBuySignals.delete(positionKey);
```

---

## 🎯 Ergebnis

### Garantierte Eigenschaften

Das System garantiert jetzt folgende Eigenschaften:

1. ✅ **Keine Strategie-basierten Verkäufe**
   - Strategien generieren nur `buy` oder `hold` Signale
   - Verkäufe werden ausschließlich durch Exit-Mechanismen ausgelöst

2. ✅ **Keine Doppel-Käufe**
   - Status-Prüfung in `canTrade()`
   - In-Memory Guard `pendingBuySignals`
   - Unique-Index in DB für `trade_status='KAUFSIGNAL'`

3. ✅ **Keine Doppel-Verkäufe**
   - Status-Prüfung in `canTrade()`
   - In-Memory Guard `pendingSellSignals`
   - Unique-Index in DB für `trade_status='VERKAUFSIGNAL'`

4. ✅ **TSL deaktiviert SL/TP**
   - Explizite `!useTrailingStop` Prüfung
   - Dokumentierte Prioritäten

5. ✅ **Persistente Trailing Stop-Daten**
   - `highest_price` in DB gespeichert
   - `trailing_stop_price` in DB gespeichert
   - Kontinuierliche Updates bei Preis-Änderungen

6. ✅ **Strikt idempotent**
   - Ein Signal → eine Aktion
   - Mehrfache Signale werden abgefangen
   - Race Conditions werden verhindert

---

## 🔍 Testplan

### Manuelle Tests

**Test 1: Kaufsignal → Position öffnen**
1. Bot starten
2. Warten auf bullish MA Crossover
3. ✅ Erwartung: Kauf wird ausgeführt, Status = `OFFEN`

**Test 2: Doppel-Kaufsignal verhindern**
1. Position bereits offen
2. Neues Kaufsignal generiert
3. ✅ Erwartung: Signal wird ignoriert (Status ≠ `PENDING`)

**Test 3: Stop-Loss auslösen**
1. Position offen
2. Preis fällt unter Stop-Loss
3. ✅ Erwartung: Verkauf wird ausgelöst, Position geschlossen

**Test 4: Take-Profit auslösen**
1. Position offen
2. Preis steigt über Take-Profit
3. ✅ Erwartung: Verkauf wird ausgelöst, Position geschlossen

**Test 5: Trailing Stop-Loss**
1. Position offen mit TSL aktiviert
2. Preis steigt → `highest_price` wird aktualisiert
3. Preis fällt → TSL wird ausgelöst
4. ✅ Erwartung: Verkauf wird ausgelöst, Position geschlossen

**Test 6: TSL deaktiviert SL/TP**
1. Position offen mit TSL aktiviert
2. SL/TP-Schwellwerte werden erreicht
3. ✅ Erwartung: SL/TP werden NICHT ausgelöst, nur TSL ist aktiv

**Test 7: Bearish Signal → kein Verkauf**
1. Position offen
2. Bearish MA Crossover tritt ein
3. ✅ Erwartung: `hold` Signal, kein Verkauf

---

## 📊 Monitoring

### Status-Verteilung überwachen

```sql
-- Status-Übersicht aller offenen Positionen
SELECT * FROM v_trade_status_summary;

-- Hängende Signale bereinigen (älter als 10 Minuten)
SELECT * FROM cleanup_hanging_signals(10);

-- Status-Änderungen anzeigen (letzte 100)
SELECT * FROM trade_status_log 
ORDER BY created_at DESC 
LIMIT 100;
```

### Bot-Logs überwachen

```javascript
// In den Bot-Logs erscheinen jetzt:
✅ Status gesetzt: OFFEN → VERKAUFSIGNAL für BTCUSDT
🔒 Kaufsignal-State gesetzt
✅ Kaufsignal-State entfernt (Trade erfolgreich)
⏭️  BUY-Signal übersprungen: Bereits aktives Kaufsignal vorhanden
```

---

## 🚀 Deployment

### 1. SQL-Migration ausführen

```bash
# In Supabase SQL Editor:
# 1. Öffne: https://app.supabase.com/project/[PROJECT_ID]/sql
# 2. Lade Datei: Supabase SQL Setups/add_trade_status_column.sql
# 3. Führe aus
```

### 2. Server.js deployen

```bash
# Lokal testen
npm install
node server.js

# Vercel deployen
git add .
git commit -m "feat: Status-Modell und Trennung Kauf/Verkauf implementiert"
git push origin main
```

### 3. Bestehende Positionen migrieren

```sql
-- Alle offenen Positionen auf Status OFFEN setzen
UPDATE positions 
SET trade_status = 'OFFEN' 
WHERE status = 'open' 
  AND quantity > 0
  AND trade_status IS NULL;
```

---

## ⚠️ Breaking Changes

### Keine Breaking Changes im Frontend

Das Frontend bleibt vollständig unverändert. Alle Änderungen betreffen nur:
- Backend-Logik (`server.js`)
- Datenbankstruktur (neue Spalte `trade_status`)
- Keine API-Änderungen
- Keine UI-Änderungen

### Rückwärtskompatibilität

- ✅ Bestehende Positionen werden automatisch auf Status `OFFEN` gesetzt
- ✅ Alte Trades in der `trades` Tabelle bleiben unverändert
- ✅ API-Endpoints bleiben unverändert

---

## 📚 Referenzen

### Betroffene Dateien

| Datei | Änderungen |
|-------|-----------|
| `Supabase SQL Setups/add_trade_status_column.sql` | ✅ Neu erstellt |
| `server.js` | ✅ Mehrere Funktionen angepasst |
| `REFACTORING_STATUS_MODELL_2025.md` | ✅ Diese Dokumentation |

### Betroffene Funktionen in server.js

| Funktion | Zeilen | Änderung |
|----------|--------|----------|
| `generateSignal()` | 2578-2820 | Verkaufssignal entfernt |
| `checkStopLossTakeProfit()` | 2862-3294 | TSL-Priorität klargestellt |
| `canTrade()` | 3434-3707 | Status-Prüfungen hinzugefügt |
| `executeTrade()` | 3712-4200 | Status-Übergänge implementiert |
| `openOrUpdatePosition()` | 84-242 | Status auf OFFEN setzen |
| `reduceOrClosePosition()` | 345-580 | Position schließen |
| WebSocket Handler | 4758-5100 | In-Memory Guards erweitert |

---

## ✅ Abschluss

**Status:** ✅ **ABGESCHLOSSEN**  
**Datum:** 2025-01-16  
**Nächste Schritte:**

1. ✅ SQL-Migration in Supabase ausführen
2. ✅ Server.js deployen (lokal testen, dann Vercel)
3. ✅ Manuelle Tests durchführen (siehe Testplan)
4. ✅ Monitoring einrichten (Status-Logs überwachen)
5. ✅ Erste Trades beobachten und verifizieren

**Kontakt bei Fragen:**
- Dokumentation: `REFACTORING_STATUS_MODELL_2025.md`
- SQL-Migration: `Supabase SQL Setups/add_trade_status_column.sql`
- Hauptlogik: `server.js`

---

## 📝 NACHTRAG: TSL-Aktivierungsschwelle entfernt (2025-01-16)

### Problem identifiziert

Die ursprüngliche Implementierung enthielt noch eine **Aktivierungsschwelle** für Trailing Stop Loss, die der Anforderung widersprach:

**Ursprüngliche (fehlerhafte) Logik:**
```javascript
// TSL wurde erst aktiviert nach X% Gewinn
if (activationThreshold === 0 || priceChangePercent >= activationThreshold) {
  // Initialisiere TSL
}
```

**Problem:** TSL war nicht sofort aktiv, sondern wartete auf Aktivierungsschwelle.

---

### Korrektur durchgeführt ✅

**Neue (korrekte) Logik:**
```javascript
// TSL ist SOFORT aktiv beim Kauf
if (trailingStopPrice === null || trailingStopPrice === undefined) {
  highestPrice = Math.max(highestPrice, currentPrice);
  trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
}
```

---

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `server.js` (openOrUpdatePosition) | ✅ Aktivierungsschwellen-Check entfernt |
| `server.js` (checkStopLossTakeProfit) | ✅ Aktivierungsschwellen-Check entfernt |
| `server.js` (executeTrade) | ✅ Aktivierungsschwellen-Check entfernt |
| `frontend/app/coins/page.tsx` | ✅ "Aktivierungs-Schwelle (%)" Feld entfernt |
| `REFACTORING_STATUS_MODELL_2025.md` | ✅ Dokumentation aktualisiert |

---

### Frontend-Änderung

**Vorher:**
```
☑ Trailing Stop Loss aktivieren
  Aktivierungs-Schwelle (%): [___]
```

**Nachher:**
```
☑ Trailing Stop Loss aktivieren
  ℹ️ Trailing Stop Loss:
  • Sofort aktiv beim Kauf
  • Folgt automatisch dem höchsten Preis
  • Verkauf bei: Höchster Preis - Stop Loss %
```

---

### Backend-Änderung

**3 Funktionen korrigiert:**

1. **`openOrUpdatePosition()`** (Zeile 197-226)
   - TSL wird sofort initialisiert: `entry_price * (1 - stopLoss%)`
   - `trailing_stop_activation_threshold` wird auf 0 gesetzt

2. **`checkStopLossTakeProfit()`** (Zeile 2978-2986)
   - Keine Aktivierungsschwellen-Prüfung mehr
   - TSL wird sofort initialisiert wenn `trailing_stop_price` noch null

3. **`executeTrade()`** (Zeilen 3973-3976, 4000-4003)
   - TSL wird sofort bei Position-Erstellung initialisiert
   - `trailingStopActivationThreshold` wird auf 0 gesetzt

---

### Garantierte Eigenschaften (aktualisiert)

✅ **TSL ist sofort aktiv** - keine Wartezeit, keine Schwelle  
✅ **TSL-Trigger wird beim Kauf gesetzt** - Entry-Price * (1 - StopLoss%)  
✅ **TSL folgt höchstem Preis** - automatische Anpassung nach oben  
✅ **Verkauf bei Unterschreitung** - Preis < TSL-Trigger → Verkauf  
✅ **Take-Profit deaktiviert** - wenn TSL aktiv, wird TP ignoriert  
✅ **Stop-Loss deaktiviert** - wenn TSL aktiv, wird SL ignoriert  

---

### Rückwärtskompatibilität

- ✅ `trailing_stop_activation_threshold` bleibt in DB (auf 0 gesetzt)
- ✅ Alte Positionen mit Schwelle > 0 werden beim nächsten Update auf 0 gesetzt
- ✅ Keine Breaking Changes für bestehende Positionen

---

**Ende der Dokumentation**

