# Vercel Build Error - package.json nicht gefunden

## Problem

```
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/vercel/path0/package.json'
```

Vercel versucht `npm install` im Root-Verzeichnis auszuführen, aber die `package.json` ist im `frontend` Ordner.

## Lösung

### Schritt 1: vercel.json korrigiert

Die `vercel.json` wurde korrigiert, damit Vercel im `frontend` Ordner arbeitet:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next",
  "installCommand": "cd frontend && npm install",
  "framework": "nextjs",
  "rootDirectory": "frontend"
}
```

### Schritt 2: Root Directory in Vercel Dashboard setzen

**WICHTIG:** Auch wenn `rootDirectory` in der JSON steht, setze es auch im Dashboard:

1. Gehe zu [Vercel Dashboard](https://vercel.com)
2. Wähle dein Projekt
3. **Settings** → **General**
4. Scrolle zu **Root Directory**
5. Setze: `frontend`
6. **Save**

### Schritt 3: Neu deployen

1. Push die Änderungen zu GitHub
2. Vercel wird automatisch neu deployen
3. Oder: **Redeploy** manuell in Vercel

## Verifizierung

Nach dem Fix sollten die Build-Logs zeigen:

```
Running "install" command: `cd frontend && npm install`...
✓ Installed dependencies
Running "build" command: `cd frontend && npm run build`...
✓ Compiled successfully
```

## Alternative: Separates Repository (Empfohlen)

Falls das Problem weiterhin besteht, ist die beste Lösung:

1. **Neues GitHub Repository** erstellen (z.B. `crypto-trading-frontend`)
2. **Nur den Inhalt** des `frontend` Ordners kopieren:
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/DEIN-USERNAME/crypto-trading-frontend.git
   git push -u origin main
   ```
3. **Vercel:** Neues Projekt erstellen → Repository importieren
4. **Keine Root Directory** nötig, da alles im Root ist!

## Warum separates Repository?

- ✅ Keine Verwirrung zwischen Frontend und Backend
- ✅ Saubere Trennung
- ✅ Einfacheres Deployment
- ✅ Keine Probleme mit Root Directory

