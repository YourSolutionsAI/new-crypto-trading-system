# Root Directory in Vercel Dashboard setzen - Schritt für Schritt

## 📋 Anleitung

### Schritt 1: Vercel Dashboard öffnen

1. Gehe zu [vercel.com](https://vercel.com)
2. Melde dich an (falls nicht bereits eingeloggt)
3. Du siehst deine Projekte-Übersicht

### Schritt 2: Projekt auswählen

1. Klicke auf dein Projekt: **new-crypto-trading-system**
   (oder wie auch immer dein Projekt heißt)

### Schritt 3: Settings öffnen

1. Oben rechts siehst du mehrere Tabs:
   - **Overview** | **Deployments** | **Analytics** | **Settings** | etc.
2. Klicke auf **Settings**

### Schritt 4: General Settings finden

1. Links siehst du ein Menü:
   - General
   - Environment Variables
   - Git
   - Domains
   - etc.
2. Klicke auf **General** (sollte bereits ausgewählt sein)

### Schritt 5: Root Directory finden

1. Scrolle nach unten in den General Settings
2. Suche nach dem Abschnitt **"Root Directory"**
   - Er befindet sich normalerweise unter:
     - **Framework Preset**
     - **Build & Development Settings**
     - **Root Directory** ← Hier!

### Schritt 6: Root Directory setzen

1. Du siehst ein Eingabefeld mit dem Label **"Root Directory"**
2. Standardmäßig steht dort wahrscheinlich: `.` oder leer
3. **Lösche** den aktuellen Wert
4. **Tippe ein:** `frontend`
5. Klicke auf **Save** (Button unten rechts)

### Schritt 7: Verifizierung

Nach dem Speichern solltest du sehen:
- ✅ **Root Directory:** `frontend`
- Eine Erfolgsmeldung (falls vorhanden)

### Schritt 8: Neu deployen

Nach dem Setzen der Root Directory:

**Option A: Automatisch**
- Push einen neuen Commit zu GitHub
- Vercel wird automatisch neu deployen

**Option B: Manuell**
1. Gehe zu **Deployments**
2. Klicke auf das neueste Deployment
3. Klicke auf **...** (drei Punkte)
4. Wähle **Redeploy**
5. Optional: Aktiviere **"Use existing Build Cache"**
6. Klicke **Redeploy**

## 🎯 Was passiert jetzt?

Nach dem Setzen der Root Directory:

1. Vercel weiß, dass das Projekt im `frontend` Ordner liegt
2. Alle Build-Befehle werden im `frontend` Ordner ausgeführt
3. Die `vercel.json` Befehle (`npm install`, `npm run build`) funktionieren jetzt
4. Keine `cd frontend` Befehle mehr nötig!

## ⚠️ Wichtig

- Die Root Directory muss **exakt** `frontend` sein (kein `/` am Anfang oder Ende!)
- Nach dem Ändern **muss** neu deployed werden
- Die Änderung gilt für **alle zukünftigen Deployments**

## 🔍 Troubleshooting

### "Root Directory" Feld nicht sichtbar?

- Stelle sicher, dass du in **Settings** → **General** bist
- Scrolle weiter nach unten
- Falls es nicht existiert: Dein Vercel-Plan könnte es nicht unterstützen (sollte aber bei allen Plänen verfügbar sein)

### Änderung wird nicht übernommen?

- Stelle sicher, dass du auf **Save** geklickt hast
- Prüfe, ob eine Erfolgsmeldung erscheint
- Versuche einen manuellen Redeploy

### Build schlägt immer noch fehl?

- Prüfe die Build-Logs in Vercel
- Stelle sicher, dass die `vercel.json` korrekt ist (kein `cd frontend` mehr!)
- Prüfe, ob `frontend/package.json` existiert

## ✅ Checkliste

- [ ] Vercel Dashboard geöffnet
- [ ] Projekt ausgewählt
- [ ] Settings → General geöffnet
- [ ] Root Directory auf `frontend` gesetzt
- [ ] Save geklickt
- [ ] Neu deployed (automatisch oder manuell)

Nach diesen Schritten sollte alles funktionieren! 🚀

