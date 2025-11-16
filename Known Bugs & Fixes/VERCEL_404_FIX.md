# Vercel 404 Error - "Cannot GET /" Fix

## Problem
Vercel zeigt "Cannot GET /" - Die Next.js Routen werden nicht gefunden.

## Ursache
Vercel weiß nicht, dass das Frontend im `frontend` Unterordner liegt.

## Lösung

### Schritt 1: Root Directory in Vercel setzen

1. Gehe zu [vercel.com](https://vercel.com) → Dein Projekt
2. **Settings** → **General**
3. Scrolle zu **Root Directory**
4. Setze: `frontend`
5. **Save**

### Schritt 2: Neu deployen

1. Push einen neuen Commit zu GitHub (oder triggere manuell)
2. Vercel wird automatisch neu deployen
3. Prüfe die Build-Logs

### Schritt 3: Prüfen

Nach dem Deployment sollte:
- `https://your-app.vercel.app/` → Dashboard anzeigen
- `https://your-app.vercel.app/trades` → Trades anzeigen
- `https://your-app.vercel.app/strategies` → Strategien anzeigen

## Alternative: Separates Repository

Wenn das nicht funktioniert:

1. Erstelle ein neues GitHub Repository nur für das Frontend
2. Kopiere den `frontend` Ordner-Inhalt in das neue Repository
3. Deploye das neue Repository auf Vercel (ohne Root Directory!)

## Troubleshooting

### Build-Logs prüfen
- Gehe zu Vercel → Deployments → Klicke auf das neueste Deployment
- Prüfe die Build-Logs auf Fehler

### Umgebungsvariablen prüfen
- Settings → Environment Variables
- Stelle sicher, dass `NEXT_PUBLIC_API_URL` gesetzt ist

### Framework Detection
- Vercel sollte automatisch Next.js erkennen
- Falls nicht: Settings → General → Framework Preset → Next.js

## Wichtig

Die `vercel.json` im Root zeigt Vercel, dass das Frontend im `frontend` Ordner ist. 
**ABER:** Die einfachste Lösung ist, die Root Directory direkt in Vercel zu setzen!

