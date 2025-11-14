# Frontend Deployment Guide

## Lokale Entwicklung

### 1. Umgebungsvariablen einrichten

Erstelle eine `.env.local` Datei im `frontend` Ordner:

```env
# Backend API URL (lokal oder Render)
NEXT_PUBLIC_API_URL=http://localhost:10000

# Für Production: Deine Render URL
# NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### 2. Entwicklungsserver starten

```bash
cd frontend
npm run dev
```

Das Frontend läuft dann auf [http://localhost:3000](http://localhost:3000)

## Deployment auf Vercel

### Schritt 1: GitHub Repository erstellen

1. Erstelle ein neues Repository auf GitHub (z.B. `crypto-trading-frontend`)
2. Initialisiere Git im Frontend-Ordner:

```bash
cd frontend
git init
git add .
git commit -m "Initial commit: Frontend für Trading Bot"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/crypto-trading-frontend.git
git push -u origin main
```

### Schritt 2: Vercel Deployment

1. Gehe zu [vercel.com](https://vercel.com) und melde dich an
2. Klicke auf "Add New Project"
3. Importiere dein GitHub Repository
4. Konfiguriere das Projekt:
   - **Framework Preset:** Next.js (wird automatisch erkannt)
   - **Root Directory:** `frontend` (wenn das Frontend in einem Unterordner ist)
   - **Build Command:** `npm run build` (Standard)
   - **Output Directory:** `.next` (Standard)

### Schritt 3: Umgebungsvariablen setzen

In den Vercel Project Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

**Wichtig:** Ersetze `your-backend.onrender.com` mit deiner tatsächlichen Render URL!

### Schritt 4: Deploy

1. Klicke auf "Deploy"
2. Warte bis der Build abgeschlossen ist
3. Deine App ist jetzt live unter `https://your-app.vercel.app`

### Schritt 5: Backend CORS aktualisieren (optional)

Falls du eine spezifische Vercel-URL hast, kannst du sie im Backend (`server.js`) zur CORS-Liste hinzufügen:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://your-app.vercel.app',  // Deine spezifische URL
    /\.vercel\.app$/,               // Alle Vercel URLs (bereits vorhanden)
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
```

## Automatisches Deployment

Nach dem ersten Deployment wird Vercel automatisch bei jedem Push zu `main` neu deployen.

## Troubleshooting

### CORS-Fehler

Wenn du CORS-Fehler siehst:
1. Prüfe, ob `NEXT_PUBLIC_API_URL` korrekt gesetzt ist
2. Prüfe die CORS-Konfiguration im Backend (`server.js`)
3. Stelle sicher, dass das Backend läuft und erreichbar ist

### API-Verbindungsfehler

1. Prüfe die Backend-URL in `.env.local` oder Vercel Environment Variables
2. Teste die Backend-URL direkt im Browser: `https://your-backend.onrender.com/api/status`
3. Prüfe die Render-Logs für Backend-Fehler

### Build-Fehler

1. Prüfe die Build-Logs in Vercel
2. Stelle sicher, dass alle Dependencies installiert sind
3. Prüfe TypeScript-Fehler lokal: `npm run build`

