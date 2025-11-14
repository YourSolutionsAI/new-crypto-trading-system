# Vercel Umgebungsvariablen Fix - SUPABASE_SERVICE_KEY

## Problem
Die Umgebungsvariable `SUPABASE_SERVICE_KEY` ist gesetzt, aber Vercel zeigt immer noch den Fehler.

## Mögliche Ursachen

### 1. Variable nur für Preview/Development gesetzt
Vercel hat verschiedene Umgebungen:
- **Production** (live)
- **Preview** (für Pull Requests)
- **Development** (lokal)

**Lösung:** Stelle sicher, dass die Variable für **ALLE Umgebungen** gesetzt ist!

### 2. Variable-Name falsch geschrieben
Prüfe auf Tippfehler:
- ✅ Richtig: `SUPABASE_SERVICE_KEY`
- ❌ Falsch: `SUPABASE_SERVICE_KEY_` (mit Leerzeichen am Ende)
- ❌ Falsch: `SUPABASE_SERVICE_KEY ` (mit Leerzeichen)
- ❌ Falsch: `supabase_service_key` (kleingeschrieben)

### 3. Variable-Wert hat Leerzeichen
Der Wert sollte **KEINE** Leerzeichen am Anfang oder Ende haben!

### 4. Vercel muss neu deployen
Nach dem Setzen der Variable muss Vercel neu deployen.

## Schritt-für-Schritt Lösung

### Schritt 1: Vercel Dashboard öffnen
1. Gehe zu [vercel.com](https://vercel.com)
2. Wähle dein Projekt: **new-crypto-trading-system**
3. Klicke auf **Settings** (oben rechts)

### Schritt 2: Environment Variables prüfen
1. Klicke links auf **Environment Variables**
2. Suche nach `SUPABASE_SERVICE_KEY`

### Schritt 3: Variable für alle Umgebungen setzen
1. Falls die Variable existiert:
   - Klicke auf die Variable
   - Prüfe, welche Umgebungen angehakt sind
   - Stelle sicher, dass **Production**, **Preview** UND **Development** angehakt sind
   - Klicke **Save**

2. Falls die Variable NICHT existiert:
   - Klicke **Add New**
   - **Key:** `SUPABASE_SERVICE_KEY`
   - **Value:** Dein Supabase Service Role Key (aus Supabase Dashboard)
   - **Environment:** Wähle **Production**, **Preview** UND **Development**
   - Klicke **Save**

### Schritt 4: Supabase Service Role Key finden
1. Gehe zu [Supabase Dashboard](https://supabase.com/dashboard)
2. Wähle dein Projekt
3. Gehe zu **Settings** → **API**
4. Scrolle zu **Project API keys**
5. Kopiere den **service_role** Key (NICHT der anon key!)
   - Der service_role Key beginnt mit `eyJ...`
   - Er ist sehr lang (~200 Zeichen)

### Schritt 5: Variable-Wert prüfen
- ✅ Der Wert sollte mit `eyJ` beginnen
- ✅ Keine Leerzeichen am Anfang oder Ende
- ✅ Der komplette Key kopiert (sehr lang!)

### Schritt 6: Neu deployen
1. Gehe zu **Deployments**
2. Klicke auf das neueste Deployment
3. Klicke **Redeploy** → **Use existing Build Cache** (optional)
4. Oder: Push einen neuen Commit zu GitHub

### Schritt 7: Logs prüfen
Nach dem Deployment:
1. Gehe zu **Logs**
2. Prüfe, ob der Fehler verschwunden ist
3. Du solltest sehen: `✅ Supabase Client initialisiert` (oder ähnlich)

## Troubleshooting

### Problem: Variable existiert, aber Fehler bleibt
**Lösung:**
1. Lösche die Variable komplett
2. Erstelle sie neu
3. Stelle sicher, dass sie für **ALLE** Umgebungen gesetzt ist
4. Redeploy

### Problem: "Invalid API key"
**Lösung:**
- Du hast möglicherweise den **anon key** statt dem **service_role key** verwendet
- Verwende den **service_role** Key aus Supabase Settings → API

### Problem: Variable wird nicht erkannt
**Lösung:**
1. Prüfe den Variablennamen (exakt: `SUPABASE_SERVICE_KEY`)
2. Prüfe, ob Leerzeichen im Namen oder Wert sind
3. Stelle sicher, dass die Variable für die richtige Umgebung gesetzt ist
4. Redeploy nach dem Ändern

## Alle benötigten Umgebungsvariablen für Vercel

Für das Frontend benötigst du:

```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

**WICHTIG:** Das Frontend braucht NICHT den SUPABASE_SERVICE_KEY!
Der SUPABASE_SERVICE_KEY wird nur im Backend (auf Render) benötigt!

## Prüfen ob es funktioniert

Nach dem Setzen und Redeploy solltest du in den Logs sehen:

```
✅ Supabase Client initialisiert
```

Statt:
```
⚠️ WARNUNG: SUPABASE_SERVICE_KEY Umgebungsvariable ist nicht gesetzt!
```

## Wichtig

- **Frontend (Vercel):** Braucht nur `NEXT_PUBLIC_API_URL`
- **Backend (Render):** Braucht `SUPABASE_SERVICE_KEY`, `BINANCE_API_KEY`, etc.

Wenn du den Fehler auf Vercel siehst, bedeutet das, dass Vercel versucht, das Backend (`server.js`) auszuführen, was nicht sein sollte!

## Mögliches Problem: Vercel versucht Backend auszuführen

Wenn Vercel `server.js` ausführt, bedeutet das:
- Vercel denkt, dass es ein Node.js Backend deployen soll
- Das Frontend sollte nur Next.js sein!

**Lösung:** Stelle sicher, dass:
1. Die Root Directory auf `frontend` gesetzt ist
2. Vercel Next.js erkennt (nicht Node.js)
3. Es gibt keine `server.js` im Frontend-Ordner

