# Vercel versucht server.js auszuführen - Fix

## Problem

Vercel versucht `server.js` (Backend) auszuführen, obwohl nur das Frontend (Next.js) deployed werden soll.

## Ursache

Vercel deployed das gesamte Repository und findet `server.js` im Root-Verzeichnis. Es versucht dann, diese Datei als Serverless Function auszuführen.

## Lösung

### Schritt 1: .vercelignore erstellen

Ich habe eine `.vercelignore` Datei im Root erstellt, die `server.js` ignoriert.

### Schritt 2: Vercel Root Directory setzen

**WICHTIG:** In Vercel Dashboard:

1. Gehe zu **Settings** → **General**
2. Setze **Root Directory** auf: `frontend`
3. **Save**

### Schritt 3: vercel.json anpassen

Die `vercel.json` wurde angepasst. Sie sollte jetzt so aussehen:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Wichtig:** Keine `rootDirectory` mehr in der JSON, weil das in Vercel Dashboard gesetzt wird!

### Schritt 4: Prüfe, dass kein server.js im Frontend ist

Stelle sicher, dass:
- ❌ Keine `server.js` im `frontend` Ordner ist
- ✅ Nur Next.js Dateien im `frontend` Ordner sind

### Schritt 5: Neu deployen

1. Push die Änderungen zu GitHub
2. Vercel wird automatisch neu deployen
3. Oder: Manuell **Redeploy** in Vercel

## Verifizierung

Nach dem Fix sollten die Vercel Logs zeigen:

```
✓ Compiled successfully
✓ Generating static pages
Route (app)
┌ ○ /
├ ○ /trades
└ ○ /strategies
```

**NICHT mehr:**
```
⚠️ WARNUNG: SUPABASE_SERVICE_KEY...
Error: supabaseKey is required
```

## Alternative: Separates Repository

Falls das Problem weiterhin besteht:

1. Erstelle ein **neues GitHub Repository** nur für das Frontend
2. Kopiere den **Inhalt** des `frontend` Ordners (nicht den Ordner selbst!)
3. Deploye das neue Repository auf Vercel
4. Keine `server.js` mehr = kein Problem!

## Wichtig

- **Frontend (Vercel):** Nur Next.js, keine `server.js`
- **Backend (Render):** `server.js` läuft hier
- **Kommunikation:** Frontend → HTTP → Backend

