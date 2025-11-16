# Vercel rootDirectory Fehler - Fix

## Problem

```
The `vercel.json` schema validation failed with the following message: 
should NOT have additional property `rootDirectory`
```

## Lösung

`rootDirectory` ist **NICHT** in `vercel.json` erlaubt! Es muss im **Vercel Dashboard** gesetzt werden.

### Schritt 1: vercel.json korrigiert

Die `vercel.json` wurde korrigiert - `rootDirectory` wurde entfernt:

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next",
  "installCommand": "cd frontend && npm install",
  "framework": "nextjs"
}
```

### Schritt 2: Root Directory im Vercel Dashboard setzen

**WICHTIG:** Du musst es **manuell im Dashboard** setzen:

1. Gehe zu [Vercel Dashboard](https://vercel.com)
2. Wähle dein Projekt
3. **Settings** → **General**
4. Scrolle zu **Root Directory**
5. Setze: `frontend`
6. **Save**

### Schritt 3: Neu deployen

Nach dem Setzen im Dashboard:
- Push die korrigierte `vercel.json` zu GitHub
- Oder: **Redeploy** manuell in Vercel

## Warum?

- `rootDirectory` ist eine **Dashboard-Einstellung**, keine JSON-Property
- Die `vercel.json` definiert nur Build-Befehle
- Vercel Dashboard definiert, wo das Projekt liegt

## Verifizierung

Nach dem Fix sollte der Build funktionieren:

```
Running "install" command: `cd frontend && npm install`...
✓ Installed dependencies
Running "build" command: `cd frontend && npm run build`...
✓ Compiled successfully
```

