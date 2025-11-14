// Imports
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const Binance = require('binance-api-node').default;
const ccxt = require('ccxt');

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

/**
 * POST /api/backtest
 * Führt ein Backtesting für eine Strategie durch
 */
app.post('/api/backtest', async (req, res) => {
  try {
    const { strategyId, symbol, startDate, endDate, timeframe = '1h' } = req.body;

    if (!strategyId || !symbol) {
      return res.status(400).json({
        success: false,
        message: 'strategyId und symbol sind erforderlich'
      });
    }

    // Lade Strategie aus Supabase
    const { data: strategy, error: strategyError } = await supabase
      .from('strategies')
      .select('*')
      .eq('id', strategyId)
      .single();

    if (strategyError || !strategy) {
      return res.status(404).json({
        success: false,
        message: 'Strategie nicht gefunden'
      });
    }

    // Führe Backtest durch
    const results = await runBacktest(strategy, symbol, startDate, endDate, timeframe);

    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error('Fehler beim Backtesting:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Backtesting',
      error: error.message
    });
  }
});

/**
 * GET /api/strategy-performance
 * Gibt Performance-Metriken für alle Strategien zurück
 */
app.get('/api/strategy-performance', async (req, res) => {
  try {
    const performance = await calculateStrategyPerformance();
    res.json({
      success: true,
      performance: performance
    });
  } catch (error) {
    console.error('Fehler beim Laden der Performance:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Performance',
      error: error.message
    });
  }
});

/**
 * Gibt alle Strategien zurück
 */
app.get('/api/strategies', async (req, res) => {
  try {
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .order('symbol', { ascending: true });

    if (error) throw error;

    // Erweitere Strategien mit Performance-Daten
    const strategiesWithPerf = await Promise.all(strategies.map(async (strategy) => {
      const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategy.id);
      
      const totalTrades = trades?.length || 0;
      const profitableTrades = trades?.filter(t => t.pnl && t.pnl > 0).length || 0;
      const totalPnl = trades?.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0;
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

      return {
        ...strategy,
        total_trades: totalTrades,
        profitable_trades: profitableTrades,
        total_pnl: totalPnl,
        win_rate: winRate
      };
    }));

    res.json({ 
      success: true, 
      strategies: strategiesWithPerf 
    });
  } catch (error) {
    console.error('Fehler beim Laden der Strategien:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Strategien',
      error: error.message
    });
  }
});

/**
 * Aktualisiert eine Strategie
 */
app.put('/api/strategies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: strategy, error } = await supabase
      .from('strategies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      strategy 
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Strategie:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Aktualisieren der Strategie',
      error: error.message
    });
  }
});

/**
 * Toggle Strategie aktiv/inaktiv
 */
app.patch('/api/strategies/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const { data: strategy, error } = await supabase
      .from('strategies')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      strategy 
    });
  } catch (error) {
    console.error('Fehler beim Toggle der Strategie:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Toggle der Strategie',
      error: error.message
    });
  }
});

/**
 * Gibt Trades zurück
 */
app.get('/api/trades', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({ 
      success: true, 
      trades: trades || []
    });
  } catch (error) {
    console.error('Fehler beim Laden der Trades:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Trades',
      error: error.message
    });
  }
});

/**
 * Gibt offene Positionen zurück
 * WICHTIG: Berechnet Positionen aus der Datenbank (BUY ohne entsprechenden SELL)
 * Nicht nur aus der in-memory Map, sondern immer aktuell aus der DB
 */
app.get('/api/positions', async (req, res) => {
  try {
    // Lade ALLE Strategien (nicht nur aktive), um alle offenen Positionen zu finden
    const { data: allStrategies, error: strategiesError } = await supabase
      .from('strategies')
      .select('id, symbol, name');
    
    if (strategiesError) {
      console.error('Fehler beim Laden der Strategien:', strategiesError);
      throw strategiesError;
    }
    
    const allPositions = [];
    
    // Für jede Strategie prüfen, ob es offene Positionen gibt
    for (const strategy of (allStrategies || [])) {
      const symbol = strategy.symbol;
      
      // Lade alle BUY-Trades chronologisch sortiert
      const { data: buyTrades, error: buyError } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategy.id)
        .eq('symbol', symbol)
        .eq('side', 'buy')
        .eq('status', 'executed')
        .order('executed_at', { ascending: true });
      
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
        .order('executed_at', { ascending: true });
      
      if (sellError) {
        console.error(`❌ Fehler beim Laden der SELL-Trades für ${symbol}:`, sellError);
        continue;
      }
      
      // KRITISCH: FIFO-Logik - Alle Trades chronologisch sortieren
      // Jeder SELL schließt den ältesten noch offenen BUY (First In First Out)
      
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
      allTrades.sort((a, b) => {
        const dateA = new Date(a.executed_at || a.created_at);
        const dateB = new Date(b.executed_at || b.created_at);
        return dateA - dateB;
      });
      
      // FIFO-Logik: Jeder SELL schließt den ältesten noch offenen BUY
      const openBuyTrades = [];
      
      for (const trade of allTrades) {
        if (trade.type === 'buy') {
          // BUY-Trade hinzufügen
          openBuyTrades.push({
            ...trade,
            remainingQuantity: parseFloat(trade.quantity)
          });
        } else if (trade.type === 'sell') {
          // SELL-Trade: Schließt den ältesten noch offenen BUY (FIFO)
          const sellQuantity = parseFloat(trade.quantity);
          let remainingSellQuantity = sellQuantity;
          
          // Schließe BUY-Trades mit FIFO-Logik
          while (remainingSellQuantity > 0 && openBuyTrades.length > 0) {
            const oldestBuyTrade = openBuyTrades[0];
            const buyRemainingQuantity = oldestBuyTrade.remainingQuantity;
            
            if (remainingSellQuantity >= buyRemainingQuantity) {
              // Dieser BUY wird komplett geschlossen
              openBuyTrades.shift(); // Entferne den ältesten BUY
              remainingSellQuantity -= buyRemainingQuantity;
            } else {
              // Nur teilweise geschlossen - reduziere die Menge
              oldestBuyTrade.remainingQuantity -= remainingSellQuantity;
              remainingSellQuantity = 0;
            }
          }
          
          if (remainingSellQuantity > 0) {
            // Mehr verkauft als gekauft - das sollte nicht passieren
            console.warn(`⚠️  [${symbol}] SELL-Trade verkauft mehr als gekauft: ${trade.order_id} (Verkauft: ${sellQuantity}, Verbleibend: ${remainingSellQuantity})`);
          }
        }
      }
      
      // Wenn es offene Positionen gibt, berechne gewichteten Durchschnittspreis
      if (openBuyTrades.length > 0) {
        let totalValue = 0;
        let totalQuantity = 0;
        
        for (const trade of openBuyTrades) {
          const qty = trade.remainingQuantity || parseFloat(trade.quantity);
          const price = parseFloat(trade.price);
          totalValue += qty * price;
          totalQuantity += qty;
        }
        
        if (totalQuantity > 0) {
          const weightedAveragePrice = totalValue / totalQuantity;
          
          // Hole aktuellen Preis von Binance (falls verfügbar)
          let currentPrice = weightedAveragePrice; // Fallback
          try {
            if (binanceClient) {
              const ticker = await binanceClient.prices({ symbol: symbol });
              currentPrice = parseFloat(ticker[symbol]) || weightedAveragePrice;
            }
          } catch (error) {
            console.warn(`⚠️  Konnte aktuellen Preis für ${symbol} nicht laden:`, error.message);
          }
          
          const pnl = (currentPrice - weightedAveragePrice) * totalQuantity;
          const pnlPercent = weightedAveragePrice > 0 
            ? ((currentPrice - weightedAveragePrice) / weightedAveragePrice) * 100 
            : 0;
          
          allPositions.push({
            id: `${strategy.id}_${symbol}`,
            symbol: symbol,
            quantity: totalQuantity,
            entryPrice: weightedAveragePrice,
            currentPrice: currentPrice,
            pnl: pnl,
            pnlPercent: pnlPercent,
            strategyId: strategy.id,
            strategyName: strategy.name,
            createdAt: openBuyTrades[0].executed_at || openBuyTrades[0].created_at
          });
        }
      }
    }

    res.json({ 
      success: true, 
      positions: allPositions 
    });
  } catch (error) {
    console.error('Fehler beim Laden der Positionen:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Positionen',
      error: error.message
    });
  }
});

/**
 * Gibt Performance-Metriken zurück
 */
app.get('/api/performance', async (req, res) => {
  try {
    // Lade alle Trades
    const { data: allTrades, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Berechne Metriken
    const trades = allTrades || [];
    const totalTrades = trades.length;
    const profitableTrades = trades.filter(t => t.pnl && t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl && t.pnl < 0);
    
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (profitableTrades.length / totalTrades) * 100 : 0;
    
    const avgWin = profitableTrades.length > 0 
      ? profitableTrades.reduce((sum, t) => sum + t.pnl, 0) / profitableTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;

    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Berechne heute PnL
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = trades.filter(t => new Date(t.created_at) >= today);
    const todayPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Berechne Max Drawdown (vereinfacht)
    let runningPnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    trades.reverse().forEach(trade => {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) peak = runningPnL;
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

    res.json({
      success: true,
      performance: {
        totalPnL,
        todayPnL,
        weekPnL: totalPnL * 0.3, // Placeholder - sollte richtig berechnet werden
        monthPnL: totalPnL * 0.7, // Placeholder - sollte richtig berechnet werden
        totalTrades,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        maxDrawdown: maxDrawdownPercent
      }
    });
  } catch (error) {
    console.error('Fehler beim Berechnen der Performance:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Berechnen der Performance',
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════

function formatDuration(createdAt) {
  const start = new Date(createdAt).getTime();
  const duration = Date.now() - start;
  
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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
 * Berechnet den RSI (Relative Strength Index)
 * @param {number[]} priceHistory - Die Preis-Historie
 * @param {number} period - RSI-Periode (Standard: 14)
 * @returns {number|null} RSI-Wert zwischen 0 und 100
 */
function calculateRSI(priceHistory, period = 14) {
  if (!priceHistory || priceHistory.length < period + 1) {
    return null;
  }

  const changes = [];
  for (let i = 1; i < priceHistory.length; i++) {
    changes.push(priceHistory[i] - priceHistory[i - 1]);
  }

  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter(c => c > 0);
  const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) {
    return 100; // Perfekter Bullenmarkt
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

/**
 * Berechnet den MACD (Moving Average Convergence Divergence)
 * @param {number[]} priceHistory - Die Preis-Historie
 * @param {number} fastPeriod - Schnelle EMA-Periode (Standard: 12)
 * @param {number} slowPeriod - Langsame EMA-Periode (Standard: 26)
 * @param {number} signalPeriod - Signal-Linie Periode (Standard: 9)
 * @returns {Object|null} { macd, signal, histogram }
 */
function calculateMACD(priceHistory, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!priceHistory || priceHistory.length < slowPeriod + signalPeriod) {
    return null;
  }

  // EMA berechnen
  function calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  const fastEMA = calculateEMA(priceHistory, fastPeriod);
  const slowEMA = calculateEMA(priceHistory, slowPeriod);
  const macdLine = fastEMA - slowEMA;

  // MACD-Historie für Signal-Linie berechnen
  const macdHistory = [];
  for (let i = slowPeriod; i < priceHistory.length; i++) {
    const fast = calculateEMA(priceHistory.slice(0, i + 1), fastPeriod);
    const slow = calculateEMA(priceHistory.slice(0, i + 1), slowPeriod);
    macdHistory.push(fast - slow);
  }

  const signalLine = macdHistory.length >= signalPeriod
    ? calculateEMA(macdHistory, signalPeriod)
    : macdLine;

  const histogram = macdLine - signalLine;

  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Berechnet Bollinger Bands
 * @param {number[]} priceHistory - Die Preis-Historie
 * @param {number} period - Periode für MA (Standard: 20)
 * @param {number} stdDev - Standardabweichung Multiplikator (Standard: 2)
 * @returns {Object|null} { upper, middle, lower }
 */
function calculateBollingerBands(priceHistory, period = 20, stdDev = 2) {
  if (!priceHistory || priceHistory.length < period) {
    return null;
  }

  const slice = priceHistory.slice(-period);
  const ma = calculateMA(priceHistory, period);

  // Standardabweichung berechnen
  const variance = slice.reduce((sum, price) => {
    return sum + Math.pow(price - ma, 2);
  }, 0) / period;

  const standardDeviation = Math.sqrt(variance);

  return {
    upper: ma + (stdDev * standardDeviation),
    middle: ma,
    lower: ma - (stdDev * standardDeviation)
  };
}

/**
 * Berechnet den Stochastic Oscillator
 * @param {number[]} highPrices - Höchstpreise
 * @param {number[]} lowPrices - Tiefstpreise
 * @param {number[]} closePrices - Schlusspreise
 * @param {number} period - Periode (Standard: 14)
 * @returns {Object|null} { k, d } - %K und %D Werte
 */
function calculateStochastic(highPrices, lowPrices, closePrices, period = 14) {
  if (!highPrices || !lowPrices || !closePrices || 
      highPrices.length < period || lowPrices.length < period || closePrices.length < period) {
    return null;
  }

  const recentHighs = highPrices.slice(-period);
  const recentLows = lowPrices.slice(-period);
  const currentClose = closePrices[closePrices.length - 1];

  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);

  if (highestHigh === lowestLow) {
    return { k: 50, d: 50 }; // Neutral wenn keine Volatilität
  }

  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

  // %D ist der gleitende Durchschnitt von %K (vereinfacht: aktueller Wert)
  const d = k;

  return { k, d };
}

/**
 * Berechnet den Exponential Moving Average (EMA)
 * @param {number[]} priceHistory - Die Preis-Historie
 * @param {number} period - EMA-Periode
 * @returns {number|null} EMA-Wert
 */
function calculateEMA(priceHistory, period) {
  if (!priceHistory || priceHistory.length < period) {
    return null;
  }

  const multiplier = 2 / (period + 1);
  let ema = priceHistory.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < priceHistory.length; i++) {
    ema = (priceHistory[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Generiert Trading-Signale basierend auf MA Crossover und weiteren Indikatoren
 * @param {number} currentPrice - Der aktuelle Preis
 * @param {Object} strategy - Die Trading-Strategie
 * @param {number[]} priceHistory - Die symbol-spezifische Preis-Historie
 */
function generateSignal(currentPrice, strategy, priceHistory) {
  const config = strategy.config;
  const maShortPeriod = config.indicators?.ma_short || 20;
  const maLongPeriod = config.indicators?.ma_long || 50;

  // Prüfen ob genug Daten vorhanden
  const requiredData = Math.max(maLongPeriod, config.indicators?.rsi_period || 0, config.indicators?.macd_slow_period || 0);
  if (!priceHistory || priceHistory.length < requiredData) {
    return {
      action: 'wait',
      reason: `Sammle Daten... ${priceHistory ? priceHistory.length : 0}/${requiredData}`,
      progress: Math.round(((priceHistory ? priceHistory.length : 0) / requiredData) * 100)
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

  // Zusätzliche Indikatoren berechnen
  const indicators = {
    rsi: null,
    macd: null,
    bollinger: null,
    stochastic: null
  };

  // RSI berechnen (wenn aktiviert)
  if (config.indicators?.rsi_period) {
    indicators.rsi = calculateRSI(priceHistory, config.indicators.rsi_period || 14);
  }

  // MACD berechnen (wenn aktiviert)
  if (config.indicators?.macd_fast_period) {
    indicators.macd = calculateMACD(
      priceHistory,
      config.indicators.macd_fast_period || 12,
      config.indicators.macd_slow_period || 26,
      config.indicators.macd_signal_period || 9
    );
  }

  // Bollinger Bands berechnen (wenn aktiviert)
  if (config.indicators?.bollinger_period) {
    indicators.bollinger = calculateBollingerBands(
      priceHistory,
      config.indicators.bollinger_period || 20,
      config.indicators.bollinger_std_dev || 2
    );
  }

  // Signal-Confidence basierend auf Indikatoren berechnen
  let confidence = Math.min(Math.abs(differencePercent) * 10, 100);
  let additionalReasons = [];

  // RSI-Filter
  if (indicators.rsi !== null) {
    const rsiOverbought = config.indicators?.rsi_overbought || 70;
    const rsiOversold = config.indicators?.rsi_oversold || 30;

    if (indicators.rsi > rsiOverbought) {
      additionalReasons.push(`RSI überkauft (${indicators.rsi.toFixed(1)})`);
      if (differencePercent > threshold) {
        confidence *= 0.7; // Reduziere Confidence bei überkauftem Markt für BUY
      }
    } else if (indicators.rsi < rsiOversold) {
      additionalReasons.push(`RSI überverkauft (${indicators.rsi.toFixed(1)})`);
      if (differencePercent < -threshold) {
        confidence *= 0.7; // Reduziere Confidence bei überverkauftem Markt für SELL
      }
    }
  }

  // MACD-Filter
  if (indicators.macd !== null) {
    if (indicators.macd.macd > indicators.macd.signal) {
      additionalReasons.push(`MACD bullish`);
      if (differencePercent > threshold) {
        confidence *= 1.1; // Erhöhe Confidence bei bullish MACD
      }
    } else {
      additionalReasons.push(`MACD bearish`);
      if (differencePercent < -threshold) {
        confidence *= 1.1; // Erhöhe Confidence bei bearish MACD
      }
    }
  }

  // Bollinger Bands Filter
  if (indicators.bollinger !== null) {
    if (currentPrice < indicators.bollinger.lower) {
      additionalReasons.push(`Preis unter unterem Band`);
      if (differencePercent > threshold) {
        confidence *= 1.15; // Starke Unterstützung
      }
    } else if (currentPrice > indicators.bollinger.upper) {
      additionalReasons.push(`Preis über oberem Band`);
      if (differencePercent < -threshold) {
        confidence *= 1.15; // Starker Widerstand
      }
    }
  }

  confidence = Math.min(confidence, 100);

  // Kauf-Signal: Kurzer MA über langem MA (Bullish)
  if (differencePercent > threshold) {
    return {
      action: 'buy',
      price: currentPrice,
      reason: `MA Crossover Bullish: MA${maShortPeriod}=${maShort.toFixed(2)} > MA${maLongPeriod}=${maLong.toFixed(2)}${additionalReasons.length > 0 ? ' | ' + additionalReasons.join(', ') : ''}`,
      maShort: maShort.toFixed(2),
      maLong: maLong.toFixed(2),
      difference: difference.toFixed(2),
      differencePercent: differencePercent.toFixed(3),
      confidence: confidence.toFixed(1),
      indicators: {
        rsi: indicators.rsi ? indicators.rsi.toFixed(2) : null,
        macd: indicators.macd ? {
          macd: indicators.macd.macd.toFixed(4),
          signal: indicators.macd.signal.toFixed(4),
          histogram: indicators.macd.histogram.toFixed(4)
        } : null,
        bollinger: indicators.bollinger ? {
          upper: indicators.bollinger.upper.toFixed(2),
          middle: indicators.bollinger.middle.toFixed(2),
          lower: indicators.bollinger.lower.toFixed(2)
        } : null
      }
    };
  }

  // Verkauf-Signal: Kurzer MA unter langem MA (Bearish)
  if (differencePercent < -threshold) {
    return {
      action: 'sell',
      price: currentPrice,
      reason: `MA Crossover Bearish: MA${maShortPeriod}=${maShort.toFixed(2)} < MA${maLongPeriod}=${maLong.toFixed(2)}${additionalReasons.length > 0 ? ' | ' + additionalReasons.join(', ') : ''}`,
      maShort: maShort.toFixed(2),
      maLong: maLong.toFixed(2),
      difference: difference.toFixed(2),
      differencePercent: differencePercent.toFixed(3),
      confidence: confidence.toFixed(1),
      indicators: {
        rsi: indicators.rsi ? indicators.rsi.toFixed(2) : null,
        macd: indicators.macd ? {
          macd: indicators.macd.macd.toFixed(4),
          signal: indicators.macd.signal.toFixed(4),
          histogram: indicators.macd.histogram.toFixed(4)
        } : null,
        bollinger: indicators.bollinger ? {
          upper: indicators.bollinger.upper.toFixed(2),
          middle: indicators.bollinger.middle.toFixed(2),
          lower: indicators.bollinger.lower.toFixed(2)
        } : null
      }
    };
  }

  // Neutral: Kein klares Signal
  return {
    action: 'hold',
    reason: 'Kein klares Signal',
    maShort: maShort.toFixed(2),
    maLong: maLong.toFixed(2),
    difference: difference.toFixed(2),
    differencePercent: differencePercent.toFixed(3),
    indicators: {
      rsi: indicators.rsi ? indicators.rsi.toFixed(2) : null,
      macd: indicators.macd ? {
        macd: indicators.macd.macd.toFixed(4),
        signal: indicators.macd.signal.toFixed(4),
        histogram: indicators.macd.histogram.toFixed(4)
      } : null,
      bollinger: indicators.bollinger ? {
        upper: indicators.bollinger.upper.toFixed(2),
        middle: indicators.bollinger.middle.toFixed(2),
        lower: indicators.bollinger.lower.toFixed(2)
      } : null
    }
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
 * Prüft offene Positionen auf Stop-Loss und Take-Profit
 * @param {number} currentPrice - Der aktuelle Preis
 * @param {string} symbol - Das Trading-Symbol
 */
async function checkStopLossTakeProfit(currentPrice, symbol) {
  // Prüfe alle offenen Positionen für dieses Symbol
  for (const [positionKey, position] of openPositions.entries()) {
    if (position.symbol !== symbol) continue;

    // Finde die zugehörige Strategie
    const strategy = activeStrategies.find(s => s.id === position.strategyId);
    if (!strategy) {
      console.warn(`⚠️  Keine Strategie gefunden für Position ${positionKey}`);
      continue;
    }

    // Hole Stop-Loss und Take-Profit aus Strategie-Config
    const stopLossPercent = strategy.config.risk?.stop_loss_percent || 0;
    const takeProfitPercent = strategy.config.risk?.take_profit_percent || 0;

    // Wenn beide deaktiviert sind, überspringe
    if (stopLossPercent === 0 && takeProfitPercent === 0) {
      continue;
    }

    // Berechne Preisänderung in Prozent
    const priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

    // Stop-Loss prüfen
    if (stopLossPercent > 0 && priceChangePercent <= -stopLossPercent) {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log(`🛑 STOP-LOSS AUSGELÖST [${symbol}]`);
      console.log('═══════════════════════════════════════════════');
      console.log(`📊 Position: ${positionKey}`);
      console.log(`💰 Entry Price: ${position.entryPrice.toFixed(6)} USDT`);
      console.log(`📉 Current Price: ${currentPrice.toFixed(6)} USDT`);
      console.log(`📊 Preisänderung: ${priceChangePercent.toFixed(2)}%`);
      console.log(`🛑 Stop-Loss Limit: -${stopLossPercent}%`);
      console.log('═══════════════════════════════════════════════');
      console.log('');

      await logBotEvent('warning', `Stop-Loss ausgelöst: ${symbol}`, {
        positionKey: positionKey,
        entryPrice: position.entryPrice,
        currentPrice: currentPrice,
        priceChangePercent: priceChangePercent,
        stopLossPercent: stopLossPercent,
        symbol: symbol,
        strategy_id: strategy.id
      });

      // Erstelle SELL-Signal für Stop-Loss
      const stopLossSignal = {
        action: 'sell',
        price: currentPrice,
        reason: `Stop-Loss ausgelöst: ${priceChangePercent.toFixed(2)}% <= -${stopLossPercent}%`,
        stopLoss: true,
        takeProfit: false,
        _positionData: position
      };

      // Position SOFORT entfernen, um Race-Conditions zu vermeiden
      openPositions.delete(positionKey);

      // Trade ausführen
      if (tradingEnabled && binanceClient) {
        await executeTrade(stopLossSignal, strategy);
      }

      continue;
    }

    // Take-Profit prüfen
    if (takeProfitPercent > 0 && priceChangePercent >= takeProfitPercent) {
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log(`🎯 TAKE-PROFIT AUSGELÖST [${symbol}]`);
      console.log('═══════════════════════════════════════════════');
      console.log(`📊 Position: ${positionKey}`);
      console.log(`💰 Entry Price: ${position.entryPrice.toFixed(6)} USDT`);
      console.log(`📈 Current Price: ${currentPrice.toFixed(6)} USDT`);
      console.log(`📊 Preisänderung: ${priceChangePercent.toFixed(2)}%`);
      console.log(`🎯 Take-Profit Limit: +${takeProfitPercent}%`);
      console.log('═══════════════════════════════════════════════');
      console.log('');

      await logBotEvent('info', `Take-Profit ausgelöst: ${symbol}`, {
        positionKey: positionKey,
        entryPrice: position.entryPrice,
        currentPrice: currentPrice,
        priceChangePercent: priceChangePercent,
        takeProfitPercent: takeProfitPercent,
        symbol: symbol,
        strategy_id: strategy.id
      });

      // Erstelle SELL-Signal für Take-Profit
      const takeProfitSignal = {
        action: 'sell',
        price: currentPrice,
        reason: `Take-Profit ausgelöst: ${priceChangePercent.toFixed(2)}% >= +${takeProfitPercent}%`,
        stopLoss: false,
        takeProfit: true,
        _positionData: position
      };

      // Position SOFORT entfernen, um Race-Conditions zu vermeiden
      openPositions.delete(positionKey);

      // Trade ausführen
      if (tradingEnabled && binanceClient) {
        await executeTrade(takeProfitSignal, strategy);
      }
    }
  }
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
// PHASE 3: BACKTESTING-SYSTEM
// ═══════════════════════════════════════════════

/**
 * Führt ein Backtesting für eine Strategie durch
 * @param {Object} strategy - Die Trading-Strategie
 * @param {string} symbol - Das Trading-Symbol
 * @param {string} startDate - Startdatum (ISO-String)
 * @param {string} endDate - Enddatum (ISO-String)
 * @param {string} timeframe - Zeitrahmen (z.B. '1h', '4h', '1d')
 * @returns {Object} Backtesting-Ergebnisse
 */
async function runBacktest(strategy, symbol, startDate, endDate, timeframe = '1h') {
  try {
    console.log(`🔄 Starte Backtesting für ${strategy.name} (${symbol})...`);
    console.log(`   Zeitraum: ${startDate} bis ${endDate}`);
    console.log(`   Zeitrahmen: ${timeframe}`);

    // CCXT Exchange initialisieren
    const exchange = new ccxt.binance({
      enableRateLimit: true,
      sandbox: false // Verwende echte Daten für Backtesting
    });

    // Historische Daten laden
    const since = new Date(startDate).getTime();
    const until = new Date(endDate).getTime();
    
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, since, undefined, {
      limit: 1000
    });

    if (!ohlcv || ohlcv.length === 0) {
      throw new Error('Keine historischen Daten gefunden');
    }

    console.log(`   📊 ${ohlcv.length} Kerzen geladen`);

    // Backtesting durchführen
    const priceHistory = [];
    let position = null;
    const trades = [];
    let totalPnl = 0;
    let winCount = 0;
    let lossCount = 0;
    let maxDrawdown = 0;
    let peakBalance = 1000; // Startkapital
    let currentBalance = 1000;

    for (let i = 0; i < ohlcv.length; i++) {
      const [timestamp, open, high, low, close, volume] = ohlcv[i];
      const currentPrice = close;

      // Preis zur Historie hinzufügen
      priceHistory.push(currentPrice);

      // Signal generieren
      const signal = generateSignal(currentPrice, strategy, priceHistory);

      if (!signal || signal.action === 'wait' || signal.action === 'hold' || signal.action === 'error') {
        continue;
      }

      // Stop-Loss & Take-Profit prüfen (wenn Position offen)
      if (position) {
        const priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        const stopLossPercent = strategy.config.risk?.stop_loss_percent || 0;
        const takeProfitPercent = strategy.config.risk?.take_profit_percent || 0;

        if (stopLossPercent > 0 && priceChangePercent <= -stopLossPercent) {
          // Stop-Loss ausgelöst
          const pnl = (currentPrice - position.entryPrice) * position.quantity;
          totalPnl += pnl;
          currentBalance += pnl;
          
          trades.push({
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            quantity: position.quantity,
            pnl: pnl,
            pnlPercent: priceChangePercent,
            reason: 'stop_loss',
            timestamp: timestamp
          });

          if (pnl > 0) winCount++;
          else lossCount++;

          position = null;
          continue;
        }

        if (takeProfitPercent > 0 && priceChangePercent >= takeProfitPercent) {
          // Take-Profit ausgelöst
          const pnl = (currentPrice - position.entryPrice) * position.quantity;
          totalPnl += pnl;
          currentBalance += pnl;
          
          trades.push({
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            quantity: position.quantity,
            pnl: pnl,
            pnlPercent: priceChangePercent,
            reason: 'take_profit',
            timestamp: timestamp
          });

          if (pnl > 0) winCount++;
          else lossCount++;

          position = null;
          continue;
        }
      }

      // Trade ausführen basierend auf Signal
      if (signal.action === 'buy' && !position) {
        const tradeSize = strategy.config.risk?.max_trade_size_usdt || 100;
        const quantity = tradeSize / currentPrice;
        
        position = {
          entryPrice: currentPrice,
          quantity: quantity,
          timestamp: timestamp
        };
      } else if (signal.action === 'sell' && position) {
        const pnl = (currentPrice - position.entryPrice) * position.quantity;
        const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        totalPnl += pnl;
        currentBalance += pnl;

        trades.push({
          entryPrice: position.entryPrice,
          exitPrice: currentPrice,
          quantity: position.quantity,
          pnl: pnl,
          pnlPercent: pnlPercent,
          reason: 'signal',
          timestamp: timestamp
        });

        if (pnl > 0) winCount++;
        else lossCount++;

        position = null;
      }

      // Drawdown berechnen
      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
      }
      const drawdown = ((peakBalance - currentBalance) / peakBalance) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Schließe offene Position am Ende
    if (position && ohlcv.length > 0) {
      const lastPrice = ohlcv[ohlcv.length - 1][4];
      const pnl = (lastPrice - position.entryPrice) * position.quantity;
      const pnlPercent = ((lastPrice - position.entryPrice) / position.entryPrice) * 100;
      
      totalPnl += pnl;
      currentBalance += pnl;

      trades.push({
        entryPrice: position.entryPrice,
        exitPrice: lastPrice,
        quantity: position.quantity,
        pnl: pnl,
        pnlPercent: pnlPercent,
        reason: 'end_of_period',
        timestamp: ohlcv[ohlcv.length - 1][0]
      });

      if (pnl > 0) winCount++;
      else lossCount++;
    }

    // Performance-Metriken berechnen
    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const avgWin = winCount > 0 ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / winCount : 0;
    const avgLoss = lossCount > 0 ? trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / lossCount : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;
    const returnPercent = ((currentBalance - 1000) / 1000) * 100;

    const results = {
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: symbol,
      startDate: startDate,
      endDate: endDate,
      timeframe: timeframe,
      totalTrades: totalTrades,
      winCount: winCount,
      lossCount: lossCount,
      winRate: winRate.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
      returnPercent: returnPercent.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      startBalance: 1000,
      endBalance: currentBalance.toFixed(2),
      trades: trades.slice(-50) // Nur die letzten 50 Trades zurückgeben
    };

    console.log(`✅ Backtesting abgeschlossen:`);
    console.log(`   Trades: ${totalTrades} (${winCount} Gewinne, ${lossCount} Verluste)`);
    console.log(`   Win Rate: ${winRate.toFixed(2)}%`);
    console.log(`   Total PnL: ${totalPnl.toFixed(2)} USDT`);
    console.log(`   Return: ${returnPercent.toFixed(2)}%`);

    return results;
  } catch (error) {
    console.error('❌ Fehler beim Backtesting:', error);
    throw error;
  }
}

/**
 * Berechnet Performance-Metriken für alle Strategien
 * @returns {Array} Performance-Daten für jede Strategie
 */
async function calculateStrategyPerformance() {
  try {
    const strategies = await loadStrategies();
    const performance = [];

    for (const strategy of strategies) {
      // Lade alle Trades für diese Strategie
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('strategy_id', strategy.id)
        .eq('status', 'executed')
        .order('executed_at', { ascending: true });

      if (error) {
        console.error(`❌ Fehler beim Laden der Trades für ${strategy.name}:`, error);
        continue;
      }

      if (!trades || trades.length === 0) {
        performance.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          symbol: strategy.symbol,
          totalTrades: 0,
          winRate: 0,
          totalPnl: 0,
          returnPercent: 0
        });
        continue;
      }

      // Berechne Performance-Metriken
      const sellTrades = trades.filter(t => t.side === 'sell' && t.pnl !== null);
      const winCount = sellTrades.filter(t => t.pnl > 0).length;
      const lossCount = sellTrades.filter(t => t.pnl < 0).length;
      const totalTrades = sellTrades.length;
      const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
      const totalPnl = sellTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

      performance.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        symbol: strategy.symbol,
        totalTrades: totalTrades,
        winCount: winCount,
        lossCount: lossCount,
        winRate: winRate.toFixed(2),
        totalPnl: totalPnl.toFixed(2),
        avgPnl: avgPnl.toFixed(2),
        returnPercent: totalPnl > 0 ? ((totalPnl / 1000) * 100).toFixed(2) : '0.00'
      });
    }

    return performance;
  } catch (error) {
    console.error('❌ Fehler beim Berechnen der Performance:', error);
    throw error;
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

      // PHASE 3: Stop-Loss & Take-Profit prüfen (bei jedem Preis-Update)
      await checkStopLossTakeProfit(currentPrice, symbol);

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
  console.log(`  GET  /api/status              - Bot-Status abfragen`);
  console.log(`  POST /api/start-bot           - Bot starten`);
  console.log(`  POST /api/stop-bot            - Bot stoppen`);
  console.log(`  POST /api/backtest            - Backtesting durchführen`);
  console.log(`  GET  /api/strategy-performance - Strategie-Performance abfragen`);
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

