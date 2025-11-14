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
let lastSignalTime = 0;
let lastTradeTime = 0;
let openPositions = new Map(); // Tracking offener Positionen
let currentSymbol = null; // Wird aus Supabase geladen
let botSettings = {}; // Bot-Einstellungen aus Supabase
let lotSizes = {}; // Lot Size Regeln aus Supabase
let settingsReloadInterval = null; // Interval für automatisches Neuladen der Einstellungen

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
 * Lädt Bot-Einstellungen von Supabase
 * @param {boolean} silent - Wenn true, werden weniger Logs ausgegeben (für Auto-Reload)
 */
async function loadBotSettings(silent = false) {
  try {
    if (!silent) {
      console.log('⚙️  Lade Bot-Einstellungen von Supabase...');
    }
    
    const { data: settings, error } = await supabase
      .from('bot_settings')
      .select('*');

    if (error) {
      console.error('❌ Fehler beim Laden der Einstellungen:', error);
      return false;
    }

    // Alte Werte für Vergleich (wichtig für Auto-Reload)
    const oldSettingsCount = Object.keys(botSettings).length;
    const oldLotSizesCount = Object.keys(lotSizes).length;
    const oldThreshold = botSettings.signal_threshold_percent;

    // Einstellungen zurücksetzen
    botSettings = {};
    lotSizes = {};

    // Einstellungen in Objekt umwandeln
    settings.forEach(setting => {
      const key = setting.key;
      const value = setting.value;

      // Lot Sizes extrahieren
      if (key.startsWith('lot_size_')) {
        const symbol = key.replace('lot_size_', '');
        lotSizes[symbol] = value;
      } 
      // Normale Settings
      else {
        botSettings[key] = value;
      }
    });

    const newSettingsCount = Object.keys(botSettings).length;
    const newLotSizesCount = Object.keys(lotSizes).length;

    if (silent) {
      // Bei Auto-Reload: Loggen wenn sich etwas geändert hat
      const thresholdChanged = oldThreshold !== botSettings.signal_threshold_percent;
      const countChanged = oldSettingsCount !== newSettingsCount || oldLotSizesCount !== newLotSizesCount;
      
      if (thresholdChanged || countChanged) {
        console.log(`🔄 Einstellungen aktualisiert: ${newSettingsCount} Bot-Einstellungen, ${newLotSizesCount} Lot Sizes`);
        if (thresholdChanged) {
          console.log(`   📊 signal_threshold_percent geändert: ${oldThreshold || 'N/A'} → ${botSettings.signal_threshold_percent || 'N/A'}`);
        }
      }
    } else {
      console.log(`✅ ${newSettingsCount} Bot-Einstellungen geladen`);
      console.log(`✅ ${newLotSizesCount} Lot Size Konfigurationen geladen`);
    }

    return true;

  } catch (error) {
    console.error('❌ Fehler beim Laden der Einstellungen:', error);
    return false;
  }
}

/**
 * Lädt offene Positionen aus der Datenbank (BUY ohne entsprechenden SELL)
 * Korrigierte Logik: Paart BUY- und SELL-Trades chronologisch und berechnet verbleibende Positionen
 */
async function loadOpenPositions() {
  try {
    console.log('📊 Lade offene Positionen aus der Datenbank...');
    
    // Für jede aktive Strategie prüfen, ob es offene Positionen gibt
    for (const strategy of activeStrategies) {
      const symbol = strategy.symbol;
      
      // Lade alle BUY-Trades chronologisch sortiert
      const { data: buyTrades, error: buyError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategy.id)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .eq('status', 'executed')
        .order('executed_at', { ascending: true }); // Chronologisch sortiert
      
      if (buyError) {
        console.error(`❌ Fehler beim Laden der BUY-Trades für ${symbol}:`, buyError);
        continue;
      }
      
      // Lade alle SELL-Trades chronologisch sortiert
      const { data: sellTrades, error: sellError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategy.id)
        .eq('symbol', symbol)
        .eq('side', 'sell')
        .eq('status', 'executed')
        .order('executed_at', { ascending: true }); // Chronologisch sortiert
      
      if (sellError) {
        console.error(`❌ Fehler beim Laden der SELL-Trades für ${symbol}:`, sellError);
        continue;
      }
      
      const buyCount = buyTrades ? buyTrades.length : 0;
      const sellCount = sellTrades ? sellTrades.length : 0;
      
      console.log(`   📊 ${symbol}: ${buyCount} BUY-Trades, ${sellCount} SELL-Trades`);
      
      // Paare BUY- und SELL-Trades chronologisch
      // FIFO (First In First Out): Älteste BUY-Trades werden zuerst verkauft
      let buyIndex = 0;
      let sellIndex = 0;
      let totalOpenQuantity = 0;
      let weightedAveragePrice = 0;
      let totalValue = 0;
      const openBuyTrades = [];
      
      // Paare BUY- und SELL-Trades
      while (buyIndex < buyCount && sellIndex < sellCount) {
        const buyTrade = buyTrades[buyIndex];
        const sellTrade = sellTrades[sellIndex];
        
        // Wenn BUY vor SELL war, ist BUY noch offen
        if (new Date(buyTrade.executed_at) < new Date(sellTrade.executed_at)) {
          openBuyTrades.push(buyTrade);
          totalOpenQuantity += parseFloat(buyTrade.quantity);
          totalValue += parseFloat(buyTrade.price) * parseFloat(buyTrade.quantity);
          buyIndex++;
        } else {
          // SELL schließt BUY
          buyIndex++;
          sellIndex++;
        }
      }
      
      // Alle verbleibenden BUY-Trades sind offen
      while (buyIndex < buyCount) {
        const buyTrade = buyTrades[buyIndex];
        openBuyTrades.push(buyTrade);
        totalOpenQuantity += parseFloat(buyTrade.quantity);
        totalValue += parseFloat(buyTrade.price) * parseFloat(buyTrade.quantity);
        buyIndex++;
      }
      
      // Wenn es offene Positionen gibt, speichere sie
      if (openBuyTrades.length > 0) {
        const positionKey = `${strategy.id}_${symbol}`;
        
        // Berechne gewichteten Durchschnittspreis
        weightedAveragePrice = totalValue / totalOpenQuantity;
        
        // Verwende den letzten BUY-Trade für Order-ID und Timestamp
        const lastBuyTrade = openBuyTrades[openBuyTrades.length - 1];
        
        openPositions.set(positionKey, {
          symbol: symbol,
          entryPrice: weightedAveragePrice,
          quantity: totalOpenQuantity,
          orderId: lastBuyTrade.order_id,
          timestamp: new Date(lastBuyTrade.executed_at),
          buyTradeCount: openBuyTrades.length,
          individualTrades: openBuyTrades.map(t => ({
            orderId: t.order_id,
            price: parseFloat(t.price),
            quantity: parseFloat(t.quantity),
            executedAt: t.executed_at
          }))
        });
        
        console.log(`✅ Offene Position geladen: ${symbol}`);
        console.log(`   📊 Anzahl BUY-Trades: ${openBuyTrades.length}`);
        console.log(`   💰 Gesamtmenge: ${totalOpenQuantity.toFixed(2)}`);
        console.log(`   💵 Gewichteter Durchschnittspreis: ${weightedAveragePrice.toFixed(6)} USDT`);
        console.log(`   📈 Gesamtwert: ${totalValue.toFixed(2)} USDT`);
      } else {
        console.log(`   ✅ Keine offenen Positionen für ${symbol}`);
      }
    }
    
    console.log(`✅ ${openPositions.size} offene Position(en) geladen`);
    
    // Zeige alle geladenen Positionen
    if (openPositions.size > 0) {
      console.log('📊 Geladene Positionen:');
      openPositions.forEach((position, key) => {
        console.log(`   ${key}: ${position.quantity.toFixed(2)} @ ${position.entryPrice.toFixed(6)} USDT`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fehler beim Laden der offenen Positionen:', error);
    console.error('   Stack:', error.stack);
  }
}

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

  // Threshold aus Supabase oder Fallback
  const threshold = botSettings.signal_threshold_percent || 0.01;

  // Kauf-Signal: Kurzer MA über langem MA (Bullish)
  if (differencePercent > threshold) {
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
  if (differencePercent < -threshold) {
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

  // Historie begrenzen (aus Supabase oder Fallback 100)
  const maxPriceHistory = botSettings.max_price_history || 100;
  if (priceHistory.length > maxPriceHistory) {
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

    const logData = {
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
        symbol: strategy.symbol,
        timestamp: new Date().toISOString()
      }
    };

    const { error } = await supabase
      .from('bot_logs')
      .insert(logData);

    if (error) {
      console.error('❌ Fehler beim Loggen in Supabase:', error.message);
    } else {
      // WICHTIG: Auch in Console loggen, damit Render-Logs es sehen
      console.log(`✅ Signal in Datenbank gespeichert: ${signal.action.toUpperCase()} @ ${signal.price} USDT (${signal.differencePercent}%)`);
    }
  } catch (error) {
    console.error('❌ Fehler beim Loggen:', error.message);
  }
}

/**
 * Loggt wichtige Bot-Events in Supabase (für besseres Tracking)
 */
async function logBotEvent(level, message, data = {}) {
  try {
    const { error } = await supabase
      .from('bot_logs')
      .insert({
        level: level,
        message: message,
        data: {
          ...data,
          timestamp: new Date().toISOString()
        }
      });

    if (error) {
      console.error('❌ Fehler beim Loggen des Events:', error.message);
    }
  } catch (error) {
    console.error('❌ Fehler beim Loggen des Events:', error.message);
  }
}

// ═══════════════════════════════════════════════
// TRADING EXECUTION FUNKTIONEN (TESTNET)
// ═══════════════════════════════════════════════

/**
 * Berechnet die Kaufmenge basierend auf Risk Management & Binance Lot Size
 */
function calculateQuantity(price, symbol, strategy) {
  // Trade-Größe aus Strategie oder Bot-Settings oder Fallback
  const maxTradeSize = strategy.config.risk?.max_trade_size_usdt 
    || botSettings.default_trade_size_usdt 
    || 100;
  
  // Berechne Basis-Menge
  let quantity = maxTradeSize / price;
  
  // Hole Lot Size Regeln aus Supabase
  const lotSize = lotSizes[symbol];
  
  if (!lotSize) {
    console.error(`❌ Keine Lot Size Konfiguration für ${symbol} gefunden!`);
    console.error(`💡 Bitte fügen Sie lot_size_${symbol} in bot_settings hinzu!`);
    return null; // Trade abbrechen wenn keine Lot Size vorhanden
  }
  
  // Runde auf Step Size
  quantity = Math.floor(quantity / lotSize.stepSize) * lotSize.stepSize;
  
  // Runde auf korrekte Dezimalstellen
  quantity = parseFloat(quantity.toFixed(lotSize.decimals));
  
  // Prüfe Min/Max
  if (quantity < lotSize.minQty) {
    console.log(`⚠️  Berechnete Menge ${quantity} < Minimum ${lotSize.minQty}`);
    quantity = lotSize.minQty;
  }
  
  if (quantity > lotSize.maxQty) {
    console.log(`⚠️  Berechnete Menge ${quantity} > Maximum ${lotSize.maxQty}`);
    quantity = lotSize.maxQty;
  }
  
  console.log(`📊 Lot Size Info: Min=${lotSize.minQty}, Step=${lotSize.stepSize}, Decimals=${lotSize.decimals}`);
  
  return quantity;
}

/**
 * Prüft ob Trading erlaubt ist
 * @returns {Object} { allowed: boolean, reason: string }
 */
async function canTrade(signal, strategy) {
  // Trading Master-Switch prüfen
  if (!tradingEnabled) {
    const reason = 'Trading ist global deaktiviert (TRADING_ENABLED=false)';
    console.log(`⚠️  ${reason}`);
    return { allowed: false, reason: reason };
  }

  // Binance Client verfügbar?
  if (!binanceClient) {
    const reason = 'Binance Client nicht verfügbar';
    console.log(`⚠️  ${reason}`);
    return { allowed: false, reason: reason };
  }

  // Trade Cooldown prüfen
  const now = Date.now();
  const tradeCooldown = botSettings.trade_cooldown_ms || 300000;
  const cooldownRemaining = tradeCooldown - (now - lastTradeTime);
  
  if (cooldownRemaining > 0) {
    const waitTime = Math.round(cooldownRemaining / 1000);
    const reason = `Trade Cooldown aktiv - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`;
    // WICHTIG: Deutliches Logging für Render-Logs
    console.log(`⏳ TRADE COOLDOWN AKTIV - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`);
    return { allowed: false, reason: reason };
  }

  // Maximale gleichzeitige Trades prüfen
  const maxConcurrentTrades = strategy.config.risk?.max_concurrent_trades 
    || botSettings.max_concurrent_trades 
    || 3;
  if (openPositions.size >= maxConcurrentTrades) {
    const reason = `Maximum gleichzeitiger Trades erreicht (${maxConcurrentTrades})`;
    console.log(`⚠️  ${reason}`);
    return { allowed: false, reason: reason };
  }

  // Bei SELL: Prüfen ob offene Position existiert
  if (signal.action === 'sell') {
    const positionKey = `${strategy.id}_${currentSymbol}`;
    if (!openPositions.has(positionKey)) {
      const reason = `Keine offene Position zum Verkaufen: ${positionKey}`;
      console.log(`⚠️  KEINE OFFENE POSITION ZUM VERKAUFEN: ${positionKey}`);
      console.log(`   Aktuelle offene Positionen: ${Array.from(openPositions.keys()).join(', ') || 'Keine'}`);
      await logBotEvent('warning', `SELL-Signal ignoriert: Keine offene Position`, {
        positionKey: positionKey,
        openPositions: Array.from(openPositions.keys()),
        symbol: currentSymbol,
        strategy_id: strategy.id
      });
      return { allowed: false, reason: reason };
    }
    
    // KRITISCH: Position SOFORT entfernen, um Race-Conditions zu vermeiden!
    // Wenn mehrere SELL-Signale gleichzeitig kommen, wird nur der erste ausgeführt
    const position = openPositions.get(positionKey);
    openPositions.delete(positionKey); // SOFORT löschen, bevor Trade ausgeführt wird
    console.log(`📊 Position reserviert für SELL: ${positionKey} @ ${position.entryPrice} USDT`);
    
    // Position-Daten an Signal anhängen, damit sie später verwendet werden können
    signal._positionData = position;
  }

  return { allowed: true, reason: 'OK' };
}

/**
 * Führt einen Trade auf Binance Testnet aus
 */
async function executeTrade(signal, strategy) {
  try {
    // Trading-Checks
    const tradeCheck = await canTrade(signal, strategy);
    if (!tradeCheck.allowed) {
      // Logge warum Trade nicht ausgeführt wird
      console.log(`⚠️  Trade nicht ausgeführt: ${tradeCheck.reason}`);
      return null;
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🔄 FÜHRE ${signal.action.toUpperCase()}-ORDER AUS`);
    console.log('═══════════════════════════════════════════════');

    const symbol = currentSymbol; // Verwende das aktuelle Symbol (aus Strategie)
    const side = signal.action === 'buy' ? 'BUY' : 'SELL';
    const quantity = calculateQuantity(signal.price, symbol, strategy);

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
    const positionKey = `${strategy.id}_${currentSymbol}`;
    if (side === 'BUY') {
      openPositions.set(positionKey, {
        symbol: symbol,
        entryPrice: signal.price,
        quantity: quantity,
        orderId: order.orderId,
        timestamp: new Date()
      });
      console.log(`📊 Position geöffnet: ${positionKey} @ ${signal.price} USDT`);
      await logBotEvent('info', `Position geöffnet: ${symbol}`, {
        positionKey: positionKey,
        entryPrice: signal.price,
        quantity: quantity,
        orderId: order.orderId.toString(),
        strategy_id: strategy.id
      });
    } else {
      // Bei SELL: Position wurde bereits in canTrade() gelöscht (Race-Condition-Schutz)
      // Verwende die Position-Daten aus dem Signal
      const closedPosition = signal._positionData;
      if (closedPosition) {
        console.log(`📊 Position geschlossen: ${positionKey} (Entry: ${closedPosition.entryPrice} USDT, Exit: ${avgPrice} USDT)`);
        await logBotEvent('info', `Position geschlossen: ${symbol}`, {
          positionKey: positionKey,
          entryPrice: closedPosition.entryPrice,
          exitPrice: avgPrice,
          strategy_id: strategy.id
        });
      } else {
        console.log(`⚠️  Position ${positionKey} wurde bereits geschlossen oder existiert nicht`);
      }
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

    // WICHTIG: Bei SELL-Fehler Position wiederherstellen!
    if (signal.action === 'sell' && signal._positionData) {
      const positionKey = `${strategy.id}_${currentSymbol}`;
      openPositions.set(positionKey, signal._positionData);
      console.log(`🔄 Position wiederhergestellt nach fehlgeschlagenem SELL: ${positionKey}`);
      await logBotEvent('warning', `Position wiederhergestellt nach fehlgeschlagenem SELL`, {
        positionKey: positionKey,
        error: error.message,
        errorCode: error.code,
        strategy_id: strategy.id
      });
    }

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
      // Verwende Position-Daten aus Signal (wurde in canTrade() gespeichert)
      const position = signal._positionData;
      if (position) {
        pnl = (avgPrice - position.entryPrice) * executedQty;
        pnlPercent = ((avgPrice - position.entryPrice) / position.entryPrice) * 100;
      } else {
        console.log(`⚠️  Keine Position-Daten für PnL-Berechnung gefunden`);
      }
    }

    const { data, error } = await supabase
      .from('trades')
      .insert({
        strategy_id: strategy.id,
        symbol: currentSymbol,
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
      await logBotEvent('error', 'Fehler beim Speichern des Trades in Datenbank', {
        error: error.message,
        orderId: order.orderId,
        symbol: currentSymbol
      });
    } else {
      // WICHTIG: Deutliches Logging für Render-Logs
      console.log('═══════════════════════════════════════════════');
      console.log('✅ TRADE IN DATENBANK GESPEICHERT');
      console.log(`   Symbol: ${currentSymbol}`);
      console.log(`   Side: ${signal.action.toUpperCase()}`);
      console.log(`   Preis: ${avgPrice} USDT`);
      console.log(`   Menge: ${executedQty}`);
      console.log(`   Order ID: ${order.orderId}`);
      console.log('═══════════════════════════════════════════════');
      
      await logBotEvent('info', `Trade in Datenbank gespeichert: ${signal.action.toUpperCase()}`, {
        symbol: currentSymbol,
        side: signal.action,
        price: avgPrice,
        quantity: executedQty,
        orderId: order.orderId.toString(),
        strategy_id: strategy.id
      });
      
      // Bei SELL: PnL anzeigen
      if (pnl !== null) {
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';
        const pnlColor = pnl >= 0 ? '+' : '';
        console.log(`${pnlEmoji} PnL: ${pnlColor}${pnl.toFixed(2)} USDT (${pnlColor}${pnlPercent.toFixed(2)}%)`);
        await logBotEvent('info', `Trade PnL berechnet: ${pnlColor}${pnl.toFixed(2)} USDT`, {
          pnl: pnl,
          pnlPercent: pnlPercent,
          symbol: currentSymbol,
          orderId: order.orderId.toString()
        });
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

  // Bot-Einstellungen von Supabase laden
  await loadBotSettings();

  // Strategien von Supabase laden
  activeStrategies = await loadStrategies();
  
  if (activeStrategies.length === 0) {
    console.log('⚠️  Bot startet im Beobachtungsmodus (keine aktiven Strategien)');
    botStatus = 'gestoppt (keine Strategien)';
    return;
  }
  
  // WICHTIG: Offene Positionen aus der Datenbank laden (nach Neustart)
  await loadOpenPositions();

  // Symbol aus erster aktiver Strategie
  currentSymbol = activeStrategies[0].symbol;
  
  // WebSocket URL aus Supabase oder Fallback
  const wsKey = `websocket_${currentSymbol}`;
  const binanceWsUrl = botSettings[wsKey] 
    ? botSettings[wsKey].replace(/"/g, '') // Entferne Anführungszeichen
    : `wss://stream.binance.com:9443/ws/${currentSymbol.toLowerCase()}@trade`;
  
  console.log(`📊 Aktives Symbol: ${currentSymbol}`);
  console.log(`🔌 Stelle Verbindung zu Binance her: ${binanceWsUrl}`);

  // Preishistorie zurücksetzen
  priceHistory = [];
  lastSignalTime = 0;

  const ws = new WebSocket(binanceWsUrl);
  tradingBotProcess = ws;

  // WebSocket Event-Handler

  ws.on('open', () => {
    console.log('✅ Verbindung zu Binance erfolgreich hergestellt');
    botStatus = 'läuft (verbunden)';
    
    // Heartbeat-Log alle 5 Minuten, um zu zeigen, dass die Verbindung noch aktiv ist
    const heartbeatInterval = setInterval(() => {
      if (tradingBotProcess === ws && ws.readyState === WebSocket.OPEN) {
        const now = new Date().toISOString();
        console.log(`💓 Heartbeat: ${now} | Preis-Historie: ${priceHistory.length} | Status: ${botStatus} | WS-State: ${ws.readyState}`);
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 5 * 60 * 1000); // Alle 5 Minuten
    
    // Ping alle 30 Sekunden, um Verbindung am Leben zu halten
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    // Speichere Interval-IDs für Cleanup
    ws._intervals = { heartbeatInterval, pingInterval };
    
    // Pong-Handler für Verbindungsüberwachung
    ws.on('pong', () => {
      // Verbindung ist aktiv - kein Log nötig, aber könnte für Debugging verwendet werden
    });
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // VALIDIERUNG: Prüfe ob Nachricht das erwartete Format hat
      if (!message.p) {
        // Logge gelegentlich (1% der Nachrichten ohne Preis), um zu sehen ob Daten ankommen
        if (Math.random() < 0.01) {
          console.log(`⚠️  Nachricht ohne Preis empfangen: ${JSON.stringify(message).substring(0, 100)}`);
        }
        return; // Überspringe Nachrichten ohne Preis
      }
      
      const currentPrice = parseFloat(message.p);
      const quantity = parseFloat(message.q || 0);
      
      // VALIDIERUNG: Prüfe ob Preis gültig ist
      if (isNaN(currentPrice) || currentPrice <= 0) {
        console.error(`❌ Ungültiger Preis empfangen: ${message.p}`);
        return;
      }

      // Trading-Logik: Für jede aktive Strategie
      if (activeStrategies.length === 0) {
        // Logge gelegentlich, wenn keine Strategien aktiv sind
        if (Math.random() < 0.001) { // Sehr selten (0.1%)
          console.log(`⚠️  Keine aktiven Strategien - Daten werden empfangen aber nicht verarbeitet`);
        }
        return;
      }
      
      for (const strategy of activeStrategies) {
        const signal = analyzePrice(currentPrice, strategy); // HIER wird priceHistory erhöht!
        
        if (!signal) continue;
        
        // JETZT können wir mit der korrekten priceHistory.length arbeiten
        const currentHistoryLength = priceHistory.length;
        
        // Debug: Zeige alle 1000 Preise, dass Daten ankommen
        if (currentHistoryLength % 1000 === 0 && currentHistoryLength > 0) {
          console.log(`📡 Daten empfangen: ${currentHistoryLength} Preise verarbeitet | Letzte Aktualisierung: ${new Date().toISOString()}`);
          // WICHTIG: Logge auch in Supabase, dass Daten empfangen werden (alle 1000 Preise)
          await logBotEvent('debug', `Datenfluss: ${currentHistoryLength} Preise verarbeitet`, {
            symbol: currentSymbol,
            priceCount: currentHistoryLength
          });
        }
        
        // Preis anzeigen (alle X Preise nur einen anzeigen, um Spam zu vermeiden)
        const priceLogInterval = botSettings.logging_price_log_interval || 10;
        if (currentHistoryLength % priceLogInterval === 0) {
          const priceDecimals = currentPrice < 1 ? 6 : 2;
          console.log(`💰 ${currentSymbol}: ${currentPrice.toFixed(priceDecimals)} USDT | Vol: ${quantity.toFixed(2)}`);
        }

        // Fortschritt anzeigen während Datensammlung
        if (signal.action === 'wait') {
          const showProgress = botSettings.logging_show_data_progress !== false;
          if (showProgress && currentHistoryLength % 20 === 0) {
            console.log(`📊 ${signal.reason} (${signal.progress}%)`);
          }
          continue;
        }

        // Kauf- oder Verkauf-Signal
        if (signal.action === 'buy' || signal.action === 'sell') {
          // WICHTIG: Signal-Cooldown PRÜFEN BEVOR Signal geloggt wird!
          const now = Date.now();
          const signalCooldown = botSettings.signal_cooldown_ms || 60000;
          const signalCooldownRemaining = signalCooldown - (now - lastSignalTime);
          
          if (signalCooldownRemaining > 0) {
            // Signal-Cooldown aktiv - überspringe Signal (nicht loggen!)
            const verbose = botSettings.logging_verbose === true;
            if (verbose) {
              console.log(`⏳ Signal Cooldown aktiv: ${Math.round(signalCooldownRemaining / 1000)}s - Signal übersprungen`);
            }
            continue; // WICHTIG: continue, damit Signal nicht verarbeitet wird
          }

          // Signal-Cooldown ist abgelaufen - Signal verarbeiten
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

          // Cooldown setzen - SOFORT nach Signal-Generierung
          lastSignalTime = now;

          // Order ausführen (wenn aktiviert)
          if (tradingEnabled && binanceClient) {
            // WICHTIG: Logge vor Trade-Ausführung
            console.log(`🔄 Versuche Trade auszuführen: ${signal.action.toUpperCase()} @ ${signal.price} USDT`);
            await logBotEvent('info', `Trade-Ausführung gestartet: ${signal.action.toUpperCase()}`, {
              action: signal.action,
              price: signal.price,
              symbol: strategy.symbol,
              strategy_id: strategy.id
            });
            
            const tradeResult = await executeTrade(signal, strategy);
            
            if (tradeResult) {
              console.log(`✅ Trade erfolgreich ausgeführt: ${signal.action.toUpperCase()} @ ${signal.price} USDT`);
              await logBotEvent('info', `Trade erfolgreich ausgeführt: ${signal.action.toUpperCase()}`, {
                action: signal.action,
                price: signal.price,
                symbol: strategy.symbol,
                orderId: tradeResult.orderId,
                strategy_id: strategy.id
              });
            } else {
              console.log(`⚠️  Trade nicht ausgeführt (Cooldown oder andere Checks)`);
              await logBotEvent('warning', `Trade nicht ausgeführt: ${signal.action.toUpperCase()}`, {
                action: signal.action,
                price: signal.price,
                symbol: strategy.symbol,
                reason: 'Cooldown oder andere Checks',
                strategy_id: strategy.id
              });
            }
          } else {
            console.log('💡 Trading deaktiviert - Nur Signal-Generierung');
            await logBotEvent('info', 'Trading deaktiviert - Nur Signal-Generierung', {
              tradingEnabled: tradingEnabled,
              binanceClientAvailable: !!binanceClient
            });
          }
        } 
        // Hold-Signal (nur gelegentlich anzeigen)
        else if (signal.action === 'hold') {
          const showHold = botSettings.logging_show_hold_signals !== false;
          const holdInterval = botSettings.logging_hold_log_interval || 50;
          if (showHold && currentHistoryLength % holdInterval === 0) {
            console.log(`📊 Hold - MA${strategy.config.indicators.ma_short}: ${signal.maShort} | MA${strategy.config.indicators.ma_long}: ${signal.maLong} | Diff: ${signal.differencePercent}%`);
          }
        }
      }
      
    } catch (error) {
      // VERBESSERTE FEHLERBEHANDLUNG
      console.error('═══════════════════════════════════════════════');
      console.error('❌ Fehler beim Verarbeiten der Marktdaten');
      console.error(`   Fehler: ${error.message || error}`);
      console.error(`   Stack: ${error.stack || 'N/A'}`);
      // Logge auch die rohen Daten (begrenzt)
      if (data && data.toString) {
        const dataStr = data.toString().substring(0, 200);
        console.error(`   Empfangene Daten: ${dataStr}`);
      }
      console.error('═══════════════════════════════════════════════');
    }
  });

  ws.on('close', (code, reason) => {
    const timestamp = new Date().toISOString();
    
    // Cleanup Intervals
    if (ws._intervals) {
      clearInterval(ws._intervals.heartbeatInterval);
      clearInterval(ws._intervals.pingInterval);
    }
    
    console.log('═══════════════════════════════════════════════');
    console.log('🔌 WebSocket-Verbindung wurde geschlossen');
    console.log(`   Zeitpunkt: ${timestamp}`);
    console.log(`   Code: ${code}`);
    console.log(`   Grund: ${reason || 'Unbekannt'}`);
    console.log(`   Preis-Historie: ${priceHistory.length} Einträge`);
    console.log('═══════════════════════════════════════════════');
    
    // WICHTIG: Prüfe ob Bot manuell gestoppt wurde
    const wasManuallyStopped = botStatus === 'gestoppt';
    
    if (!wasManuallyStopped) {
      // Nur wenn NICHT manuell gestoppt, als Verbindungsverlust behandeln
      botStatus = 'gestoppt (Verbindung verloren)';
      
      // Reset
      activeStrategies = [];
      priceHistory = [];
      
      // Versuche automatisch neu zu verbinden nach 30 Sekunden
      console.log('🔄 Versuche automatische Wiederverbindung in 30 Sekunden...');
      setTimeout(() => {
        if (botStatus === 'gestoppt (Verbindung verloren)') {
          console.log('🔄 Starte automatische Wiederverbindung...');
          startTradingBot().catch(err => {
            console.error('❌ Fehler bei automatischer Wiederverbindung:', err);
          });
        }
      }, 30000);
    } else {
      // Bot wurde manuell gestoppt - keine automatische Wiederverbindung
      console.log('ℹ️  Bot wurde manuell gestoppt - Keine automatische Wiederverbindung');
    }
    
    tradingBotProcess = null;
  });

  ws.on('error', (error) => {
    const timestamp = new Date().toISOString();
    console.error('═══════════════════════════════════════════════');
    console.error('❌ WebSocket-Fehler');
    console.error(`   Zeitpunkt: ${timestamp}`);
    console.error(`   Fehler: ${error.message || error}`);
    console.error(`   Stack: ${error.stack || 'N/A'}`);
    console.error('═══════════════════════════════════════════════');
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
  
  // AUTOMATISCHER BOT-START BEIM SERVER-START
  // Warte 3 Sekunden, damit Supabase-Verbindung aufgebaut ist
  setTimeout(async () => {
    console.log('');
    console.log('🚀 Starte Trading-Bot automatisch...');
    try {
      await startTradingBot();
      console.log('✅ Bot wurde automatisch gestartet');
    } catch (error) {
      console.error('❌ Fehler beim automatischen Start:', error);
      console.log('💡 Bot kann manuell über POST /api/start-bot gestartet werden');
    }
  }, 3000);
  
  // AUTOMATISCHES NEULADEN DER EINSTELLUNGEN ALLE 5 MINUTEN
  // Starte das Interval nach 1 Minute (damit initiale Einstellungen geladen sind)
  setTimeout(() => {
    console.log('🔄 Starte Auto-Reload für Bot-Einstellungen (alle 5 Minuten)...');
    
    settingsReloadInterval = setInterval(async () => {
      await loadBotSettings(true); // silent = true für weniger Logs (loggt nur bei Änderungen)
    }, 5 * 60 * 1000); // Alle 5 Minuten
    
    // Erste Aktualisierung nach 5 Minuten
    setTimeout(async () => {
      await loadBotSettings(true);
    }, 5 * 60 * 1000);
  }, 60000); // Starte nach 1 Minute
});

