# Client-Side Error Debugging

## Problem

```
Application error: a client-side exception has occurred
```

## Schritt 1: Browser Console öffnen

**Das ist der wichtigste Schritt!**

1. Öffne deine Vercel-URL im Browser
2. Drücke **F12** (oder Rechtsklick → "Untersuchen" / "Inspect")
3. Gehe zum Tab **Console** (Konsole)
4. Du siehst dort den genauen Fehler!

**Kopiere den Fehler-Text und teile ihn mit mir!**

## Schritt 2: Häufige Fehler und Lösungen

### Fehler 1: "NEXT_PUBLIC_API_URL is not defined"

**Lösung:**
1. Vercel Dashboard → Projekt → **Settings** → **Environment Variables**
2. Füge hinzu:
   ```
   Key: NEXT_PUBLIC_API_URL
   Value: https://your-backend.onrender.com
   ```
3. Stelle sicher, dass es für **Production** gesetzt ist
4. **Save** → **Redeploy**

### Fehler 2: "Network Error" oder "Failed to fetch"

**Ursache:** Backend nicht erreichbar oder CORS-Fehler

**Lösung:**
1. Prüfe, ob Backend läuft: `https://your-backend.onrender.com/api/status`
2. Prüfe CORS im Backend (`server.js`)
3. Stelle sicher, dass deine Vercel-URL in CORS erlaubt ist

### Fehler 3: "Cannot read property 'X' of undefined"

**Ursache:** API gibt unerwartete Daten zurück

**Lösung:** Error Handling ist bereits implementiert, aber prüfe die API-Response

## Schritt 3: Umgebungsvariablen prüfen

### In Vercel Dashboard:

1. **Settings** → **Environment Variables**
2. Prüfe, ob `NEXT_PUBLIC_API_URL` existiert
3. Falls nicht: Füge sie hinzu
4. Falls ja: Prüfe den Wert (korrekte Backend-URL?)

### Wichtig:

- `NEXT_PUBLIC_*` Variablen sind für das Frontend
- Sie müssen für **Production** gesetzt sein
- Nach dem Setzen: **Redeploy** nötig!

## Schritt 4: Backend erreichbar?

Teste dein Backend direkt:

```
https://your-backend.onrender.com/api/status
```

Sollte zurückgeben:
```json
{
  "status": "running" oder "stopped",
  "timestamp": "..."
}
```

Falls Fehler: Backend-Problem, nicht Frontend!

## Schritt 5: Error Boundary

Ich habe einen Error Boundary hinzugefügt (`frontend/app/error.tsx`), der bessere Fehlermeldungen zeigt.

## Nächste Schritte

1. ✅ **Browser Console öffnen (F12)**
2. ✅ **Fehler-Text kopieren**
3. ✅ **Umgebungsvariablen prüfen**
4. ✅ **Backend-URL testen**
5. ✅ **Fehler beheben basierend auf Console-Output**

## Wichtig

**Der Browser Console zeigt dir den genauen Fehler!** Das ist der wichtigste Schritt zum Debugging.

**Bitte teile mir den Fehler-Text aus der Browser Console mit!**

