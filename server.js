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
let tradingBotProcess = new Map(); // Map<symbol, WebSocket> - Mehrere WebSocket-Verbindungen pro Symbol
let activeStrategies = [];
let priceHistories = new Map(); // Map<symbol, number[]> - Separate Preis-Historien pro Symbol
let lastSignalTimes = new Map(); // Map<symbol, number> - Signal-Cooldown pro Symbol
let lastTradeTime = 0; // Globaler Trade-Cooldown (bleibt global)
let tradesInProgress = new Map(); // Map<symbol, boolean> - Trade-Lock pro Symbol (verhindert Doppelausführungen)
let openPositions = new Map(); // Tracking offener Positionen (bereits symbol-spezifisch: ${strategy.id}_${symbol})
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
      // Normale Settings (signal_threshold_percent wird nicht mehr hier gespeichert)
      else {
        botSettings[key] = value;
      }
    });

    const newSettingsCount = Object.keys(botSettings).length;
    const newLotSizesCount = Object.keys(lotSizes).length;

    if (silent) {
      // Bei Auto-Reload: Loggen wenn sich etwas geändert hat
      const countChanged = oldSettingsCount !== newSettingsCount || oldLotSizesCount !== newLotSizesCount;
      
      if (countChanged) {
        console.log(`🔄 Einstellungen aktualisiert: ${newSettingsCount} Bot-Einstellungen, ${newLotSizesCount} Lot Sizes`);
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
      
      // KRITISCH: Korrigierte FIFO-Logik (First In First Out)
      // Jeder SELL schließt den ältesten noch offenen BUY
      // Wir müssen alle Trades chronologisch sortieren und dann paaren
      
      // Kombiniere alle Trades und sortiere chronologisch
      const allTrades = [];
      if (buyTrades) {
        buyTrades.forEach(trade => {
          allTrades.push({ ...trade, type: 'buy' });
        });
      }
      if (sellTrades) {
        sellTrades.forEach(trade => {
          allTrades.push({ ...trade, type: 'sell' });
        });
      }
      
      // Sortiere alle Trades chronologisch nach executed_at
      allTrades.sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at));
      
      // FIFO-Logik: Jeder SELL schließt den ältesten noch offenen BUY
      const openBuyTrades = [];
      let totalOpenQuantity = 0;
      let totalValue = 0;
      
      for (const trade of allTrades) {
        if (trade.type === 'buy') {
          // BUY-Trade hinzufügen
          openBuyTrades.push(trade);
          totalOpenQuantity += parseFloat(trade.quantity);
          totalValue += parseFloat(trade.price) * parseFloat(trade.quantity);
        } else if (trade.type === 'sell') {
          // SELL-Trade: Schließt den ältesten noch offenen BUY (FIFO)
          if (openBuyTrades.length === 0) {
            // KEIN BUY vorhanden - das sollte nicht passieren, aber wir loggen es
            console.warn(`⚠️  [${symbol}] SELL-Trade ohne offene BUY-Position gefunden: ${trade.order_id} @ ${trade.executed_at}`);
            await logBotEvent('warning', `SELL ohne BUY-Position gefunden`, {
              symbol: symbol,
              strategy_id: strategy.id,
              trade_id: trade.id,
              order_id: trade.order_id,
              executed_at: trade.executed_at
            });
            continue; // Überspringe diesen SELL
          }
          
          // Entferne den ältesten BUY (FIFO)
          const closedBuyTrade = openBuyTrades.shift();
          const closedQuantity = parseFloat(closedBuyTrade.quantity);
          const closedValue = parseFloat(closedBuyTrade.price) * closedQuantity;
          
          totalOpenQuantity -= closedQuantity;
          totalValue -= closedValue;
          
          // Wenn der SELL mehr verkauft als der BUY gekauft hat, müssen wir weitere BUYs schließen
          const sellQuantity = parseFloat(trade.quantity);
          let remainingSellQuantity = sellQuantity - closedQuantity;
          
          while (remainingSellQuantity > 0 && openBuyTrades.length > 0) {
            const nextBuyTrade = openBuyTrades.shift();
            const nextBuyQuantity = parseFloat(nextBuyTrade.quantity);
            const nextBuyValue = parseFloat(nextBuyTrade.price) * nextBuyQuantity;
            
            if (remainingSellQuantity >= nextBuyQuantity) {
              // Dieser BUY wird komplett geschlossen
              totalOpenQuantity -= nextBuyQuantity;
              totalValue -= nextBuyValue;
              remainingSellQuantity -= nextBuyQuantity;
            } else {
              // Nur teilweise geschlossen - wir müssen die Position anpassen
              // Für Einfachheit: Wir nehmen den ganzen BUY und passen die Menge an
              totalOpenQuantity -= remainingSellQuantity;
              totalValue -= (parseFloat(nextBuyTrade.price) * remainingSellQuantity);
              
              // Füge den verbleibenden Teil wieder hinzu
              const remainingBuyQuantity = nextBuyQuantity - remainingSellQuantity;
              openBuyTrades.unshift({
                ...nextBuyTrade,
                quantity: remainingBuyQuantity.toString()
              });
              remainingSellQuantity = 0;
            }
          }
          
          if (remainingSellQuantity > 0) {
            // Mehr verkauft als gekauft - das sollte nicht passieren
            console.warn(`⚠️  [${symbol}] SELL-Trade verkauft mehr als gekauft: ${trade.order_id} (Verkauft: ${sellQuantity}, Offen: ${totalOpenQuantity})`);
          }
        }
      }
      
      // Wenn es offene Positionen gibt, speichere sie
      if (openBuyTrades.length > 0 && totalOpenQuantity > 0) {
        const positionKey = `${strategy.id}_${symbol}`;
        
        // Berechne gewichteten Durchschnittspreis
        const weightedAveragePrice = totalValue / totalOpenQuantity;
        
        // Verwende den letzten BUY-Trade für Order-ID und Timestamp
        const lastBuyTrade = openBuyTrades[openBuyTrades.length - 1];
        
        openPositions.set(positionKey, {
          symbol: symbol,
          entryPrice: weightedAveragePrice,
          quantity: totalOpenQuantity,
          orderId: lastBuyTrade.order_id,
          timestamp: new Date(lastBuyTrade.executed_at),
          buyTradeCount: openBuyTrades.length,
          strategyId: strategy.id, // WICHTIG: Strategie-ID speichern für Validierung
          individualTrades: openBuyTrades.map(t => ({
            orderId: t.order_id,
            price: parseFloat(t.price),
            quantity: parseFloat(t.quantity),
            executedAt: t.executed_at
          }))
        });
        
        console.log(`✅ Offene Position geladen: ${positionKey}`);
        console.log(`   📊 Anzahl BUY-Trades: ${openBuyTrades.length}`);
        console.log(`   💰 Gesamtmenge: ${totalOpenQuantity.toFixed(2)}`);
        console.log(`   💵 Gewichteter Durchschnittspreis: ${weightedAveragePrice.toFixed(6)} USDT`);
        console.log(`   📈 Gesamtwert: ${totalValue.toFixed(2)} USDT`);
      } else {
        console.log(`   ✅ Keine offenen Positionen für ${symbol} (Strategie: ${strategy.id})`);
        
        // WICHTIG: Stelle sicher, dass keine Position für diese Strategie/Symbol-Kombination existiert
        const positionKey = `${strategy.id}_${symbol}`;
        if (openPositions.has(positionKey)) {
          console.log(`   🗑️  Entferne ungültige Position: ${positionKey}`);
          openPositions.delete(positionKey);
        }
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

    // Validierung: Prüfe ob alle Strategien vollständig konfiguriert sind
    const requiredSettings = ['signal_threshold_percent', 'signal_cooldown_ms', 'trade_cooldown_ms'];
    const invalidStrategies = [];
    
    strategies.forEach(strategy => {
      const missingSettings = [];
      const settings = strategy.config?.settings || {};
      
      requiredSettings.forEach(setting => {
        if (settings[setting] === undefined || settings[setting] === null) {
          missingSettings.push(setting);
        }
      });
      
      if (missingSettings.length > 0) {
        invalidStrategies.push({
          name: strategy.name,
          symbol: strategy.symbol,
          missing: missingSettings
        });
      }
    });
    
    if (invalidStrategies.length > 0) {
      console.error('');
      console.error('═══════════════════════════════════════════════');
      console.error('❌ FEHLER: Strategien nicht vollständig konfiguriert!');
      console.error('═══════════════════════════════════════════════');
      invalidStrategies.forEach(strategy => {
        console.error(`   ❌ ${strategy.name} (${strategy.symbol}):`);
        strategy.missing.forEach(setting => {
          console.error(`      - ${setting} fehlt`);
        });
      });
      console.error('');
      console.error('💡 Bitte fügen Sie die fehlenden Einstellungen zur Strategie-Config hinzu:');
      console.error('   config.settings.signal_threshold_percent');
      console.error('   config.settings.signal_cooldown_ms');
      console.error('   config.settings.trade_cooldown_ms');
      console.error('═══════════════════════════════════════════════');
      console.error('');
      
      // Entferne ungültige Strategien aus der Liste
      const validStrategies = strategies.filter(strategy => {
        const settings = strategy.config?.settings || {};
        return requiredSettings.every(setting => 
          settings[setting] !== undefined && settings[setting] !== null
        );
      });
      
      if (validStrategies.length === 0) {
        console.error('❌ Keine gültigen Strategien gefunden - Bot kann nicht starten!');
        return [];
      }
      
      console.log(`⚠️  Nur ${validStrategies.length} von ${strategies.length} Strategie(n) sind gültig`);
      strategies = validStrategies;
    }

    console.log(`✅ ${strategies.length} aktive Strategie(n) geladen:`);
    strategies.forEach(s => {
      const settings = s.config?.settings || {};
      console.log(`   📈 ${s.name} (${s.symbol})`);
      console.log(`      Threshold: ${settings.signal_threshold_percent || 'N/A'}%`);
      console.log(`      Signal Cooldown: ${settings.signal_cooldown_ms || 'N/A'}ms`);
      console.log(`      Trade Cooldown: ${settings.trade_cooldown_ms || 'N/A'}ms`);
    });

    return strategies;
  } catch (error) {
    console.error('❌ Fehler:', error);
    return [];
  }
}

/**
 * Berechnet den Moving Average für eine bestimmte Periode
 * @param {number[]} priceHistory - Die Preis-Historie für das Symbol
 * @param {number} period - Die Periode für den Moving Average
 */
function calculateMA(priceHistory, period) {
  if (!priceHistory || priceHistory.length < period) {
    return null;
  }

  const slice = priceHistory.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Generiert Trading-Signale basierend auf MA Crossover
 * @param {number} currentPrice - Der aktuelle Preis
 * @param {Object} strategy - Die Trading-Strategie
 * @param {number[]} priceHistory - Die symbol-spezifische Preis-Historie
 */
function generateSignal(currentPrice, strategy, priceHistory) {
  const config = strategy.config;
  const maShortPeriod = config.indicators.ma_short || 20;
  const maLongPeriod = config.indicators.ma_long || 50;

  // Prüfen ob genug Daten vorhanden
  if (!priceHistory || priceHistory.length < maLongPeriod) {
    return {
      action: 'wait',
      reason: `Sammle Daten... ${priceHistory ? priceHistory.length : 0}/${maLongPeriod}`,
      progress: Math.round(((priceHistory ? priceHistory.length : 0) / maLongPeriod) * 100)
    };
  }

  const maShort = calculateMA(priceHistory, maShortPeriod);
  const maLong = calculateMA(priceHistory, maLongPeriod);

  if (!maShort || !maLong) {
    return null;
  }

  const difference = maShort - maLong;
  const differencePercent = (difference / maLong) * 100;

  // Threshold aus Strategie-Config (MUSS vorhanden sein!)
  const threshold = strategy.config.settings?.signal_threshold_percent;
  if (threshold === undefined || threshold === null) {
    console.error(`❌ FEHLER: signal_threshold_percent nicht in Strategie ${strategy.name} (${strategy.symbol}) konfiguriert!`);
    console.error(`   Bitte fügen Sie 'settings.signal_threshold_percent' zur Strategie-Config hinzu.`);
    return {
      action: 'error',
      reason: `Konfigurationsfehler: signal_threshold_percent fehlt in Strategie ${strategy.name}`
    };
  }

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
 * @param {number} currentPrice - Der aktuelle Preis
 * @param {Object} strategy - Die Trading-Strategie
 */
function analyzePrice(currentPrice, strategy) {
  const symbol = strategy.symbol;
  
  // Hole oder erstelle symbol-spezifische Preis-Historie
  if (!priceHistories.has(symbol)) {
    priceHistories.set(symbol, []);
  }
  const priceHistory = priceHistories.get(symbol);
  
  // Preis zur Historie hinzufügen
  priceHistory.push(parseFloat(currentPrice));

  // Historie begrenzen (aus Supabase oder Fallback 100)
  const maxPriceHistory = botSettings.max_price_history || 100;
  if (priceHistory.length > maxPriceHistory) {
    priceHistory.shift();
  }

  // Signal generieren mit symbol-spezifischer Historie
  return generateSignal(currentPrice, strategy, priceHistory);
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
 * Berechnet das Gesamt-Exposure über alle offenen Positionen
 * @returns {number} Gesamt-Exposure in USDT
 */
function calculateTotalExposure() {
  let total = 0;
  openPositions.forEach((position) => {
    total += position.entryPrice * position.quantity;
  });
  return total;
}

/**
 * Prüft ob Trading erlaubt ist
 * @param {Object} signal - Das Trading-Signal
 * @param {Object} strategy - Die Trading-Strategie
 * @returns {Object} { allowed: boolean, reason: string }
 */
async function canTrade(signal, strategy) {
  const symbol = strategy.symbol; // WICHTIG: Symbol aus Strategie, nicht global!
  
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

  // Trade Cooldown prüfen (aus Strategie-Config)
  const now = Date.now();
  const tradeCooldown = strategy.config.settings?.trade_cooldown_ms;
  if (tradeCooldown === undefined || tradeCooldown === null) {
    console.error(`❌ FEHLER: trade_cooldown_ms nicht in Strategie ${strategy.name} konfiguriert!`);
    return { allowed: false, reason: 'Konfigurationsfehler: trade_cooldown_ms fehlt' };
  }
  const cooldownRemaining = tradeCooldown - (now - lastTradeTime);
  
  if (cooldownRemaining > 0) {
    const waitTime = Math.round(cooldownRemaining / 1000);
    const reason = `Trade Cooldown aktiv - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`;
    console.log(`⏳ TRADE COOLDOWN AKTIV - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`);
    return { allowed: false, reason: reason };
  }

  // NEU: Gesamt-Exposure prüfen
  const totalExposure = calculateTotalExposure();
  const maxTotalExposure = botSettings.max_total_exposure_usdt || 1000;
  if (totalExposure >= maxTotalExposure) {
    const reason = `Max Total Exposure erreicht: ${totalExposure.toFixed(2)} USDT (Limit: ${maxTotalExposure} USDT)`;
    console.log(`⚠️  ${reason}`);
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

  // NEU: Prüfe ob Trade für dieses Symbol bereits läuft (verhindert Doppelausführungen)
  if (tradesInProgress.get(symbol)) {
    const reason = `Trade für ${symbol} läuft bereits - Warte auf Abschluss`;
    console.log(`🔒 ${reason}`);
    return { allowed: false, reason: reason };
  }

  // Bei BUY: Prüfen ob bereits eine offene Position existiert (verhindert mehrfache Käufe)
  if (signal.action === 'buy') {
    const positionKey = `${strategy.id}_${symbol}`;
    if (openPositions.has(positionKey)) {
      const reason = `Bereits eine offene Position vorhanden: ${positionKey} - Kein weiterer Kauf möglich`;
      console.log(`⚠️  ${reason}`);
      await logBotEvent('warning', `BUY-Signal ignoriert: Bereits offene Position`, {
        positionKey: positionKey,
        symbol: symbol,
        strategy_id: strategy.id
      });
      return { allowed: false, reason: reason };
    }
  }

  // Bei SELL: Prüfen ob offene Position existiert
  if (signal.action === 'sell') {
    const positionKey = `${strategy.id}_${symbol}`;
    
    // KRITISCH: Prüfe ob Position existiert UND ob sie zu dieser Strategie gehört
    if (!openPositions.has(positionKey)) {
      const reason = `Keine offene Position zum Verkaufen: ${positionKey}`;
      console.log(`⚠️  KEINE OFFENE POSITION ZUM VERKAUFEN: ${positionKey}`);
      console.log(`   Strategie: ${strategy.name} (ID: ${strategy.id})`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Aktuelle offene Positionen: ${Array.from(openPositions.keys()).join(', ') || 'Keine'}`);
      
      // Zeige alle offenen Positionen für Debugging
      if (openPositions.size > 0) {
        console.log(`   📊 Details der offenen Positionen:`);
        openPositions.forEach((pos, key) => {
          console.log(`      ${key}: ${pos.quantity.toFixed(2)} @ ${pos.entryPrice.toFixed(6)} USDT (Strategie-ID: ${pos.strategyId || 'N/A'})`);
        });
      }
      
      await logBotEvent('warning', `SELL-Signal ignoriert: Keine offene Position`, {
        positionKey: positionKey,
        openPositions: Array.from(openPositions.keys()),
        symbol: symbol,
        strategy_id: strategy.id,
        strategy_name: strategy.name
      });
      return { allowed: false, reason: reason };
    }
    
    // Zusätzliche Validierung: Stelle sicher, dass die Position zu dieser Strategie gehört
    const position = openPositions.get(positionKey);
    if (position.strategyId && position.strategyId !== strategy.id) {
      const reason = `Position gehört zu einer anderen Strategie: ${positionKey} (Position-Strategie: ${position.strategyId}, Aktuelle Strategie: ${strategy.id})`;
      console.error(`❌ ${reason}`);
      await logBotEvent('error', `SELL-Signal abgelehnt: Position gehört zu anderer Strategie`, {
        positionKey: positionKey,
        positionStrategyId: position.strategyId,
        currentStrategyId: strategy.id,
        symbol: symbol
      });
      return { allowed: false, reason: reason };
    }
    
    // KRITISCH: Position SOFORT entfernen, um Race-Conditions zu vermeiden!
    // Wenn mehrere SELL-Signale gleichzeitig kommen, wird nur der erste ausgeführt
    openPositions.delete(positionKey); // SOFORT löschen, bevor Trade ausgeführt wird
    console.log(`📊 Position reserviert für SELL: ${positionKey} @ ${position.entryPrice.toFixed(6)} USDT`);
    console.log(`   Menge: ${position.quantity.toFixed(2)}`);
    console.log(`   Entry Price: ${position.entryPrice.toFixed(6)} USDT`);
    
    // Position-Daten an Signal anhängen, damit sie später verwendet werden können
    signal._positionData = position;
  }

  return { allowed: true, reason: 'OK' };
}

/**
 * Führt einen Trade auf Binance Testnet aus
 */
async function executeTrade(signal, strategy) {
  const symbol = strategy.symbol; // WICHTIG: Symbol aus Strategie, nicht global!
  
  // KRITISCH: Lock prüfen BEVOR irgendwelche Checks gemacht werden (pro Symbol)
  // Dies verhindert, dass mehrere Trades für dasselbe Symbol gleichzeitig ausgeführt werden
  if (tradesInProgress.get(symbol)) {
    console.log(`🔒 Trade-Ausführung für ${symbol} läuft bereits - Signal wird ignoriert: ${signal.action.toUpperCase()}`);
    return null;
  }

  try {
    // Trading-Checks ZUERST durchführen
    const tradeCheck = await canTrade(signal, strategy);
    if (!tradeCheck.allowed) {
      // Logge warum Trade nicht ausgeführt wird
      console.log(`⚠️  Trade nicht ausgeführt: ${tradeCheck.reason}`);
      return null;
    }

    // KRITISCH: Lock UND Cooldown SOFORT setzen, NACHDEM alle Checks bestanden wurden
    // Dies verhindert, dass mehrere Signale gleichzeitig die Checks bestehen
    tradesInProgress.set(symbol, true); // Lock pro Symbol
    lastTradeTime = Date.now(); // Globaler Cooldown bleibt

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🔄 FÜHRE ${signal.action.toUpperCase()}-ORDER AUS`);
    console.log('═══════════════════════════════════════════════');

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

    // Durchschnittspreis berechnen
    const avgPrice = order.fills && order.fills.length > 0
      ? order.fills.reduce((sum, fill) => sum + parseFloat(fill.price), 0) / order.fills.length
      : parseFloat(signal.price);

    const executedQty = parseFloat(order.executedQty);
    
    console.log(`✅ Order ausgeführt!`);
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Ausgeführte Menge: ${executedQty}`);
    console.log(`   Durchschnittspreis: ${avgPrice.toFixed(6)} USDT`);
    console.log('═══════════════════════════════════════════════');
    console.log('');

    // Position tracking
    const positionKey = `${strategy.id}_${symbol}`;
    if (side === 'BUY') {
      // Prüfe ob bereits eine Position existiert (sollte nicht passieren, aber sicherheitshalber)
      if (openPositions.has(positionKey)) {
        console.warn(`⚠️  Position ${positionKey} existiert bereits - überschreibe mit neuer Position`);
        await logBotEvent('warning', `Position überschrieben bei BUY`, {
          positionKey: positionKey,
          symbol: symbol,
          strategy_id: strategy.id
        });
      }
      
      openPositions.set(positionKey, {
        symbol: symbol,
        entryPrice: avgPrice, // Verwende tatsächlichen Durchschnittspreis statt signal.price
        quantity: quantity,
        orderId: order.orderId,
        timestamp: new Date(),
        strategyId: strategy.id // WICHTIG: Strategie-ID speichern für Validierung
      });
      console.log(`📊 Position geöffnet: ${positionKey} @ ${avgPrice.toFixed(6)} USDT`);
      console.log(`   Menge: ${quantity.toFixed(2)}`);
      console.log(`   Strategie: ${strategy.name} (ID: ${strategy.id})`);
      await logBotEvent('info', `Position geöffnet: ${symbol}`, {
        positionKey: positionKey,
        entryPrice: avgPrice,
        quantity: quantity,
        orderId: order.orderId.toString(),
        strategy_id: strategy.id,
        strategy_name: strategy.name
      });
    } else {
      // Bei SELL: Position wurde bereits in canTrade() gelöscht (Race-Condition-Schutz)
      // Verwende die Position-Daten aus dem Signal
      const closedPosition = signal._positionData;
      if (closedPosition) {
        // Zusätzliche Validierung: Stelle sicher, dass die Position wirklich geschlossen wurde
        if (openPositions.has(positionKey)) {
          console.error(`❌ KRITISCHER FEHLER: Position ${positionKey} existiert noch nach SELL!`);
          await logBotEvent('error', `Position existiert noch nach SELL`, {
            positionKey: positionKey,
            symbol: symbol,
            strategy_id: strategy.id
          });
          // Entferne die Position jetzt (sollte nicht passieren)
          openPositions.delete(positionKey);
        }
        
        console.log(`📊 Position geschlossen: ${positionKey} (Entry: ${closedPosition.entryPrice.toFixed(6)} USDT, Exit: ${avgPrice.toFixed(6)} USDT)`);
        console.log(`   Menge: ${executedQty.toFixed(2)}`);
        console.log(`   Strategie: ${strategy.name} (ID: ${strategy.id})`);
        await logBotEvent('info', `Position geschlossen: ${symbol}`, {
          positionKey: positionKey,
          entryPrice: closedPosition.entryPrice,
          exitPrice: avgPrice,
          quantity: executedQty,
          strategy_id: strategy.id,
          strategy_name: strategy.name
        });
      } else {
        console.error(`❌ KRITISCHER FEHLER: Keine Position-Daten für SELL gefunden: ${positionKey}`);
        await logBotEvent('error', `Keine Position-Daten für SELL`, {
          positionKey: positionKey,
          symbol: symbol,
          strategy_id: strategy.id
        });
      }
    }

    // Trade in Datenbank speichern
    await saveTradeToDatabase(order, signal, strategy);

    // Cooldown wurde bereits oben gesetzt - hier nur Lock freigeben (pro Symbol)
    tradesInProgress.set(symbol, false);

    return order;

  } catch (error) {
    // WICHTIG: Lock IMMER freigeben, auch bei Fehlern! (pro Symbol)
    tradesInProgress.set(symbol, false);
    console.error('');
    console.error('═══════════════════════════════════════════════');
    console.error('❌ ORDER FEHLGESCHLAGEN');
    console.error('═══════════════════════════════════════════════');
    console.error(`Fehler: ${error.message}`);
    console.error(`Code: ${error.code || 'N/A'}`);
    console.error(`Symbol: ${symbol}`);
    console.error('═══════════════════════════════════════════════');
    console.error('');

    // WICHTIG: Bei SELL-Fehler Position wiederherstellen!
    if (signal.action === 'sell' && signal._positionData) {
      const positionKey = `${strategy.id}_${symbol}`;
      openPositions.set(positionKey, signal._positionData);
      console.log(`🔄 Position wiederhergestellt nach fehlgeschlagenem SELL: ${positionKey}`);
      await logBotEvent('warning', `Position wiederhergestellt nach fehlgeschlagenem SELL`, {
        positionKey: positionKey,
        error: error.message,
        errorCode: error.code,
        strategy_id: strategy.id,
        symbol: symbol
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
    const symbol = strategy.symbol; // WICHTIG: Symbol aus Strategie, nicht global!
    
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
        symbol: symbol,
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
        symbol: symbol
      });
    } else {
      // WICHTIG: Deutliches Logging für Render-Logs
      console.log('═══════════════════════════════════════════════');
      console.log('✅ TRADE IN DATENBANK GESPEICHERT');
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Side: ${signal.action.toUpperCase()}`);
      console.log(`   Preis: ${avgPrice} USDT`);
      console.log(`   Menge: ${executedQty}`);
      console.log(`   Order ID: ${order.orderId}`);
      console.log('═══════════════════════════════════════════════');
      
      await logBotEvent('info', `Trade in Datenbank gespeichert: ${signal.action.toUpperCase()}`, {
        symbol: symbol,
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
          symbol: symbol,
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
 * Erstellt eine WebSocket-Verbindung für ein Symbol
 * @param {string} symbol - Das Trading-Symbol (z.B. 'BTCUSDT')
 * @param {Array} strategies - Die Strategien für dieses Symbol
 */
async function createWebSocketConnection(symbol, strategies) {
  // Prüfe ob Verbindung bereits existiert
  if (tradingBotProcess.has(symbol)) {
    console.log(`⚠️  WebSocket für ${symbol} existiert bereits`);
    return;
  }
  
  // WebSocket URL aus Supabase oder Fallback
  const wsKey = `websocket_${symbol}`;
  const binanceWsUrl = botSettings[wsKey] 
    ? botSettings[wsKey].replace(/"/g, '') // Entferne Anführungszeichen
    : `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;
  
  console.log(`🔌 Verbinde zu ${symbol}: ${binanceWsUrl} (${strategies.length} Strategie(n))`);
  
  // Preis-Historie initialisieren
  if (!priceHistories.has(symbol)) {
    priceHistories.set(symbol, []);
  }
  
  const ws = new WebSocket(binanceWsUrl);
  tradingBotProcess.set(symbol, ws);

  // WebSocket Event-Handler
  ws.on('open', () => {
    console.log(`✅ Verbindung zu ${symbol} erfolgreich hergestellt`);
    
    // Heartbeat-Log alle 5 Minuten
    const heartbeatInterval = setInterval(() => {
      if (tradingBotProcess.has(symbol) && ws.readyState === WebSocket.OPEN) {
        const priceHistory = priceHistories.get(symbol) || [];
        const now = new Date().toISOString();
        console.log(`💓 Heartbeat [${symbol}]: ${now} | Preis-Historie: ${priceHistory.length} | WS-State: ${ws.readyState}`);
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 5 * 60 * 1000); // Alle 5 Minuten
    
    // Ping alle 30 Sekunden
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    // Speichere Interval-IDs für Cleanup
    ws._intervals = { heartbeatInterval, pingInterval };
    
    ws.on('pong', () => {
      // Verbindung ist aktiv
    });
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (!message.p) {
        if (Math.random() < 0.01) {
          console.log(`⚠️  [${symbol}] Nachricht ohne Preis empfangen: ${JSON.stringify(message).substring(0, 100)}`);
        }
        return;
      }
      
      const currentPrice = parseFloat(message.p);
      const quantity = parseFloat(message.q || 0);
      
      if (isNaN(currentPrice) || currentPrice <= 0) {
        console.error(`❌ [${symbol}] Ungültiger Preis empfangen: ${message.p}`);
        return;
      }

      // WICHTIG: Nur Strategien für dieses Symbol verarbeiten!
      const strategiesForSymbol = strategies.filter(s => s.symbol === symbol);
      
      if (strategiesForSymbol.length === 0) {
        return;
      }
      
      // Hole symbol-spezifische Preis-Historie
      const priceHistory = priceHistories.get(symbol) || [];
      const currentHistoryLength = priceHistory.length;
      
      // Debug: Zeige alle 1000 Preise
      if (currentHistoryLength % 1000 === 0 && currentHistoryLength > 0) {
        console.log(`📡 [${symbol}] Daten empfangen: ${currentHistoryLength} Preise verarbeitet`);
        await logBotEvent('debug', `Datenfluss: ${currentHistoryLength} Preise verarbeitet`, {
          symbol: symbol,
          priceCount: currentHistoryLength
        });
      }
      
      // Preis anzeigen
      const priceLogInterval = botSettings.logging_price_log_interval || 10;
      if (currentHistoryLength % priceLogInterval === 0) {
        const priceDecimals = currentPrice < 1 ? 6 : 2;
        console.log(`💰 ${symbol}: ${currentPrice.toFixed(priceDecimals)} USDT | Vol: ${quantity.toFixed(2)}`);
      }

      // Für jede Strategie dieses Symbols verarbeiten
      for (const strategy of strategiesForSymbol) {
        const signal = analyzePrice(currentPrice, strategy);
        
        if (!signal) continue;
        
        // Fehler-Signal behandeln
        if (signal.action === 'error') {
          console.error(`❌ [${symbol}] Signal-Generierung fehlgeschlagen: ${signal.reason}`);
          continue;
        }

        // Fortschritt anzeigen während Datensammlung
        if (signal.action === 'wait') {
          const showProgress = botSettings.logging_show_data_progress !== false;
          if (showProgress && currentHistoryLength % 20 === 0) {
            console.log(`📊 [${symbol}] ${signal.reason} (${signal.progress}%)`);
          }
          continue;
        }

        // Kauf- oder Verkauf-Signal
        if (signal.action === 'buy' || signal.action === 'sell') {
          // Signal-Cooldown prüfen (pro Symbol, aus Strategie-Config)
          const now = Date.now();
          const lastSignalTime = lastSignalTimes.get(symbol) || 0;
          const signalCooldown = strategy.config.settings?.signal_cooldown_ms;
          if (signalCooldown === undefined || signalCooldown === null) {
            console.error(`❌ FEHLER: signal_cooldown_ms nicht in Strategie ${strategy.name} konfiguriert!`);
            continue;
          }
          const signalCooldownRemaining = signalCooldown - (now - lastSignalTime);
          
          if (signalCooldownRemaining > 0) {
            const verbose = botSettings.logging_verbose === true;
            if (verbose) {
              console.log(`⏳ [${symbol}] Signal Cooldown aktiv: ${Math.round(signalCooldownRemaining / 1000)}s`);
            }
            continue;
          }

          // Signal-Cooldown ist abgelaufen - Signal verarbeiten
          console.log('');
          console.log('═══════════════════════════════════════════════');
          console.log(`🎯 TRADING SIGNAL [${symbol}]: ${signal.action.toUpperCase()}`);
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

          // Cooldown setzen (pro Symbol)
          lastSignalTimes.set(symbol, now);

          // Order ausführen (wenn aktiviert)
          if (tradingEnabled && binanceClient) {
            console.log(`🔄 [${symbol}] Versuche Trade auszuführen: ${signal.action.toUpperCase()} @ ${signal.price} USDT`);
            await logBotEvent('info', `Trade-Ausführung gestartet: ${signal.action.toUpperCase()}`, {
              action: signal.action,
              price: signal.price,
              symbol: symbol,
              strategy_id: strategy.id
            });
            
            const tradeResult = await executeTrade(signal, strategy);
            
            if (tradeResult) {
              console.log(`✅ [${symbol}] Trade erfolgreich ausgeführt: ${signal.action.toUpperCase()} @ ${signal.price} USDT`);
              await logBotEvent('info', `Trade erfolgreich ausgeführt: ${signal.action.toUpperCase()}`, {
                action: signal.action,
                price: signal.price,
                symbol: symbol,
                orderId: tradeResult.orderId,
                strategy_id: strategy.id
              });
              // WICHTIG: Nach erfolgreichem Trade brechen wir ab, um Doppelausführungen zu vermeiden
              break;
            } else {
              console.log(`⚠️  [${symbol}] Trade nicht ausgeführt (Cooldown oder andere Checks)`);
            }
          } else {
            console.log(`💡 [${symbol}] Trading deaktiviert - Nur Signal-Generierung`);
          }
        } 
        // Hold-Signal
        else if (signal.action === 'hold') {
          const showHold = botSettings.logging_show_hold_signals !== false;
          const holdInterval = botSettings.logging_hold_log_interval || 50;
          if (showHold && currentHistoryLength % holdInterval === 0) {
            console.log(`📊 [${symbol}] Hold - MA${strategy.config.indicators.ma_short}: ${signal.maShort} | MA${strategy.config.indicators.ma_long}: ${signal.maLong} | Diff: ${signal.differencePercent}%`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ [${symbol}] Fehler beim Verarbeiten der Marktdaten:`, error.message);
      console.error(`   Stack: ${error.stack || 'N/A'}`);
    }
  });

  ws.on('close', (code, reason) => {
    const timestamp = new Date().toISOString();
    
    // Cleanup Intervals
    if (ws._intervals) {
      clearInterval(ws._intervals.heartbeatInterval);
      clearInterval(ws._intervals.pingInterval);
    }
    
    console.log(`🔌 [${symbol}] WebSocket-Verbindung geschlossen`);
    console.log(`   Zeitpunkt: ${timestamp}`);
    console.log(`   Code: ${code}`);
    console.log(`   Grund: ${reason || 'Unbekannt'}`);
    
    tradingBotProcess.delete(symbol);
    
    // Auto-Reconnect nach 30 Sekunden (nur wenn Bot nicht manuell gestoppt wurde)
    if (botStatus !== 'gestoppt') {
      console.log(`🔄 [${symbol}] Versuche automatische Wiederverbindung in 30 Sekunden...`);
      setTimeout(() => {
        if (!tradingBotProcess.has(symbol) && botStatus !== 'gestoppt') {
          const currentStrategies = activeStrategies.filter(s => s.symbol === symbol);
          if (currentStrategies.length > 0) {
            createWebSocketConnection(symbol, currentStrategies);
          }
        }
      }, 30000);
    }
  });

  ws.on('error', (error) => {
    console.error(`❌ [${symbol}] WebSocket-Fehler:`, error.message);
    tradingBotProcess.delete(symbol);
  });
}

/**
 * Startet den Trading-Bot
 * - Lädt Strategien von Supabase
 * - Erstellt WebSocket-Verbindungen für alle aktiven Symbole
 * - Verarbeitet Live-Marktdaten parallel
 */
async function startTradingBot() {
  // Prüfen, ob Bot bereits läuft
  if (tradingBotProcess.size > 0) {
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

  // NEU: Eindeutige Symbole ermitteln
  const uniqueSymbols = [...new Set(activeStrategies.map(s => s.symbol))];
  console.log(`🔌 Erstelle ${uniqueSymbols.length} WebSocket-Verbindung(en) für ${activeStrategies.length} Strategie(n)...`);
  
  // Gruppiere Strategien nach Symbol
  const strategiesBySymbol = new Map();
  activeStrategies.forEach(strategy => {
    if (!strategiesBySymbol.has(strategy.symbol)) {
      strategiesBySymbol.set(strategy.symbol, []);
    }
    strategiesBySymbol.get(strategy.symbol).push(strategy);
  });
  
  // Erstelle eine WebSocket-Verbindung pro Symbol
  for (const [symbol, symbolStrategies] of strategiesBySymbol.entries()) {
    console.log(`   📊 ${symbol}: ${symbolStrategies.length} Strategie(n)`);
    await createWebSocketConnection(symbol, symbolStrategies);
  }
  
  botStatus = 'läuft';
  console.log(`✅ Bot läuft mit ${uniqueSymbols.length} Symbol(en) und ${activeStrategies.length} Strategie(n)`);
}

/**
 * Stoppt den Trading-Bot
 * - Schließt alle WebSocket-Verbindungen
 * - Setzt Status zurück
 */
function stopTradingBot() {
  if (tradingBotProcess.size === 0) {
    console.log('ℹ️  Bot läuft nicht');
    return;
  }

  console.log('🛑 Stoppe Trading-Bot...');
  
  // Alle WebSocket-Verbindungen schließen
  tradingBotProcess.forEach((ws, symbol) => {
    console.log(`🔌 Schließe Verbindung zu ${symbol}...`);
    // Cleanup Intervals
    if (ws._intervals) {
      clearInterval(ws._intervals.heartbeatInterval);
      clearInterval(ws._intervals.pingInterval);
    }
    ws.close();
  });
  
  tradingBotProcess.clear();
  priceHistories.clear();
  lastSignalTimes.clear();
  tradesInProgress.clear();
  activeStrategies = [];
  lastTradeTime = 0;
  
  botStatus = 'gestoppt';
  
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

