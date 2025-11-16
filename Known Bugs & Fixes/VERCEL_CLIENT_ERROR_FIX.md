# Vercel Client-Side Error Fix

## Problem

```
Application error: a client-side exception has occurred
```

Der Build war erfolgreich, aber die Anwendung wirft einen Fehler beim Laden.

## Häufige Ursachen

### 1. Fehlende Umgebungsvariable `NEXT_PUBLIC_API_URL`

**Symptom:** API-Calls schlagen fehl, weil die Backend-URL nicht gesetzt ist.

**Lösung:**
1. Vercel Dashboard → Projekt → **Settings** → **Environment Variables**
2. Füge hinzu:
   ```
   Key: NEXT_PUBLIC_API_URL
   Value: https://your-backend.onrender.com
   ```
3. Stelle sicher, dass es für **Production**, **Preview** UND **Development** gesetzt ist
4. **Save** → **Redeploy**

### 2. Browser Console prüfen

Der Fehler zeigt "see the browser console" - das ist der Schlüssel!

**So findest du den Fehler:**

1. Öffne deine Vercel-URL im Browser
2. Drücke **F12** (oder Rechtsklick → "Untersuchen")
3. Gehe zum Tab **Console**
4. Du siehst den genauen Fehler dort!

**Häufige Fehler:**

- `Cannot read property 'X' of undefined`
- `API_URL is not defined`
- `Network Error` oder `CORS Error`
- `Failed to fetch`

### 3. API-Verbindungsfehler

**Symptom:** Frontend kann nicht mit Backend kommunizieren.

**Prüfen:**
1. Ist das Backend auf Render erreichbar?
2. Teste: `https://your-backend.onrender.com/api/status` im Browser
3. Prüfe CORS-Einstellungen im Backend

### 4. JavaScript-Fehler im Code

**Mögliche Ursachen:**
- Undefined-Variablen
- Fehlende Imports
- TypeScript-Fehler die zur Laufzeit auftreten

## Schritt-für-Schritt Debugging

### Schritt 1: Browser Console öffnen

1. Öffne deine Vercel-URL
2. **F12** drücken
3. Tab **Console** öffnen
4. Kopiere den Fehler-Text

### Schritt 2: Umgebungsvariablen prüfen

1. Vercel Dashboard → **Settings** → **Environment Variables**
2. Prüfe, ob `NEXT_PUBLIC_API_URL` existiert
3. Falls nicht: Füge sie hinzu
4. Falls ja: Prüfe den Wert (korrekte URL?)

### Schritt 3: Backend erreichbar?

1. Öffne: `https://your-backend.onrender.com/api/status`
2. Sollte JSON zurückgeben: `{"status":"...","timestamp":"..."}`
3. Falls Fehler: Backend-Problem, nicht Frontend!

### Schritt 4: Error Boundary hinzufügen

Falls der Fehler weiterhin auftritt, können wir einen Error Boundary hinzufügen, um bessere Fehlermeldungen zu bekommen.

## Häufige Lösungen

### Lösung 1: NEXT_PUBLIC_API_URL fehlt

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Lösung 2: CORS-Fehler

Im Backend (`server.js`) CORS erlauben:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://your-app.vercel.app',
    /\.vercel\.app$/
  ]
};
```

### Lösung 3: API-Timeout

Falls API zu langsam antwortet, Timeout erhöhen in `frontend/lib/api.ts`.

## Nächste Schritte

1. ✅ Browser Console öffnen (F12)
2. ✅ Fehler-Text kopieren
3. ✅ Umgebungsvariablen prüfen
4. ✅ Backend-URL testen
5. ✅ Fehler beheben basierend auf Console-Output

## Wichtig

**Der Browser Console zeigt dir den genauen Fehler!** Das ist der wichtigste Schritt zum Debugging.

