# 🚀 Frontend Deployment Guide für Vercel

## 📋 Voraussetzungen

- Vercel Account (kostenlos)
- GitHub Account
- Backend läuft auf Render

## 🔧 Umgebungsvariablen

Erstelle eine `.env.local` Datei:

```env
# Backend API URL (Render)
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com

# WebSocket URL
NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com

# Supabase (Public/Anon Key für Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 📦 Deployment Schritte

### 1. GitHub Repository erstellen

```bash
# Im frontend Ordner
git init
git add .
git commit -m "Initial frontend commit"
git remote add origin https://github.com/YourUsername/crypto-trading-frontend.git
git push -u origin main
```

### 2. Vercel Deployment

1. Gehe zu [vercel.com](https://vercel.com)
2. Klicke "New Project"
3. Import dein GitHub Repository
4. Framework Preset: **Next.js**
5. Root Directory: **./** (oder `frontend` wenn im Mono-Repo)
6. Build Command: `npm run build`
7. Output Directory: `.next`

### 3. Environment Variables in Vercel

Im Vercel Dashboard:
1. Settings → Environment Variables
2. Füge alle Variablen aus `.env.local` hinzu
3. Wähle "Production", "Preview" und "Development"

### 4. CORS im Backend anpassen

In `server.js`:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://your-app.vercel.app',
    /https:\/\/.*\.vercel\.app$/ // Alle Vercel Preview URLs
  ]
};
```

## 🔍 Wichtige Features

### Live Updates
- WebSocket-Verbindung für Echtzeit-Preise
- Trade-Benachrichtigungen
- Performance-Updates

### Dashboard Features
- Bot Status Control
- Live Preise mit Sparklines
- Performance Charts (Recharts)
- Risk Management Metriken
- Trade Historie
- Backtesting Interface

### Responsive Design
- Mobile optimiert
- Dark/Light Mode (coming soon)
- Touch-freundliche Interfaces

## 🛠️ Entwicklung

### Lokale Entwicklung

```bash
npm run dev
# Öffne http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

## 📊 Performance Optimierungen

1. **Image Optimization**: Next.js Image Component
2. **Code Splitting**: Automatisch durch Next.js
3. **API Caching**: SWR für effizientes Daten-Fetching
4. **Bundle Size**: Analysiere mit `npm run analyze`

## 🐛 Troubleshooting

### WebSocket verbindet nicht
- Prüfe CORS-Einstellungen im Backend
- Stelle sicher, dass WSS URL korrekt ist
- Check Render Logs für WebSocket Errors

### API Calls schlagen fehl
- Verifiziere API URL in Environment Variables
- Prüfe CORS im Backend
- Check Network Tab für Details

### Build Fehler auf Vercel
- Prüfe Node Version (18.x empfohlen)
- Clear Build Cache in Vercel
- Check Build Logs für spezifische Fehler

## 📝 Nächste Schritte

1. **Monitoring**: Sentry.io Integration
2. **Analytics**: Google Analytics / Plausible
3. **PWA**: Progressive Web App Features
4. **i18n**: Mehrsprachigkeit
5. **Testing**: Jest + React Testing Library

## 🔐 Sicherheit

- Verwende nur Public Keys im Frontend
- Keine sensiblen Daten im Client speichern
- HTTPS für alle Verbindungen
- Rate Limiting für API Calls

## 📞 Support

Bei Problemen:
1. Check Vercel Status Page
2. Render Dashboard für Backend Logs
3. Browser Console für Frontend Errors
4. Network Tab für API Issues
