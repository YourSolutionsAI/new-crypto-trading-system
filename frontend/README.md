# Crypto Trading Bot - Frontend Dashboard

Next.js-basiertes Frontend-Dashboard für den automatisierten Crypto Trading Bot.

## 🚀 Features

- ✅ Bot-Status-Anzeige und Steuerung (Start/Stop)
- ✅ Live-Preis-Updates (Realtime)
- ✅ Aktive Strategien-Übersicht
- ✅ Strategie-Performance-Tabelle
- ✅ Responsive Design mit Dark Mode
- ✅ Real-time Updates über Supabase Realtime

## 📋 Voraussetzungen

- Node.js 18+ 
- npm oder yarn
- Supabase Account (für Realtime-Updates)
- Backend läuft auf Render oder lokal

## 🛠️ Installation

1. **Dependencies installieren:**
```bash
npm install
```

2. **Umgebungsvariablen konfigurieren:**
Erstellen Sie eine `.env.local` Datei im `frontend/` Ordner:

```env
NEXT_PUBLIC_API_URL=https://your-render-app.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Entwicklungsserver starten:**
```bash
npm run dev
```

Das Dashboard ist dann unter `http://localhost:3000` erreichbar.

## 🏗️ Projektstruktur

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root Layout
│   ├── page.tsx           # Dashboard Hauptseite
│   └── globals.css        # Globale Styles
├── components/
│   ├── dashboard/         # Dashboard-Komponenten
│   │   ├── BotStatusCard.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── ActiveStrategies.tsx
│   │   └── LivePrices.tsx
│   ├── performance/       # Performance-Komponenten
│   │   └── StrategyPerformance.tsx
│   └── ui/                # UI-Komponenten
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Badge.tsx
├── lib/                   # Utilities
│   ├── api.ts            # Backend API Client
│   └── supabase.ts       # Supabase Client
├── store/                 # State Management
│   └── botStore.ts       # Zustand Store
└── types/                 # TypeScript Types
    ├── api.ts
    └── database.ts
```

## 🌐 Deployment auf Vercel

1. **Repository zu GitHub pushen** (falls noch nicht geschehen)

2. **Vercel-Projekt erstellen:**
   - Gehen Sie zu [vercel.com](https://vercel.com)
   - Klicken Sie auf "New Project"
   - Verbinden Sie Ihr GitHub-Repository
   - Wählen Sie den `frontend/` Ordner als Root Directory

3. **Environment Variables setzen:**
   - `NEXT_PUBLIC_API_URL` → Ihre Render-Backend-URL
   - `NEXT_PUBLIC_SUPABASE_URL` → Ihre Supabase-URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Ihr Supabase Anon Key

4. **Deploy:**
   - Vercel deployt automatisch bei jedem Push
   - Die Vercel-URL wird automatisch im Backend-CORS akzeptiert (Regex-Pattern)

## 🔧 Entwicklung

### Verfügbare Scripts

- `npm run dev` - Startet Entwicklungsserver
- `npm run build` - Erstellt Production-Build
- `npm run start` - Startet Production-Server
- `npm run lint` - Führt ESLint aus

### API-Integration

Das Frontend kommuniziert mit dem Backend über die `apiClient` Klasse in `lib/api.ts`:

```typescript
import { apiClient } from '@/lib/api';

// Bot starten
await apiClient.startBot();

// Status abrufen
const status = await apiClient.getStatus();

// Performance abrufen
const performance = await apiClient.getStrategyPerformance();
```

### Realtime-Updates

Realtime-Updates werden über Supabase Realtime abonniert:

```typescript
import { supabase } from '@/lib/supabase';

const channel = supabase
  .channel('live-prices')
  .on('postgres_changes', { ... }, (payload) => {
    // Handle update
  })
  .subscribe();
```

## 📝 Nächste Schritte

- [ ] Trade-Historie-Komponente
- [ ] Backtesting-UI
- [ ] Strategie-Konfiguration-Interface
- [ ] Charts für Preis-Visualisierung
- [ ] PnL-Charts
- [ ] Benachrichtigungen

## 🐛 Troubleshooting

**Problem: CORS-Fehler**
- Stellen Sie sicher, dass die Backend-CORS-Einstellungen korrekt sind
- Die Vercel-URL sollte automatisch akzeptiert werden (Regex-Pattern)

**Problem: Keine Realtime-Updates**
- Prüfen Sie die Supabase-Umgebungsvariablen
- Stellen Sie sicher, dass Realtime in Supabase aktiviert ist
- Prüfen Sie die Browser-Konsole auf Fehler

**Problem: API-Verbindungsfehler**
- Prüfen Sie die `NEXT_PUBLIC_API_URL` Umgebungsvariable
- Stellen Sie sicher, dass das Backend läuft
- Prüfen Sie die Netzwerk-Tab im Browser-DevTools

## 📄 Lizenz

ISC
