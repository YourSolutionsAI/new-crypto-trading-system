# Crypto Trading Bot Frontend

Minimales Frontend für die Überwachung und Verwaltung des Trading-Bots.

## Features

- ✅ **Trade-Überwachung**: Aktuelle Trades und offene Positionen anzeigen
- ✅ **Strategien-Verwaltung**: Strategien aktivieren/deaktivieren und konfigurieren
- ✅ **Dashboard**: Übersicht über Bot-Status und Performance

## Installation

```bash
npm install
```

## Konfiguration

1. Kopiere `.env.local.example` zu `.env.local`
2. Setze die `NEXT_PUBLIC_API_URL` auf deine Backend-URL (z.B. Render URL)

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

## Entwicklung

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.

## Deployment auf Vercel

1. Erstelle ein GitHub Repository
2. Gehe zu [vercel.com](https://vercel.com)
3. Importiere das Repository
4. Füge die Umgebungsvariable `NEXT_PUBLIC_API_URL` hinzu
5. Deploy!

## Seiten

- `/` - Dashboard mit Bot-Status und Übersicht
- `/trades` - Alle Trades und offene Positionen
- `/strategies` - Strategien verwalten und konfigurieren
