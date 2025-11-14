# Binance API Keys Setup

## ⚠️ Warnung: "BINANCE API Keys nicht gesetzt - Trading deaktiviert"

Diese Warnung bedeutet, dass die Binance API Keys nicht konfiguriert sind. Hier ist die Lösung:

## Schritt 1: Binance Testnet API Keys erstellen

1. Gehe zu [Binance Testnet](https://testnet.binance.vision/)
2. Klicke auf **"Generate HMAC_SHA256 Key"** oder **"API Management"**
3. Erstelle einen neuen API Key:
   - **API Key Name:** z.B. "Trading Bot Testnet"
   - **Permissions:** Wähle "Enable Reading" und "Enable Spot & Margin Trading"
4. Kopiere die **API Key** und **Secret Key** (Secret wird nur einmal angezeigt!)

## Schritt 2: Lokale Entwicklung (.env Datei)

Erstelle eine `.env` Datei im **Root-Verzeichnis** des Projekts:

```env
# Supabase Configuration
SUPABASE_SERVICE_KEY=dein_supabase_service_key_hier

# Binance Testnet API Keys
BINANCE_API_KEY=dein_binance_testnet_api_key_hier
BINANCE_API_SECRET=dein_binance_testnet_secret_hier

# Trading Configuration
TRADING_ENABLED=true    # Setze auf 'true' um Trading zu aktivieren
PORT=10000
```

**Wichtig:** 
- Die `.env` Datei sollte im **Root** sein (nicht im `frontend` Ordner!)
- Füge `.env` zu `.gitignore` hinzu (wird nicht zu GitHub gepusht!)

## Schritt 3: Render (Production) - Umgebungsvariablen setzen

1. Gehe zu [Render Dashboard](https://dashboard.render.com/)
2. Wähle deinen Service (Backend)
3. Gehe zu **Environment** → **Environment Variables**
4. Füge folgende Variablen hinzu:

```
BINANCE_API_KEY = dein_binance_testnet_api_key_hier
BINANCE_API_SECRET = dein_binance_testnet_secret_hier
TRADING_ENABLED = true
SUPABASE_SERVICE_KEY = dein_supabase_service_key_hier
```

5. Klicke auf **Save Changes**
6. Render wird automatisch neu deployen

## Schritt 4: Verifizierung

Nach dem Setzen der Umgebungsvariablen solltest du sehen:

```
✅ Binance Testnet Client initialisiert
```

Statt der Warnung.

## Sicherheitshinweise

⚠️ **WICHTIG:**
- **NIEMALS** API Keys zu GitHub pushen!
- Verwende nur **Testnet Keys** für Entwicklung
- Die `.env` Datei sollte in `.gitignore` sein
- Für Production: Verwende echte Keys nur mit Vorsicht!

## Troubleshooting

### Keys werden nicht erkannt
- Prüfe, ob die `.env` Datei im Root-Verzeichnis ist
- Stelle sicher, dass keine Leerzeichen in den Werten sind
- Starte den Server neu: `npm start`

### Trading funktioniert nicht
- Prüfe `TRADING_ENABLED=true` (nicht `'true'` oder `"true"`)
- Prüfe die Binance Testnet API Key Permissions
- Prüfe die Render-Logs für Fehler

## Testnet vs. Mainnet

**Testnet (Empfohlen für Entwicklung):**
- URL: `https://testnet.binance.vision/`
- Kostenlos, kein echtes Geld
- Perfekt zum Testen

**Mainnet (Nur für Production mit Vorsicht!):**
- URL: `https://api.binance.com`
- Echtes Geld, echte Trades
- Nur verwenden wenn du weißt, was du tust!

## Nächste Schritte

1. ✅ Binance Testnet API Keys erstellen
2. ✅ `.env` Datei lokal erstellen
3. ✅ Umgebungsvariablen auf Render setzen
4. ✅ Server neu starten
5. ✅ Prüfen, ob Warnung verschwunden ist

