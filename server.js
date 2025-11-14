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
let activeStrategies = [];
let priceHistory = [];
const MAX_PRICE_HISTORY = 100; // Letzte 100 Preise speichern
let lastSignalTime = 0; // Verhindert zu häufige Signale
const SIGNAL_COOLDOWN = 60000; // 1 Minute zwischen Signalen

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

// ═══════════════════════════════════════════════
// TRADING-LOGIK FUNKTIONEN
// ═══════════════════════════════════════════════

/**
 * Lädt aktive Trading-Strategien von Supabase
 */
async function loadStrategies() {
  try {
    console.log('📊 Lade Trading-Strategien von Supabase...');
    
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('❌ Fehler beim Laden der Strategien:', error);
      return [];
    }

    if (!strategies || strategies.length === 0) {
      console.log('⚠️  Keine aktiven Strategien gefunden');
      console.log('💡 Tipp: Aktivieren Sie eine Strategie in Supabase (Table Editor → strategies → active = true)');
      return [];
    }

    console.log(`✅ ${strategies.length} aktive Strategie(n) geladen:`);
    strategies.forEach(s => {
      console.log(`   📈 ${s.name} (${s.symbol})`);
    });

    return strategies;
  } catch (error) {
    console.error('❌ Fehler:', error);
    return [];
  }
}

/**
 * Berechnet den Moving Average für eine bestimmte Periode
 */
function calculateMA(period) {
  if (priceHistory.length < period) {
    return null;
  }

  const slice = priceHistory.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Generiert Trading-Signale basierend auf MA Crossover
 */
function generateSignal(currentPrice, strategy) {
  const config = strategy.config;
  const maShortPeriod = config.indicators.ma_short || 20;
  const maLongPeriod = config.indicators.ma_long || 50;

  // Prüfen ob genug Daten vorhanden
  if (priceHistory.length < maLongPeriod) {
    return {
      action: 'wait',
      reason: `Sammle Daten... ${priceHistory.length}/${maLongPeriod}`,
      progress: Math.round((priceHistory.length / maLongPeriod) * 100)
    };
  }

  const maShort = calculateMA(maShortPeriod);
  const maLong = calculateMA(maLongPeriod);

  if (!maShort || !maLong) {
    return null;
  }

  const difference = maShort - maLong;
  const differencePercent = (difference / maLong) * 100;

  // Kauf-Signal: Kurzer MA über langem MA (Bullish)
  if (differencePercent > 0.1) { // 0.1% Threshold
    return {
      action: 'buy',
      price: currentPrice,
      reason: `MA Crossover Bullish: MA${maShortPeriod}=${maShort.toFixed(2)} > MA${maLongPeriod}=${maLong.toFixed(2)}`,
      maShort: maShort.toFixed(2),
      maLong: maLong.toFixed(2),
      difference: difference.toFixed(2),
      differencePercent: differencePercent.toFixed(3),
      confidence: Math.min(Math.abs(differencePercent) * 10, 100).toFixed(1)
    };
  }

  // Verkauf-Signal: Kurzer MA unter langem MA (Bearish)
  if (differencePercent < -0.1) { // -0.1% Threshold
    return {
      action: 'sell',
      price: currentPrice,
      reason: `MA Crossover Bearish: MA${maShortPeriod}=${maShort.toFixed(2)} < MA${maLongPeriod}=${maLong.toFixed(2)}`,
      maShort: maShort.toFixed(2),
      maLong: maLong.toFixed(2),
      difference: difference.toFixed(2),
      differencePercent: differencePercent.toFixed(3),
      confidence: Math.min(Math.abs(differencePercent) * 10, 100).toFixed(1)
    };
  }

  // Neutral: Kein klares Signal
  return {
    action: 'hold',
    reason: 'Kein klares Signal',
    maShort: maShort.toFixed(2),
    maLong: maLong.toFixed(2),
    difference: difference.toFixed(2),
    differencePercent: differencePercent.toFixed(3)
  };
}

/**
 * Analysiert einen neuen Preis und gibt Trading-Signal zurück
 */
function analyzePrice(currentPrice, strategy) {
  // Preis zur Historie hinzufügen
  priceHistory.push(parseFloat(currentPrice));

  // Historie begrenzen
  if (priceHistory.length > MAX_PRICE_HISTORY) {
    priceHistory.shift();
  }

  // Signal generieren
  return generateSignal(currentPrice, strategy);
}

/**
 * Loggt Trading-Signale in Supabase
 */
async function logSignal(signal, strategy) {
  try {
    // Nur wichtige Signale loggen (buy/sell)
    if (signal.action !== 'buy' && signal.action !== 'sell') {
      return;
    }

    const { error } = await supabase
      .from('bot_logs')
      .insert({
        level: 'info',
        message: `Trading Signal: ${signal.action.toUpperCase()}`,
        strategy_id: strategy.id,
        data: {
          action: signal.action,
          price: signal.price,
          reason: signal.reason,
          maShort: signal.maShort,
          maLong: signal.maLong,
          difference: signal.difference,
          differencePercent: signal.differencePercent,
          confidence: signal.confidence,
          symbol: strategy.symbol
        }
      });

    if (error) {
      console.error('❌ Fehler beim Loggen in Supabase:', error.message);
    } else {
      console.log('✅ Signal in Datenbank gespeichert');
    }
  } catch (error) {
    console.error('❌ Fehler beim Loggen:', error.message);
  }
}

// ═══════════════════════════════════════════════
// TRADING-BOT FUNKTIONEN
// ═══════════════════════════════════════════════

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

  // Strategien von Supabase laden
  activeStrategies = await loadStrategies();
  
  if (activeStrategies.length === 0) {
    console.log('⚠️  Bot startet im Beobachtungsmodus (keine aktiven Strategien)');
  }

  // Preishistorie zurücksetzen
  priceHistory = [];
  lastSignalTime = 0;

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

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.p) {  // 'p' ist der Preis bei Binance Trade Streams
        const currentPrice = parseFloat(message.p);
        const quantity = parseFloat(message.q);

        // Preis anzeigen (alle 10 Preise nur einen anzeigen, um Spam zu vermeiden)
        if (priceHistory.length % 10 === 0) {
          console.log(`💰 BTC/USDT: ${currentPrice.toFixed(2)} USDT | Vol: ${quantity.toFixed(6)} BTC`);
        }

        // Trading-Logik: Für jede aktive Strategie
        if (activeStrategies.length > 0) {
          for (const strategy of activeStrategies) {
            // Nur Strategien für das richtige Symbol
            if (strategy.symbol !== 'BTCUSDT') {
              continue;
            }

            const signal = analyzePrice(currentPrice, strategy);

            if (!signal) continue;

            // Fortschritt anzeigen während Datensammlung
            if (signal.action === 'wait') {
              if (priceHistory.length % 20 === 0) {
                console.log(`📊 ${signal.reason} (${signal.progress}%)`);
              }
              continue;
            }

            // Kauf- oder Verkauf-Signal
            if (signal.action === 'buy' || signal.action === 'sell') {
              // Cooldown prüfen (nicht zu häufig signalisieren)
              const now = Date.now();
              if (now - lastSignalTime < SIGNAL_COOLDOWN) {
                continue;
              }

              console.log('');
              console.log('═══════════════════════════════════════════════');
              console.log(`🎯 TRADING SIGNAL: ${signal.action.toUpperCase()}`);
              console.log('═══════════════════════════════════════════════');
              console.log(`📊 Strategie: ${strategy.name}`);
              console.log(`💰 Preis: ${signal.price} USDT`);
              console.log(`📈 MA${strategy.config.indicators.ma_short}: ${signal.maShort}`);
              console.log(`📉 MA${strategy.config.indicators.ma_long}: ${signal.maLong}`);
              console.log(`📊 Differenz: ${signal.difference} (${signal.differencePercent}%)`);
              console.log(`🎲 Konfidenz: ${signal.confidence}%`);
              console.log(`💡 Grund: ${signal.reason}`);
              console.log('═══════════════════════════════════════════════');
              console.log('');

              // Signal in Datenbank loggen
              await logSignal(signal, strategy);

              // Cooldown setzen
              lastSignalTime = now;

              // TODO: Hier später Order-Ausführung (Phase 2)
              // await executeTrade(signal, strategy);
            } 
            // Hold-Signal (nur gelegentlich anzeigen)
            else if (signal.action === 'hold' && priceHistory.length % 50 === 0) {
              console.log(`📊 Hold - MA${strategy.config.indicators.ma_short}: ${signal.maShort} | MA${strategy.config.indicators.ma_long}: ${signal.maLong} | Diff: ${signal.differencePercent}%`);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Verarbeiten der Marktdaten:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket-Verbindung wurde geschlossen');
    botStatus = 'gestoppt (Verbindung verloren)';
    tradingBotProcess = null;
    
    // Reset
    activeStrategies = [];
    priceHistory = [];
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
  
  // Reset
  activeStrategies = [];
  priceHistory = [];
  lastSignalTime = 0;
  
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

