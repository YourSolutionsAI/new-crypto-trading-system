# Vercel 404 Error Fix

## Problem
"Cannot GET /" Fehler auf Vercel - Die Routen werden nicht gefunden.

## Lösung

### Option 1: Root Directory in Vercel Dashboard setzen

1. Gehe zu deinem Vercel Projekt
2. Settings → General → Root Directory
3. Setze `frontend` als Root Directory
4. Speichern und neu deployen

### Option 2: Frontend als separates Repository deployen

1. Erstelle ein neues GitHub Repository nur für das Frontend
2. Kopiere den `frontend` Ordner in das neue Repository
3. Deploye das neue Repository auf Vercel

### Option 3: vercel.json im Root erstellen

Wenn das gesamte Projekt (Backend + Frontend) in einem Repository ist:

1. Erstelle `vercel.json` im **Root** des Projekts (nicht im frontend Ordner):

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next",
  "installCommand": "cd frontend && npm install",
  "framework": "nextjs",
  "rootDirectory": "frontend"
}
```

2. In Vercel Dashboard → Settings → General → Root Directory: Setze `frontend`

### Option 4: Frontend-Struktur prüfen

Stelle sicher, dass:
- `frontend/app/page.tsx` existiert (Hauptroute)
- `frontend/package.json` korrekt ist
- `frontend/next.config.ts` existiert

## Empfohlene Lösung

**Am einfachsten:** Option 1 - Root Directory in Vercel Dashboard auf `frontend` setzen.

## Nach dem Fix

1. Push zu GitHub
2. Vercel wird automatisch neu deployen
3. Prüfe die Deployment-Logs in Vercel
4. Die Seite sollte jetzt unter `https://your-app.vercel.app` funktionieren

