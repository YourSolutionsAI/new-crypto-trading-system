# 🚀 Quick Start: DB-basierte Exchange Info

## In 5 Minuten einsatzbereit!

### Schritt 1: SQL ausführen (2 Min)

1. Öffne Supabase Dashboard
2. Gehe zu **SQL Editor**
3. Öffne die Datei `Supabase SQL Setups/coin_exchange_info.sql`
4. Kopiere den **gesamten Inhalt**
5. Füge ihn in den SQL Editor ein
6. Klicke **Run** (oder F5)

✅ **Ergebnis:** 3 Tabellen erstellt (coin_exchange_info, coin_exchange_info_history, coin_alerts)

---

### Schritt 2: Backend starten (1 Min)

```bash
# Im Projekt-Root
node server.js
```

✅ **Ergebnis:** Server läuft auf Port 10000

---

### Schritt 3: Frontend starten (1 Min)

```bash
cd frontend
npm run dev
```

✅ **Ergebnis:** Frontend läuft auf http://localhost:3000

---

### Schritt 4: Erste Synchronisierung (1 Min)

1. Öffne Browser: http://localhost:3000/coins
2. Klicke auf **"🔄 Exchange-Info synchronisieren"**
3. Warte 5-10 Sekunden
4. ✅ Erfolgs-Meldung erscheint

---

### Fertig! 🎉

Du kannst jetzt:

✅ **Coins hinzufügen** mit dem Dropdown (zeigt nur Spot-USDT-Paare)
✅ **Exchange-Details sehen** für jeden Coin
✅ **Alerts bekommen** bei Status-Änderungen
✅ **Manual Sync** jederzeit ausführen

---

## 🔍 Wie sehe ich Alerts?

### Im Frontend
- Oben auf der `/coins` Seite
- Auto-Refresh alle 30 Sekunden
- Klicke "Bestätigen" um Alerts zu schließen

### In der Datenbank
```sql
SELECT * FROM coin_alerts 
WHERE is_acknowledged = false 
ORDER BY created_at DESC;
```

---

## 📚 Mehr Infos

Siehe `DB_IMPLEMENTATION_COMPLETE.md` für vollständige Dokumentation.

