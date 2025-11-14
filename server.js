// Imports
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const Binance = require('binance-api-node').default;

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

// Binance Client initialisieren (Testnet)
const binanceApiKey = process.env.BINANCE_API_KEY;
const binanceApiSecret = process.env.BINANCE_API_SECRET;
const tradingEnabled = process.env.TRADING_ENABLED === 'true'; // Master-Switch

let binanceClient = null;

if (binanceApiKey && binanceApiSecret) {
  binanceClient = Binance({
    apiKey: binanceApiKey,
    apiSecret: binanceApiSecret,
    useServerTime: true,
    // Testnet URLs
    httpBase: 'https://testnet.binance.vision',
    wsBase: 'wss://testnet.binance.vision/ws'
  });
  console.log('✅ Binance Testnet Client initialisiert');
} else {
  console.warn('⚠️  BINANCE API Keys nicht gesetzt - Trading deaktiviert');
}

// Globale Variablen
let botStatus = 'gestoppt';
let tradingBotProcess = null;
let activeStrategies = [];
let priceHistory = [];
const MAX_PRICE_HISTORY = 100; // Letzte 100 Preise speichern
let lastSignalTime = 0; // Verhindert zu häufige Signale
const SIGNAL_COOLDOWN = 60000; // 1 Minute zwischen Signalen
let lastTradeTime = 0; // Verhindert zu häufige Trades
const TRADE_COOLDOWN = 300000; // 5 Minuten zwischen Trades
let openPositions = new Map(); // Tracking offener Positionen

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
  if (differencePercent > 0.01) { // 0.01% Threshold (sensitiver für Tests)
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
  if (differencePercent < -0.01) { // -0.01% Threshold (sensitiver für Tests)
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
// TRADING EXECUTION FUNKTIONEN (TESTNET)
// ═══════════════════════════════════════════════

/**
 * Berechnet die Kaufmenge basierend auf Risk Management
 */
function calculateQuantity(price, strategy) {
  const config = strategy.config.risk || {};
  const maxTradeSize = config.max_trade_size_usdt || 100; // Default: $100
  
  // Berechne Menge basierend auf Preis
  let quantity = maxTradeSize / price;
  
  // Runde auf sinnige Dezimalstellen (abhängig vom Coin)
  if (price < 1) {
    quantity = parseFloat(quantity.toFixed(0)); // Ganze Zahlen für Meme-Coins
  } else if (price < 100) {
    quantity = parseFloat(quantity.toFixed(2)); // 2 Dezimalstellen
  } else {
    quantity = parseFloat(quantity.toFixed(6)); // 6 Dezimalstellen für BTC/ETH
  }
  
  return quantity;
}

/**
 * Prüft ob Trading erlaubt ist
 */
function canTrade(signal, strategy) {
  // Trading Master-Switch prüfen
  if (!tradingEnabled) {
    console.log('⚠️  Trading ist global deaktiviert (TRADING_ENABLED=false)');
    return false;
  }

  // Binance Client verfügbar?
  if (!binanceClient) {
    console.log('⚠️  Binance Client nicht verfügbar');
    return false;
  }

  // Trade Cooldown prüfen
  const now = Date.now();
  if (now - lastTradeTime < TRADE_COOLDOWN) {
    const waitTime = Math.round((TRADE_COOLDOWN - (now - lastTradeTime)) / 1000);
    console.log(`⏳ Trade Cooldown aktiv - Warte noch ${waitTime}s`);
    return false;
  }

  // Maximale gleichzeitige Trades prüfen
  const maxConcurrentTrades = strategy.config.risk?.max_concurrent_trades || 3;
  if (openPositions.size >= maxConcurrentTrades) {
    console.log(`⚠️  Maximum gleichzeitiger Trades erreicht (${maxConcurrentTrades})`);
    return false;
  }

  // Bei SELL: Prüfen ob offene Position existiert
  if (signal.action === 'sell') {
    const positionKey = `${strategy.id}_${strategy.symbol}`;
    if (!openPositions.has(positionKey)) {
      console.log('⚠️  Keine offene Position zum Verkaufen');
      return false;
    }
  }

  return true;
}

/**
 * Führt einen Trade auf Binance Testnet aus
 */
async function executeTrade(signal, strategy) {
  try {
    // Trading-Checks
    if (!canTrade(signal, strategy)) {
      return null;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🔄 FÜHRE ${signal.action.toUpperCase()}-ORDER AUS`);
    console.log('═══════════════════════════════════════════════');

    const symbol = strategy.symbol;
    const side = signal.action === 'buy' ? 'BUY' : 'SELL';
    const quantity = calculateQuantity(signal.price, strategy);

    console.log(`📊 Symbol: ${symbol}`);
    console.log(`📈 Seite: ${side}`);
    console.log(`💰 Preis: ${signal.price} USDT`);
    console.log(`🔢 Menge: ${quantity}`);
    console.log(`💵 Wert: ~${(signal.price * quantity).toFixed(2)} USDT`);

    // Order auf Binance Testnet platzieren
    const order = await binanceClient.order({
      symbol: symbol,
      side: side,
      type: 'MARKET',
      quantity: quantity.toString()
    });

    console.log(`✅ Order ausgeführt!`);
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Ausgeführte Menge: ${order.executedQty}`);
    console.log(`   Durchschnittspreis: ${order.fills?.[0]?.price || 'N/A'}`);
    console.log('═══════════════════════════════════════════════');
    console.log('');

    // Position tracking
    const positionKey = `${strategy.id}_${symbol}`;
    if (side === 'BUY') {
      openPositions.set(positionKey, {
        entryPrice: signal.price,
        quantity: quantity,
        orderId: order.orderId,
        timestamp: new Date()
      });
    } else {
      openPositions.delete(positionKey);
    }

    // Trade in Datenbank speichern
    await saveTradeToDatabase(order, signal, strategy);

    // Cooldown setzen
    lastTradeTime = Date.now();

    return order;

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════');
    console.error('❌ ORDER FEHLGESCHLAGEN');
    console.error('═══════════════════════════════════════════════');
    console.error(`Fehler: ${error.message}`);
    console.error(`Code: ${error.code || 'N/A'}`);
    console.error('═══════════════════════════════════════════════');
    console.error('');

    // Fehler in Datenbank loggen
    await logTradeError(error, signal, strategy);

    return null;
  }
}

/**
 * Speichert ausgeführten Trade in Supabase
 */
async function saveTradeToDatabase(order, signal, strategy) {
  try {
    // Durchschnittspreis berechnen
    const avgPrice = order.fills && order.fills.length > 0
      ? order.fills.reduce((sum, fill) => sum + parseFloat(fill.price), 0) / order.fills.length
      : parseFloat(signal.price);

    const executedQty = parseFloat(order.executedQty);
    const total = avgPrice * executedQty;

    // PnL berechnen (bei SELL)
    let pnl = null;
    let pnlPercent = null;
    if (signal.action === 'sell') {
      const positionKey = `${strategy.id}_${strategy.symbol}`;
      const position = openPositions.get(positionKey);
      if (position) {
        pnl = (avgPrice - position.entryPrice) * executedQty;
        pnlPercent = ((avgPrice - position.entryPrice) / position.entryPrice) * 100;
      }
    }

    const { data, error } = await supabase
      .from('trades')
      .insert({
        strategy_id: strategy.id,
        symbol: strategy.symbol,
        side: signal.action,
        price: avgPrice,
        quantity: executedQty,
        total: total,
        order_id: order.orderId.toString(),
        status: 'executed',
        executed_at: new Date().toISOString(),
        pnl: pnl,
        pnl_percent: pnlPercent,
        metadata: {
          signal: signal,
          order: {
            orderId: order.orderId,
            clientOrderId: order.clientOrderId,
            transactTime: order.transactTime,
            fills: order.fills
          },
          testnet: true
        }
      })
      .select();

    if (error) {
      console.error('❌ Fehler beim Speichern in Datenbank:', error.message);
    } else {
      console.log('✅ Trade in Datenbank gespeichert');
      
      // Bei SELL: PnL anzeigen
      if (pnl !== null) {
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';
        const pnlColor = pnl >= 0 ? '+' : '';
        console.log(`${pnlEmoji} PnL: ${pnlColor}${pnl.toFixed(2)} USDT (${pnlColor}${pnlPercent.toFixed(2)}%)`);
      }
    }

    return data;
  } catch (error) {
    console.error('❌ Fehler beim Speichern:', error);
    return null;
  }
}

/**
 * Loggt Fehler bei fehlgeschlagenen Trades
 */
async function logTradeError(error, signal, strategy) {
  try {
    await supabase
      .from('bot_logs')
      .insert({
        level: 'error',
        message: `Trade fehlgeschlagen: ${error.message}`,
        strategy_id: strategy.id,
        data: {
          error: {
            message: error.message,
            code: error.code,
            body: error.body
          },
          signal: signal,
          symbol: strategy.symbol
        }
      });
  } catch (err) {
    console.error('❌ Fehler beim Loggen des Fehlers:', err);
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
  // DOGE ist sehr volatil und generiert schnell Signale für Tests!
  const binanceWsUrl = 'wss://stream.binance.com:9443/ws/dogeusdt@trade';
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
          console.log(`💰 DOGE/USDT: ${currentPrice.toFixed(6)} USDT | Vol: ${quantity.toFixed(2)} DOGE`);
        }

        // Trading-Logik: Für jede aktive Strategie
        if (activeStrategies.length > 0) {
          for (const strategy of activeStrategies) {
            // Nur Strategien für das richtige Symbol
            // Akzeptiere BTCUSDT, DOGEUSDT und andere USDT-Paare
            if (!strategy.symbol.endsWith('USDT')) {
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

              // Order ausführen (wenn aktiviert)
              if (tradingEnabled && binanceClient) {
                await executeTrade(signal, strategy);
              } else {
                console.log('💡 Trading deaktiviert - Nur Signal-Generierung');
              }
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

