# Vercel Build Command Fix

## Problem

Wenn die **Root Directory** auf `frontend` gesetzt ist, ist Vercel bereits im `frontend` Ordner!

Der Fehler:
```
npm error path /vercel/path0/frontend/package.json
```

Bedeutet: Vercel versucht `/vercel/path0/frontend/frontend/package.json` zu finden (doppelt!)

## Lösung

### vercel.json korrigiert

Wenn Root Directory = `frontend`, dann sind die Befehle bereits im `frontend` Ordner:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

**Wichtig:** 
- ❌ Kein `cd frontend` mehr!
- ✅ Einfach `npm install` und `npm run build`
- ✅ Output Directory ist `.next` (nicht `frontend/.next`)

## Schritt-für-Schritt

### 1. Root Directory im Vercel Dashboard setzen

1. Vercel Dashboard → Projekt → **Settings** → **General**
2. **Root Directory:** Setze auf `frontend`
3. **Save**

### 2. vercel.json anpassen

Die `vercel.json` wurde korrigiert - keine `cd frontend` Befehle mehr!

### 3. Neu deployen

- Push die Änderungen zu GitHub
- Oder: **Redeploy** in Vercel

## Warum?

- **Ohne Root Directory:** Vercel startet im Root → `cd frontend && npm install`
- **Mit Root Directory = `frontend`:** Vercel startet bereits im `frontend` → `npm install`

## Verifizierung

Nach dem Fix sollten die Logs zeigen:

```
Running "install" command: `npm install`...
✓ Installed dependencies
Running "build" command: `npm run build`...
✓ Compiled successfully
```

**NICHT mehr:**
```
npm error path /vercel/path0/frontend/package.json
```

