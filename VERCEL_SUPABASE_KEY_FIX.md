# Vercel SUPABASE_SERVICE_KEY Fehler - Lösung

## ⚠️ Problem

Vercel zeigt den Fehler:
```
⚠️ WARNUNG: SUPABASE_SERVICE_KEY Umgebungsvariable ist nicht gesetzt!
Error: supabaseKey is required.
```

## 🔍 Ursache

**Vercel versucht das Backend (`server.js`) auszuführen!**

Das ist falsch, weil:
- ✅ **Vercel** sollte nur das **Frontend** (Next.js) deployen
- ✅ **Render** sollte das **Backend** (`server.js`) deployen
- ❌ Das **Frontend** braucht **KEINEN** `SUPABASE_SERVICE_KEY`!

## ✅ Lösung

### Schritt 1: Prüfe Vercel Root Directory

1. Gehe zu [Vercel Dashboard](https://vercel.com)
2. Wähle dein Projekt
3. **Settings** → **General**
4. Prüfe **Root Directory**: Sollte `frontend` sein!
5. Falls nicht: Setze es auf `frontend` und speichere

### Schritt 2: Prüfe Framework Detection

1. In Vercel → **Settings** → **General**
2. Prüfe **Framework Preset**: Sollte **Next.js** sein!
3. Falls nicht: Wähle **Next.js** manuell

### Schritt 3: Entferne SUPABASE_SERVICE_KEY aus Vercel

Das Frontend braucht diese Variable **NICHT**!

1. Gehe zu **Settings** → **Environment Variables**
2. Falls `SUPABASE_SERVICE_KEY` existiert: **Lösche sie**
3. Das Frontend braucht nur:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   ```

### Schritt 4: Prüfe vercel.json

Die `vercel.json` im Root sollte so aussehen:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next",
  "installCommand": "cd frontend && npm install",
  "framework": "nextjs",
  "rootDirectory": "frontend"
}
```

### Schritt 5: Prüfe, dass kein server.js im Frontend ist

Stelle sicher, dass:
- ❌ Keine `server.js` im `frontend` Ordner ist
- ✅ Nur Next.js Dateien im `frontend` Ordner sind
- ✅ `frontend/package.json` hat `"next"` als Dependency

### Schritt 6: Neu deployen

1. Lösche alle Environment Variables außer `NEXT_PUBLIC_API_URL`
2. Setze Root Directory auf `frontend`
3. Redeploy das Projekt
4. Prüfe die Logs - sollte jetzt Next.js sein, nicht Node.js!

## 📋 Was gehört wo?

### Vercel (Frontend):
```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Render (Backend):
```
SUPABASE_SERVICE_KEY=dein_supabase_key
BINANCE_API_KEY=dein_binance_key
BINANCE_API_SECRET=dein_binance_secret
TRADING_ENABLED=true
```

## ✅ Nach dem Fix

Vercel sollte jetzt:
- ✅ Next.js Framework erkennen
- ✅ Nur das Frontend deployen
- ✅ Keine `server.js` Fehler mehr zeigen
- ✅ Die Frontend-Seite korrekt anzeigen

## 🔍 Verifizierung

Nach dem Fix sollten die Vercel Logs zeigen:
```
✓ Compiled successfully
✓ Generating static pages
```

Statt:
```
⚠️ WARNUNG: SUPABASE_SERVICE_KEY...
Error: supabaseKey is required
```

## Wichtig

**Das Frontend kommuniziert mit dem Backend über HTTP!**
- Frontend (Vercel) → API Call → Backend (Render)
- Das Frontend braucht **KEINE** direkte Supabase-Verbindung!
- Nur das Backend braucht `SUPABASE_SERVICE_KEY`!

