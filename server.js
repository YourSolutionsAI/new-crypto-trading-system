// Imports
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

// Express-Server initialisieren
const app = express();

// CORS-Konfiguration
const corsOptions = {
  origin: [
    'http://localhost:3000',  // Lokale Entwicklung
    /\.vercel\.app$/,         // Alle Vercel-URLs (Platzhalter)
    // Hier später die konkrete Vercel-URL hinzufügen
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Supabase-Client initialisieren
const supabaseUrl = 'https://snemqjltnqflyfrmjlpj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.warn('⚠️  WARNUNG: SUPABASE_SERVICE_KEY Umgebungsvariable ist nicht gesetzt!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Globale Variablen
let botStatus = 'gestoppt';
let tradingBotProcess = null;

// API-Routen

/**
 * GET /api/status
 * Gibt den aktuellen Status des Trading-Bots zurück
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: botStatus,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/start-bot
 * Startet den Trading-Bot
 */
app.post('/api/start-bot', async (req, res) => {
  try {
    await startTradingBot();
    res.json({
      success: true,
      message: 'Trading-Bot wird gestartet',
      status: botStatus
    });
  } catch (error) {
    console.error('Fehler beim Starten des Bots:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Starten des Bots',
      error: error.message
    });
  }
});

/**
 * POST /api/stop-bot
 * Stoppt den Trading-Bot
 */
app.post('/api/stop-bot', (req, res) => {
  try {
    stopTradingBot();
    res.json({
      success: true,
      message: 'Trading-Bot wurde gestoppt',
      status: botStatus
    });
  } catch (error) {
    console.error('Fehler beim Stoppen des Bots:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Stoppen des Bots',
      error: error.message
    });
  }
});

// Trading-Bot Funktionen

/**
 * Startet den Trading-Bot
 * - Lädt Strategien von Supabase
 * - Stellt WebSocket-Verbindung zu Binance her
 * - Verarbeitet Live-Marktdaten
 */
async function startTradingBot() {
  // Prüfen, ob Bot bereits läuft
  if (tradingBotProcess !== null) {
    console.log('⚠️  Bot läuft bereits');
    return;
  }

  console.log('🚀 Trading-Bot wird gestartet...');
  botStatus = 'startet...';

  // Platzhalter: Strategien von Supabase laden
  console.log('📊 Lade Trading-Strategien von Supabase...');
  // TODO: Hier später die Strategien aus der Datenbank laden
  // const { data: strategies, error } = await supabase
  //   .from('strategies')
  //   .select('*')
  //   .eq('active', true);

  // WebSocket-Verbindung zu Binance herstellen
  const binanceWsUrl = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
  console.log(`🔌 Stelle Verbindung zu Binance her: ${binanceWsUrl}`);

  const ws = new WebSocket(binanceWsUrl);
  tradingBotProcess = ws;

  // WebSocket Event-Handler

  ws.on('open', () => {
    console.log('✅ Verbindung zu Binance erfolgreich hergestellt');
    botStatus = 'läuft (verbunden)';
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Marktdaten in die Konsole loggen
      if (message.p) {  // 'p' ist der Preis bei Binance Trade Streams
        console.log(`💰 BTC/USDT Preis: ${parseFloat(message.p).toFixed(2)} USDT | Menge: ${message.q}`);
      }

      // TODO: Hier später die Trading-Logik implementieren
      // - Preis analysieren
      // - Strategie-Signale prüfen
      // - Orders platzieren
      
    } catch (error) {
      console.error('❌ Fehler beim Parsen der Marktdaten:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket-Verbindung wurde geschlossen');
    botStatus = 'gestoppt (Verbindung verloren)';
    tradingBotProcess = null;
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket-Fehler:', error);
    botStatus = 'Fehler';
    tradingBotProcess = null;
  });
}

/**
 * Stoppt den Trading-Bot
 * - Schließt WebSocket-Verbindung
 * - Setzt Status zurück
 */
function stopTradingBot() {
  if (tradingBotProcess === null) {
    console.log('ℹ️  Bot läuft nicht');
    return;
  }

  console.log('🛑 Stoppe Trading-Bot...');
  
  // WebSocket-Verbindung schließen
  tradingBotProcess.close();
  
  botStatus = 'gestoppt';
  tradingBotProcess = null;
  
  console.log('✅ Trading-Bot wurde erfolgreich gestoppt');
}

// Server starten
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';  // Wichtig für Render-Deployment

app.listen(PORT, HOST, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('🤖 Krypto-Trading-Bot Backend');
  console.log('═══════════════════════════════════════════════');
  console.log(`🌐 Server läuft auf: http://${HOST}:${PORT}`);
  console.log(`📊 Supabase-URL: ${supabaseUrl}`);
  console.log(`🔑 Supabase-Key: ${supabaseKey ? '✅ gesetzt' : '❌ FEHLT'}`);
  console.log(`📍 Bot-Status: ${botStatus}`);
  console.log('═══════════════════════════════════════════════');
  console.log('API-Endpunkte:');
  console.log(`  GET  /api/status     - Bot-Status abfragen`);
  console.log(`  POST /api/start-bot  - Bot starten`);
  console.log(`  POST /api/stop-bot   - Bot stoppen`);
  console.log('═══════════════════════════════════════════════');
});

