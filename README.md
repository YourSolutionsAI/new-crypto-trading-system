# 🤖 Crypto Trading Bot Backend

Node.js-basiertes Backend für einen automatisierten Krypto-Trading-Bot mit Supabase-Integration und Binance-Anbindung.

## 📋 Features

- ✅ Express.js REST API
- ✅ WebSocket-Verbindung zu Binance
- ✅ Supabase-Datenbankintegration
- ✅ Bot-Management (Start/Stop/Status)
- ✅ CORS-Konfiguration für Frontend
- ✅ Render-ready Deployment

## 🚀 Installation

### 1. Repository klonen
```bash
git clone https://github.com/YourSolutionsAI/new-crypto-trading-system.git
cd new-crypto-trading-system
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren
Erstellen Sie eine `.env` Datei im Root-Verzeichnis:
```env
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
PORT=10000
```

### 4. Server lokal starten
```bash
npm start
```

Der Server läuft auf: `http://localhost:10000`

## 📡 API-Endpunkte

### Status abrufen
```bash
GET /api/status
```

### Bot starten
```bash
POST /api/start-bot
```

### Bot stoppen
```bash
POST /api/stop-bot
```

## 🗄️ Supabase Setup

### Erforderliche Tabellen

#### 1. `strategies` - Trading-Strategien
```sql
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT false,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `trades` - Handelshistorie
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id UUID REFERENCES strategies(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'buy' oder 'sell'
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  total DECIMAL(20, 8) NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'executed', 'failed'
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `bot_logs` - Bot-Aktivitätsprotokolle
```sql
CREATE TABLE bot_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL, -- 'info', 'warning', 'error'
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🌐 Deployment auf Render

### 1. Render-Account erstellen
- Gehen Sie zu [render.com](https://render.com)
- Erstellen Sie einen Account oder melden Sie sich an

### 2. Neuen Web Service erstellen
1. Klicken Sie auf "New +" → "Web Service"
2. Verbinden Sie Ihr GitHub-Repository
3. Konfigurieren Sie den Service:
   - **Name**: `crypto-trading-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (oder höher)

### 3. Umgebungsvariablen setzen
Fügen Sie im Render-Dashboard unter "Environment" hinzu:
```
SUPABASE_SERVICE_KEY=ihr_supabase_service_role_key
```

### 4. Deploy ausführen
- Klicken Sie auf "Create Web Service"
- Render wird automatisch deployen

## 🔗 Vercel (für zukünftiges Frontend)

Vercel wird später für das Frontend verwendet. Das Backend läuft auf Render.

## 📝 Nächste Schritte

1. ✅ Supabase-Tabellen erstellen (siehe oben)
2. ✅ Code zu GitHub pushen
3. ✅ Render-Deployment konfigurieren
4. 🔄 Trading-Strategien in Supabase eintragen
5. 🔄 Frontend entwickeln und auf Vercel deployen

## 🛠️ Technologie-Stack

- **Backend**: Node.js + Express.js
- **WebSocket**: ws (Binance-Anbindung)
- **Datenbank**: Supabase (PostgreSQL)
- **Deployment**: Render
- **Frontend**: Vercel (zukünftig)

## 📧 Support

Bei Fragen oder Problemen öffnen Sie ein Issue auf GitHub.

## 📄 Lizenz

ISC

