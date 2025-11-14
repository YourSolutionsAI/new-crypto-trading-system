# Frontend Setup Guide

## Übersicht

Das Frontend wurde als minimales Next.js Dashboard erstellt mit folgenden Funktionen:

- ✅ **Trade-Überwachung**: Aktuelle Trades und offene Positionen anzeigen
- ✅ **Strategien-Verwaltung**: Strategien aktivieren/deaktivieren und konfigurieren
- ✅ **Dashboard**: Übersicht über Bot-Status und Performance

## Projektstruktur

```
frontend/
├── app/
│   ├── layout.tsx          # Haupt-Layout mit Navigation
│   ├── page.tsx            # Dashboard-Seite
│   ├── trades/
│   │   └── page.tsx        # Trade-Übersicht
│   └── strategies/
│       └── page.tsx        # Strategien-Verwaltung
├── components/
│   └── Navigation.tsx      # Navigation-Komponente
├── lib/
│   ├── api.ts              # API Client für Backend
│   └── types.ts            # TypeScript Types
└── .env.local.example      # Umgebungsvariablen Template
```

## Lokale Entwicklung

### 1. Umgebungsvariablen einrichten

Erstelle eine `.env.local` Datei im `frontend` Ordner:

```env
NEXT_PUBLIC_API_URL=http://localhost:10000
```

### 2. Dependencies installieren

```bash
cd frontend
npm install
```

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Das Frontend läuft dann auf [http://localhost:3000](http://localhost:3000)

## Features

### Dashboard (`/`)

- Bot-Status Anzeige (läuft/gestoppt)
- Offene Positionen mit PnL
- Letzte Trades
- Auto-Refresh alle 5 Sekunden

### Trades (`/trades`)

- Detaillierte Liste aller Trades
- Offene Positionen mit aktuellen Preisen
- PnL-Berechnung pro Trade
- Auto-Refresh alle 5 Sekunden

### Strategien (`/strategies`)

- Liste aller Strategien
- Aktivieren/Deaktivieren per Toggle
- Bearbeiten von Strategie-Parametern:
  - MA Short/Long Perioden
  - Trade Size (USDT)
  - Signal Threshold (%)
  - Signal Cooldown (ms)
  - Trade Cooldown (ms)
  - Stop-Loss (%)
  - Take-Profit (%)
- Performance-Metriken pro Strategie:
  - Total Trades
  - Win Rate
  - Total PnL

## API-Integration

Das Frontend kommuniziert mit dem Backend über folgende Endpunkte:

- `GET /api/status` - Bot-Status
- `GET /api/trades` - Trades abrufen
- `GET /api/positions` - Offene Positionen
- `GET /api/strategies` - Strategien abrufen
- `PUT /api/strategies/:id` - Strategie aktualisieren
- `PATCH /api/strategies/:id/toggle` - Strategie aktivieren/deaktivieren

## Deployment auf Vercel

Siehe `frontend/DEPLOYMENT.md` für detaillierte Anleitung.

### Kurzfassung:

1. GitHub Repository erstellen
2. Code pushen
3. Vercel Projekt erstellen und Repository importieren
4. Umgebungsvariable `NEXT_PUBLIC_API_URL` setzen
5. Deploy!

## Wichtige Hinweise

- Das Frontend aktualisiert sich automatisch alle 5 Sekunden
- Alle Änderungen an Strategien werden sofort im Backend gespeichert
- CORS ist bereits im Backend für Vercel-URLs konfiguriert
- Das Frontend ist vollständig responsive (Mobile-freundlich)

## Nächste Schritte

Mögliche Erweiterungen:
- Charts für Preis-Verlauf
- Performance-Visualisierungen
- Backtesting-UI
- WebSocket für Live-Updates (statt Polling)
- Dark Mode
- Export-Funktionen (CSV, PDF)

