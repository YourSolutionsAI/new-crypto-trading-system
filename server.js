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
let lastTradeTimes = new Map(); // Map<symbol, number> - Trade-Cooldown pro Symbol
let tradesInProgress = new Map(); // Map<symbol, Promise> - Trade-Lock pro Symbol (verhindert Doppelausführungen)
let tradeQueues = new Map(); // Map<symbol, Promise> - Queue für Trades pro Symbol (verhindert Race Conditions)
let openPositions = new Map(); // Tracking offener Positionen (bereits symbol-spezifisch: ${strategy.id}_${symbol})
let pendingBuySignals = new Map(); // Map<positionKey, {timestamp, reason}> - Verhindert mehrfache Kaufsignale
let pendingSellSignals = new Map(); // Map<positionKey, {timestamp, reason, exitReason}> - Verhindert mehrfache Verkaufssignale
let botSettings = {}; // Bot-Einstellungen aus Supabase
let lotSizes = {}; // Lot Size Regeln aus Supabase
let settingsReloadInterval = null; // Interval für automatisches Neuladen der Einstellungen

// ================================================================
// POSITION MANAGEMENT FUNKTIONEN
// ================================================================

/**
 * Öffnet oder erweitert eine Position in der Datenbank
 * @param {string} strategyId - Strategy ID
 * @param {string} symbol - Trading Symbol (z.B. BTCUSDT)
 * @param {number} quantity - Gekaufte Menge
 * @param {number} price - Kaufpreis
 * @returns {Object} Position-Daten
 */
async function openOrUpdatePosition(strategyId, symbol, quantity, price) {
  try {
    console.log(`📊 Öffne/Erweitere Position: ${symbol} - ${quantity} @ ${price}`);
    
    // Hole Strategie-Config für Trailing Stop Einstellungen
    // WICHTIG: Lade aus coin_strategies (nicht nur strategies), da coin-spezifische Einstellungen dort gespeichert sind
    const { data: coinStrategy, error: coinStrategyError } = await supabase
      .from('coin_strategies')
      .select(`
        config,
        strategies (
          id,
          config
        )
      `)
      .eq('strategy_id', strategyId)
      .eq('symbol', symbol.toUpperCase())
      .single();
    
    // Fallback: Wenn coin_strategies nicht gefunden wird, lade nur aus strategies
    let mergedConfig = null;
    if (coinStrategyError || !coinStrategy) {
      console.warn(`⚠️  Konnte Coin-Strategie-Config nicht laden: ${coinStrategyError?.message || 'Nicht gefunden'}. Verwende Fallback zu strategies.`);
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .select('config')
        .eq('id', strategyId)
        .single();
      
      if (strategyError) {
        console.warn(`⚠️  Konnte Strategie-Config nicht laden: ${strategyError.message}`);
      }
      mergedConfig = strategy?.config || {};
    } else {
      // Merge Configs: Basis (strategies) + Coin-spezifisch (coin_strategies)
      const baseStrategy = coinStrategy?.strategies || {};
      const coinConfig = coinStrategy?.config || {};
      mergedConfig = {
        ...baseStrategy.config, // Basis: type, timeframe, indicators
        settings: coinConfig.settings || {}, // Coin-spezifisch: thresholds, cooldowns
        risk: coinConfig.risk || {} // Coin-spezifisch: trade size, stop loss, trailing stop, etc.
      };
    }
    
    const useTrailingStop = mergedConfig?.risk?.use_trailing_stop === true;
    const stopLossPercent = mergedConfig?.risk?.stop_loss_percent ?? 0;
    const activationThreshold = mergedConfig?.risk?.trailing_stop_activation_threshold ?? 0;
    
    // Prüfe ob bereits eine offene Position existiert (berücksichtige auch 'partial' für Rückwärtskompatibilität)
    const { data: existingPosition, error: fetchError } = await supabase
      .from('positions')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .gt('quantity', 0)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw fetchError;
    }
    
    if (existingPosition) {
      // Position erweitern (Average Up/Down)
      const newTotalValue = existingPosition.total_buy_value + (quantity * price);
      const newTotalQuantity = existingPosition.quantity + quantity;
      const newEntryPrice = newTotalValue / newTotalQuantity;
      
      // Trailing Stop: highest_price = MAX(altes_highest_price, neuer_entry_price)
      const oldHighestPrice = existingPosition.highest_price ? parseFloat(existingPosition.highest_price) : parseFloat(existingPosition.entry_price);
      const newHighestPrice = Math.max(oldHighestPrice, newEntryPrice);
      
      // Berechne neuen Trailing Stop Preis (wenn Trailing aktiv)
      let newTrailingStopPrice = existingPosition.trailing_stop_price;
      if (useTrailingStop && stopLossPercent > 0) {
        newTrailingStopPrice = newHighestPrice * (1 - stopLossPercent / 100);
      }
      
      const updateData = {
        quantity: newTotalQuantity,
        entry_price: newEntryPrice,
        total_buy_quantity: existingPosition.total_buy_quantity + quantity,
        total_buy_value: newTotalValue,
        highest_price: newHighestPrice,
        updated_at: new Date().toISOString(),
        // STATUS: Position ist jetzt OFFEN (Kauf abgeschlossen)
        trade_status: 'OFFEN'
      };
      
      // Update Trailing Stop Felder nur wenn Trailing aktiv
      if (useTrailingStop) {
        updateData.trailing_stop_price = newTrailingStopPrice;
        updateData.use_trailing_stop = true;
        updateData.trailing_stop_activation_threshold = activationThreshold;
      }
      
      const { data: updatedPosition, error: updateError } = await supabase
        .from('positions')
        .update(updateData)
        .eq('id', existingPosition.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      const trailingInfo = useTrailingStop 
        ? ` | Trailing Stop: ${newTrailingStopPrice ? newTrailingStopPrice.toFixed(6) : 'N/A'} (Highest: ${newHighestPrice.toFixed(6)})`
        : '';
      console.log(`✅ Position erweitert: ${symbol} - Neue Menge: ${newTotalQuantity}, Neuer Durchschnittspreis: ${newEntryPrice}${trailingInfo}`);
      return updatedPosition;
    } else {
      // Neue Position erstellen
      const initialHighestPrice = price;
      // Trailing Stop Price: SOFORT aktiv wenn TSL aktiviert (KEINE Aktivierungsschwelle mehr!)
      // TSL wird direkt beim Kauf initialisiert: Entry-Price * (1 - StopLoss%)
      const initialTrailingStopPrice = useTrailingStop && stopLossPercent > 0
        ? initialHighestPrice * (1 - stopLossPercent / 100)
        : null;
      
      const insertData = {
        strategy_id: strategyId,
        symbol: symbol,
        quantity: quantity,
        entry_price: price,
        total_buy_quantity: quantity,
        total_buy_value: quantity * price,
        status: 'open',
        opened_at: new Date().toISOString(),
        highest_price: initialHighestPrice,
        // STATUS: Neue Position ist OFFEN (Kauf abgeschlossen)
        trade_status: 'OFFEN'
      };
      
      // Füge Trailing Stop Felder hinzu wenn aktiv
      if (useTrailingStop) {
        // TSL wird SOFORT initialisiert (keine Aktivierungsschwelle mehr!)
        if (initialTrailingStopPrice !== null) {
          insertData.trailing_stop_price = initialTrailingStopPrice;
        }
        insertData.use_trailing_stop = true;
        // Aktivierungsschwelle wird auf 0 gesetzt (nicht mehr verwendet)
        insertData.trailing_stop_activation_threshold = 0;
      }
      
      const { data: newPosition, error: insertError } = await supabase
        .from('positions')
        .insert(insertData)
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      const trailingInfo = useTrailingStop 
        ? ` | Trailing Stop: ${initialTrailingStopPrice ? initialTrailingStopPrice.toFixed(6) : 'N/A (wartet auf Aktivierung)'}`
        : '';
      console.log(`✅ Neue Position geöffnet: ${symbol} - ${quantity} @ ${price}${trailingInfo}`);
      return newPosition;
    }
  } catch (error) {
    console.error('❌ Fehler beim Öffnen/Erweitern der Position:', error);
    throw error;
  }
}

/**
 * Schließt eine Position in der Datenbank (immer vollständig)
 * WICHTIG: Es gibt nur volle Verkäufe - quantity sollte immer der gesamten Position entsprechen
 * @param {string} strategyId - Strategy ID
 * @param {string} symbol - Trading Symbol (z.B. BTCUSDT)
 * @param {number} quantity - Verkaufte Menge (sollte immer = gesamte Position sein)
 * @returns {Object} Ergebnis mit entry_price für PnL-Berechnung
 */
/**
 * Validiert und bereinigt eine Position nach einem Verkauf
 * Stellt sicher, dass geschlossene Positionen auch wirklich aus der DB entfernt werden
 */
async function validateAndCleanupPosition(strategyId, symbol) {
  try {
    const positionKey = `${strategyId}_${symbol}`;
    
    // Prüfe Position in der Datenbank (sowohl open als auch partial)
    const { data: position, error } = await supabase
      .from('positions')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .maybeSingle();
    
    if (error) {
      console.error(`❌ Fehler beim Validieren der Position ${symbol}: ${error.message}`);
      return false;
    }
    
    // Wenn keine Position gefunden oder quantity <= 0, bereinige In-Memory Map
    if (!position || parseFloat(position.quantity) <= 0.00000001) {
      // Stelle sicher, dass Position wirklich geschlossen ist
      if (position && position.status !== 'closed') {
        console.log(`🔧 Bereinige Position in DB: ${symbol} (quantity: ${position.quantity})`);
        
        // Entferne Verkaufssignal-State wenn Position geschlossen wird
        const positionKey = `${strategyId}_${symbol}`;
        if (pendingSellSignals.has(positionKey)) {
          console.log(`🧹 [${symbol}] Entferne Verkaufssignal-State (Position wird geschlossen)`);
          pendingSellSignals.delete(positionKey);
        }
        
        await supabase
          .from('positions')
          .update({
            quantity: 0,
            status: 'closed',
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', position.id);
      }
      
      // Entferne aus In-Memory Map
      if (openPositions.has(positionKey)) {
        openPositions.delete(positionKey);
        console.log(`✅ Position aus In-Memory Map entfernt: ${symbol}`);
      }
      return true;
    }
    
    // Position existiert noch mit quantity > 0 - synchronisiere In-Memory Map
    const dbQuantity = parseFloat(position.quantity);
    if (openPositions.has(positionKey)) {
      const memPos = openPositions.get(positionKey);
      memPos.quantity = dbQuantity;
      // Stelle sicher, dass Status in DB 'open' ist (nicht 'partial')
      if (position.status === 'partial') {
        await supabase
          .from('positions')
          .update({ status: 'open' })
          .eq('id', position.id);
      }
    } else {
      // Position existiert in DB aber nicht in Memory - füge hinzu
      openPositions.set(positionKey, {
        symbol: symbol,
        entryPrice: parseFloat(position.entry_price),
        quantity: dbQuantity,
        orderId: position.id,
        timestamp: new Date(position.opened_at),
        strategyId: strategyId,
        highestPrice: position.highest_price ? parseFloat(position.highest_price) : parseFloat(position.entry_price),
        trailingStopPrice: position.trailing_stop_price ? parseFloat(position.trailing_stop_price) : null,
        useTrailingStop: position.use_trailing_stop === true,
        trailingStopActivationThreshold: position.trailing_stop_activation_threshold ? parseFloat(position.trailing_stop_activation_threshold) : 0
      });
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Fehler bei Position-Validierung: ${error.message}`);
    return false;
  }
}

async function reduceOrClosePosition(strategyId, symbol, quantity, closeReason = null, retryCount = 0) {
  try {
    // Verhindere Endlosschleifen bei Retries
    if (retryCount > 1) {
      console.error(`❌ Max. Retry-Limit erreicht für Position-Update: ${symbol}`);
      throw new Error('Max. Retry-Limit erreicht');
    }
    
    if (retryCount > 0) {
      console.log(`🔄 Retry ${retryCount}: Reduziere/Schließe Position: ${symbol} - ${quantity}`);
    } else {
      console.log(`📊 Reduziere/Schließe Position: ${symbol} - ${quantity}`);
    }
    
    // SCHICHT 3: Atomic Position-Update
    // Hole aktuelle Position - berücksichtige sowohl 'open' als auch 'partial' Status
    // (partial sollte eigentlich nicht mehr vorkommen, aber für Sicherheit)
    const { data: position, error: fetchError } = await supabase
      .from('positions')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .gt('quantity', 0)
      .single();
    
    if (fetchError || !position) {
      console.warn(`⚠️  Keine offene Position gefunden für ${symbol}`);
      // Bereinige In-Memory Map falls vorhanden
      const positionKey = `${strategyId}_${symbol}`;
      if (openPositions.has(positionKey)) {
        openPositions.delete(positionKey);
        console.log(`🗑️  Position aus In-Memory Map entfernt (nicht in DB gefunden): ${symbol}`);
      }
      return {
        action: 'no_position',
        entry_price: 0,
        remaining_quantity: 0
      };
    }
    
    const currentQuantity = parseFloat(position.quantity);
    const requestedQuantity = parseFloat(quantity);
    
    // Prüfe ob genug Position vorhanden ist
    if (currentQuantity < requestedQuantity) {
      console.warn(`⚠️  Nicht genug Position vorhanden: ${currentQuantity} < ${requestedQuantity}`);
      return {
        action: 'no_position',
        entry_price: parseFloat(position.entry_price),
        remaining_quantity: currentQuantity
      };
    }
    
    const remainingQuantity = currentQuantity - requestedQuantity;
    const entryPrice = parseFloat(position.entry_price);
    
    // Atomic Update: Update nur wenn Quantity noch gleich ist (verhindert Race Conditions)
    const updateData = {
      quantity: remainingQuantity,
      updated_at: new Date().toISOString()
    };
    
    // WICHTIG: Bei vollem Verkauf sollte remainingQuantity immer 0 sein
    // Da es NUR volle Verkäufe gibt, sollte dieser Fall nie eintreten
    if (remainingQuantity <= 0.00000001) {
      // Position komplett schließen (normaler Fall bei vollem Verkauf)
      updateData.status = 'closed';
      updateData.closed_at = new Date().toISOString();
      updateData.quantity = 0;
      // Setze close_reason wenn angegeben
      if (closeReason) {
        updateData.close_reason = closeReason;
      }
    } else {
      // Dies sollte eigentlich nie passieren, da es nur volle Verkäufe gibt
      // Aber für Sicherheit: Wenn Position reduziert wurde, schließe sie automatisch
      // Reduzierte Positionen sollen nicht mehr in den offenen Positionen angezeigt werden
      console.warn(`⚠️  UNERWARTET: Teilverkauf erkannt für ${symbol} (${remainingQuantity} verbleibend) - schließe Position automatisch!`);
      console.warn(`   Verkauft: ${requestedQuantity}, Vorher: ${currentQuantity}, Verbleibend: ${remainingQuantity}`);
      // Position automatisch schließen (nicht als 'partial' belassen)
      updateData.status = 'closed';
      updateData.closed_at = new Date().toISOString();
      updateData.quantity = 0;
      // Setze close_reason wenn angegeben
      if (closeReason) {
        updateData.close_reason = closeReason;
      }
    }
    
    // WICHTIG: Atomic Update mit WHERE-Clause für Quantity-Check
    // Dies verhindert Race Conditions: Update nur wenn Quantity noch gleich ist
    const { data: updatedPosition, error: updateError } = await supabase
      .from('positions')
      .update(updateData)
      .eq('id', position.id)
      .eq('quantity', currentQuantity) // Atomic: Nur updaten wenn Quantity noch gleich ist
      .select()
      .single();
    
    if (updateError || !updatedPosition) {
      // Race Condition erkannt - Position wurde zwischenzeitlich geändert
      console.warn(`⚠️  Race Condition erkannt beim Position-Update: ${symbol}`);
      console.warn(`   Update-Fehler: ${updateError?.message || 'Kein updatedPosition zurückgegeben'}`);
      
      // WICHTIG: Wenn Position komplett geschlossen werden sollte, erzwinge Schließung
      // Dies verhindert, dass Positionen "hängen bleiben" bei Race Conditions
      if (remainingQuantity <= 0.00000001) {
        console.log(`🔄 Erzwinge Position-Schließung für ${symbol} (Bypass Quantity-Check wegen Race Condition)`);
        
        // Versuche mit verschiedenen WHERE-Bedingungen
        const forceCloseAttempts = [
          { eq: 'status', value: 'open' },
          { eq: 'status', value: 'partial' },
          { eq: null, value: null } // Ohne Status-Check als letzter Versuch
        ];
        
        let forceCloseSuccess = false;
        for (const attempt of forceCloseAttempts) {
          const updateQuery = supabase
            .from('positions')
            .update({
              quantity: 0,
              status: 'closed',
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...(closeReason ? { close_reason: closeReason } : {})
            })
            .eq('id', position.id);
          
          if (attempt.eq) {
            updateQuery.eq(attempt.eq, attempt.value);
          }
          
          const { error: forceCloseError } = await updateQuery.select().single();
          
          if (!forceCloseError) {
            forceCloseSuccess = true;
            break;
          }
        }
        
        if (!forceCloseSuccess) {
          console.error(`❌ Alle Versuche zum erzwungenen Schließen fehlgeschlagen für ${symbol}`);
          throw new Error('Position konnte nicht geschlossen werden');
        }
        
        console.log(`✅ Position ${symbol} erfolgreich geschlossen (erzwungen)`);
        
        // Entferne aus In-Memory Map
        const positionKey = `${strategyId}_${symbol}`;
        if (openPositions.has(positionKey)) {
          openPositions.delete(positionKey);
        }
        
        // Entferne Verkaufssignal-State wenn Position geschlossen wurde
        if (pendingSellSignals.has(positionKey)) {
          console.log(`🧹 [${symbol}] Entferne Verkaufssignal-State (Position geschlossen)`);
          pendingSellSignals.delete(positionKey);
        }
        
        // Validiere nochmal um sicherzustellen
        await validateAndCleanupPosition(strategyId, symbol);
        
        return {
          action: 'closed',
          entry_price: entryPrice,
          remaining_quantity: 0
        };
      }
      
      // Bei teilweiser Reduktion: Versuche Retry
      console.warn(`⚠️  Race Condition bei Teilverkauf - versuche Retry`);
      const retryPosition = await supabase
        .from('positions')
        .select('*')
        .eq('strategy_id', strategyId)
        .eq('symbol', symbol)
        .in('status', ['open', 'partial'])
        .gt('quantity', 0)
        .single();
      
      if (retryPosition.data) {
        const retryCurrentQty = parseFloat(retryPosition.data.quantity);
        if (retryCurrentQty >= requestedQuantity) {
          // Versuche nochmal mit aktualisierten Werten (mit Retry-Counter)
          return await reduceOrClosePosition(strategyId, symbol, quantity, closeReason, retryCount + 1);
        } else {
          // Nicht genug Position mehr vorhanden
          return {
            action: 'no_position',
            entry_price: parseFloat(retryPosition.data.entry_price),
            remaining_quantity: retryCurrentQty
          };
        }
      } else {
        // Position existiert nicht mehr
        const positionKey = `${strategyId}_${symbol}`;
        if (openPositions.has(positionKey)) {
          openPositions.delete(positionKey);
        }
        return {
          action: 'no_position',
          entry_price: entryPrice,
          remaining_quantity: 0
        };
      }
    }
    
    // Update erfolgreich - VALIDIERUNG durchführen
    const positionKey = `${strategyId}_${symbol}`;
    
    if (remainingQuantity <= 0.00000001) {
      console.log(`✅ Position geschlossen: ${symbol}`);
      // Entferne aus der In-Memory Map
      if (openPositions.has(positionKey)) {
        openPositions.delete(positionKey);
      }
      
      // Entferne Verkaufssignal-State wenn Position geschlossen wurde
      if (pendingSellSignals.has(positionKey)) {
        console.log(`🧹 [${symbol}] Entferne Verkaufssignal-State (Position geschlossen)`);
        pendingSellSignals.delete(positionKey);
      }
      
      // KRITISCH: Validiere dass Position wirklich geschlossen ist
      await validateAndCleanupPosition(strategyId, symbol);
      
      return {
        action: 'closed',
        entry_price: entryPrice,
        remaining_quantity: 0
      };
    } else {
      console.log(`✅ Position reduziert: ${symbol} - Verbleibend: ${remainingQuantity}`);
      // Update In-Memory Map
      if (openPositions.has(positionKey)) {
        const memPosition = openPositions.get(positionKey);
        memPosition.quantity = remainingQuantity;
      } else {
        // Position sollte in Memory sein - füge hinzu falls fehlt
        openPositions.set(positionKey, {
          symbol: symbol,
          entryPrice: entryPrice,
          quantity: remainingQuantity,
          orderId: updatedPosition.id,
          timestamp: new Date(updatedPosition.opened_at),
          strategyId: strategyId
        });
      }
      
      // Validiere dass alles synchron ist
      await validateAndCleanupPosition(strategyId, symbol);
      
      return {
        action: 'reduced',
        entry_price: entryPrice,
        remaining_quantity: remainingQuantity
      };
    }
  } catch (error) {
    console.error('❌ Fehler beim Reduzieren/Schließen der Position:', error);
    // Bei Fehler: Versuche Position zu bereinigen
    try {
      await validateAndCleanupPosition(strategyId, symbol);
    } catch (cleanupError) {
      console.error('❌ Fehler bei Bereinigung nach Fehler:', cleanupError);
    }
    throw error;
  }
}

/**
 * Lädt alle offenen Positionen aus der Datenbank
 * (Ersetzt die alte loadOpenPositions Funktion)
 */
async function loadOpenPositionsFromDB() {
  try {
    console.log('📊 Lade offene Positionen aus der Datenbank...');
    
    // Lade sowohl 'open' als auch 'partial' Positionen (partial sollte eigentlich nicht mehr vorkommen)
    const { data: positions, error } = await supabase
      .from('positions')
      .select('*')
      .in('status', ['open', 'partial'])
      .gt('quantity', 0);
    
    if (error) throw error;
    
    // Clear und neu befüllen der In-Memory Map
    openPositions.clear();
    
    // Bereinige alte 'partial' Status Positionen und konvertiere sie zu 'open'
    const positionsToFix = (positions || []).filter(p => p.status === 'partial');
    if (positionsToFix.length > 0) {
      console.log(`🔧 Konvertiere ${positionsToFix.length} 'partial' Position(en) zu 'open'...`);
      for (const position of positionsToFix) {
        await supabase
          .from('positions')
          .update({ status: 'open' })
          .eq('id', position.id);
      }
    }
    
    for (const position of (positions || [])) {
      const positionKey = `${position.strategy_id}_${position.symbol}`;
      const entryPrice = parseFloat(position.entry_price);
      const highestPrice = position.highest_price ? parseFloat(position.highest_price) : entryPrice;
      const trailingStopPrice = position.trailing_stop_price ? parseFloat(position.trailing_stop_price) : null;
      
      openPositions.set(positionKey, {
        symbol: position.symbol,
        entryPrice: entryPrice,
        quantity: parseFloat(position.quantity),
        orderId: position.id, // Verwende Position-ID statt Order-ID
        timestamp: new Date(position.opened_at),
        strategyId: position.strategy_id,
        // Trailing Stop Loss Felder
        highestPrice: highestPrice,
        trailingStopPrice: trailingStopPrice,
        useTrailingStop: position.use_trailing_stop === true,
        trailingStopActivationThreshold: position.trailing_stop_activation_threshold ? parseFloat(position.trailing_stop_activation_threshold) : 0
      });
      
      const trailingInfo = position.use_trailing_stop 
        ? ` | Trailing Stop: ${trailingStopPrice ? trailingStopPrice.toFixed(6) : 'N/A'} (Highest: ${highestPrice.toFixed(6)})`
        : '';
      console.log(`✅ Position geladen: ${position.symbol} - ${position.quantity} @ ${position.entry_price}${trailingInfo}`);
    }
    
    console.log(`✅ ${openPositions.size} offene Position(en) geladen`);
  } catch (error) {
    console.error('❌ Fehler beim Laden der offenen Positionen:', error);
  }
}

/**
 * Extrahiert das Base-Asset aus einem Trading-Symbol
 * @param {string} symbol - Trading Symbol (z.B. DOGEUSDT, BTCUSDT)
 * @returns {string} Base Asset (z.B. DOGE, BTC)
 */
function extractBaseAsset(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return null;
  }
  
  // Liste bekannter Quote-Assets (in umgekehrter Reihenfolge für längere zuerst)
  const quoteAssets = ['USDT', 'BTC', 'ETH', 'BNB', 'BUSD'];
  
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      return symbol.slice(0, -quote.length);
    }
  }
  
  // Fallback: Wenn kein bekanntes Quote-Asset gefunden, versuche USDT
  if (symbol.includes('USDT')) {
    return symbol.replace('USDT', '');
  }
  
  // Letzter Fallback: Nimm alles außer den letzten 4 Zeichen (für USDT)
  return symbol.slice(0, -4);
}

/**
 * Prüft das tatsächliche Guthaben bei Binance und synchronisiert Positionen
 * STATE-OF-THE-ART: Automatische Position-Synchronisation mit Binance
 * @param {string} strategyId - Strategy ID
 * @param {string} symbol - Trading Symbol (z.B. DOGEUSDT)
 * @returns {Object} Ergebnis der Synchronisation
 */
async function syncPositionWithBinance(strategyId, symbol) {
  try {
    console.log(`🔄 Synchronisiere Position mit Binance: ${symbol}`);
    
    // Extrahiere Base-Asset aus Symbol
    const baseAsset = extractBaseAsset(symbol);
    
    if (!baseAsset) {
      console.warn(`⚠️  Konnte Base-Asset nicht aus Symbol extrahieren: ${symbol}`);
      return { synced: false, reason: 'Konnte Base-Asset nicht extrahieren' };
    }
    
    if (!binanceClient) {
      console.warn(`⚠️  Binance Client nicht verfügbar für Synchronisation`);
      return { synced: false, reason: 'Binance Client nicht verfügbar' };
    }
    
    // Hole tatsächliches Guthaben von Binance
    let accountInfo;
    try {
      accountInfo = await binanceClient.accountInfo();
    } catch (error) {
      console.error(`❌ Fehler beim Abrufen der Binance Account Info: ${error.message}`);
      return { synced: false, reason: `Binance API Fehler: ${error.message}` };
    }
    
    const balance = accountInfo.balances.find(b => b.asset === baseAsset);
    const actualBalance = balance ? parseFloat(balance.free) + parseFloat(balance.locked) : 0;
    
    console.log(`📊 Binance Guthaben für ${baseAsset}: ${actualBalance} (Free: ${balance ? parseFloat(balance.free) : 0}, Locked: ${balance ? parseFloat(balance.locked) : 0})`);
    
    // Hole Position aus Datenbank (berücksichtige auch 'partial' für Rückwärtskompatibilität)
    const { data: position, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('strategy_id', strategyId)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .gt('quantity', 0)
      .maybeSingle();
    
    if (posError || !position) {
      // Keine Position in DB gefunden - alles OK
      console.log(`✅ Keine offene Position in DB für ${symbol} - Synchron`);
      return { synced: true, action: 'none', reason: 'Keine Position in DB' };
    }
    
    const dbQuantity = parseFloat(position.quantity);
    
    // Hole Lot Size Info für minimale handelbare Menge
    let minTradeableQuantity = 0.0001; // Fallback
    try {
      const lotSize = lotSizes[symbol];
      if (lotSize && lotSize.minQty) {
        minTradeableQuantity = parseFloat(lotSize.minQty) * 2; // 2x Minimum als Sicherheitspuffer
      }
    } catch (error) {
      console.warn(`⚠️  Konnte Lot Size nicht laden für ${symbol}`);
    }
    
    // Prüfe ob Position geschlossen werden muss
    if (actualBalance < minTradeableQuantity) {
      // Guthaben bei Binance ist sehr klein oder 0 - Position schließen
      console.log(`🔒 Guthaben bei Binance zu klein (${actualBalance} < ${minTradeableQuantity}) - Schließe Position`);
      
      // Entferne Verkaufssignal-State wenn Position geschlossen wird
      const positionKey = `${strategyId}_${symbol}`;
      if (pendingSellSignals.has(positionKey)) {
        console.log(`🧹 [${symbol}] Entferne Verkaufssignal-State (Position wird automatisch geschlossen)`);
        pendingSellSignals.delete(positionKey);
      }
      
      const { error: updateError } = await supabase
        .from('positions')
        .update({
          quantity: 0,
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', position.id);
      
      if (updateError) {
        console.error(`❌ Fehler beim Schließen der Position: ${updateError.message}`);
        return { synced: false, reason: updateError.message };
      }
      
      // Entferne aus In-Memory Map
      if (openPositions.has(positionKey)) {
        openPositions.delete(positionKey);
      }
      
      await logBotEvent('info', `Position automatisch geschlossen: Guthaben bei Binance zu klein`, {
        symbol: symbol,
        baseAsset: baseAsset,
        binanceBalance: actualBalance,
        dbQuantity: dbQuantity,
        minTradeableQuantity: minTradeableQuantity,
        strategy_id: strategyId
      });
      
      return { 
        synced: true, 
        action: 'closed', 
        reason: `Guthaben bei Binance zu klein: ${actualBalance} < ${minTradeableQuantity}`,
        binanceBalance: actualBalance,
        dbQuantity: dbQuantity
      };
    }
    
    // Prüfe ob DB-Quantity deutlich größer ist als tatsächliches Guthaben
    const difference = dbQuantity - actualBalance;
    const tolerance = Math.max(minTradeableQuantity, dbQuantity * 0.01); // 1% Toleranz oder Minimum
    
    if (difference > tolerance) {
      // DB zeigt mehr als tatsächlich vorhanden - aktualisiere DB
      console.log(`📊 DB-Quantity (${dbQuantity}) > Binance Balance (${actualBalance}) - Aktualisiere Position`);
      
      if (actualBalance < minTradeableQuantity) {
        // Schließe Position wenn Balance zu klein
        const { error: updateError } = await supabase
          .from('positions')
          .update({
            quantity: 0,
            status: 'closed',
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', position.id);
        
        if (!updateError) {
          const positionKey = `${strategyId}_${symbol}`;
          if (openPositions.has(positionKey)) {
            openPositions.delete(positionKey);
          }
        }
        
        return { 
          synced: true, 
          action: 'closed', 
          reason: `Position geschlossen: DB hatte ${dbQuantity}, Binance hat ${actualBalance}`,
          binanceBalance: actualBalance,
          dbQuantity: dbQuantity
        };
      } else {
        // Aktualisiere Quantity auf tatsächliches Guthaben
        const { error: updateError } = await supabase
          .from('positions')
          .update({
            quantity: actualBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', position.id);
        
        if (!updateError) {
          const positionKey = `${strategyId}_${symbol}`;
          if (openPositions.has(positionKey)) {
            openPositions.get(positionKey).quantity = actualBalance;
          }
        }
        
        return { 
          synced: true, 
          action: 'updated', 
          reason: `Position aktualisiert: ${dbQuantity} -> ${actualBalance}`,
          binanceBalance: actualBalance,
          dbQuantity: dbQuantity
        };
      }
    }
    
    // Prüfe auch ob Binance mehr hat als DB (könnte bedeuten dass außerhalb des Systems gekauft wurde)
    if (actualBalance > dbQuantity + tolerance) {
      console.log(`📊 Binance Balance (${actualBalance}) > DB-Quantity (${dbQuantity}) - Aktualisiere Position`);
      
      const { error: updateError } = await supabase
        .from('positions')
        .update({
          quantity: actualBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', position.id);
      
      if (!updateError) {
        const positionKey = `${strategyId}_${symbol}`;
        if (openPositions.has(positionKey)) {
          openPositions.get(positionKey).quantity = actualBalance;
        }
      }
      
      return { 
        synced: true, 
        action: 'updated', 
        reason: `Position aktualisiert: ${dbQuantity} -> ${actualBalance} (mehr bei Binance)`,
        binanceBalance: actualBalance,
        dbQuantity: dbQuantity
      };
    }
    
    // Position ist synchron
    console.log(`✅ Position synchron: DB=${dbQuantity}, Binance=${actualBalance}`);
    return { 
      synced: true, 
      action: 'none', 
      reason: 'Position synchron',
      binanceBalance: actualBalance,
      dbQuantity: dbQuantity
    };
    
  } catch (error) {
    console.error(`❌ Fehler bei Position-Synchronisation für ${symbol}:`, error);
    return { synced: false, reason: error.message };
  }
}

/**
 * Synchronisiert alle offenen Positionen mit Binance
 * STATE-OF-THE-ART: Periodische Synchronisation aller Positionen
 */
async function syncAllPositionsWithBinance() {
  try {
    console.log('🔄 Synchronisiere alle Positionen mit Binance...');
    
    const { data: positions, error } = await supabase
      .from('positions')
      .select('strategy_id, symbol')
      .in('status', ['open', 'partial'])
      .gt('quantity', 0);
    
    if (error) {
      console.error('❌ Fehler beim Laden der Positionen:', error);
      return;
    }
    
    if (!positions || positions.length === 0) {
      console.log('✅ Keine offenen Positionen zum Synchronisieren');
      return;
    }
    
    console.log(`📊 Synchronisiere ${positions.length} Position(en)...`);
    
    for (const position of positions) {
      await syncPositionWithBinance(position.strategy_id, position.symbol);
      // Kleine Pause zwischen Prüfungen um Rate Limits zu vermeiden
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('✅ Synchronisation abgeschlossen');
  } catch (error) {
    console.error('❌ Fehler bei der Synchronisation aller Positionen:', error);
  }
}

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
 * Gibt alle Basis-Strategien zurück (OHNE Coin-Zuordnung)
 * NEU: Strategien enthalten nur Basis-Konfiguration (Indikatoren, Typ)
 */
app.get('/api/strategies', async (req, res) => {
  try {
    const { data: strategies, error } = await supabase
      .from('strategies')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    // Normalisiere Config für Frontend: Nur Basis-Konfiguration
    const normalizedStrategies = strategies.map((strategy) => {
      const config = strategy.config || {};
      return {
        ...strategy,
        config: {
          type: config.type,
          timeframe: config.timeframe,
          indicators: config.indicators || {}
        }
      };
    });

    res.json({ 
      success: true, 
      strategies: normalizedStrategies 
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
 * Aktualisiert eine Basis-Strategie (nur Indikatoren, Typ, Zeitrahmen)
 * NEU: Coin-spezifische Einstellungen werden NICHT hier geändert!
 */
app.put('/api/strategies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updates = req.body;

    // Wenn config übergeben wird, normalisiere es zurück zur DB-Struktur
    if (updates.config) {
      const config = updates.config;
      const normalizedConfig = {
        type: config.type,
        timeframe: config.timeframe,
        // MA Short/Long zurück in indicators verschieben
        indicators: {
          ...config.indicators,
          ma_short: config.ma_short ?? config.indicators?.ma_short,
          ma_long: config.ma_long ?? config.indicators?.ma_long
        }
      };
      
      // Entferne die normalisierten Felder aus dem Root-Level
      delete normalizedConfig.ma_short;
      delete normalizedConfig.ma_long;
      
      updates = {
        ...updates,
        config: normalizedConfig
      };
    }

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
 * NEU: Coin-Strategien Endpunkte
 */

/**
 * Gibt alle Coins mit ihren zugewiesenen Strategien zurück
 */
app.get('/api/coins', async (req, res) => {
  try {
    const { data: coinStrategies, error } = await supabase
      .from('coin_strategies')
      .select(`
        *,
        strategies (
          id,
          name,
          description,
          config
        )
      `)
      .order('symbol', { ascending: true });

    if (error) throw error;

    // Kombiniere Daten für Frontend
    const coins = coinStrategies.map(cs => {
      const baseStrategy = cs.strategies || {};
      const coinConfig = cs.config || {};
      
      // Merge Configs
      const mergedConfig = {
        ...baseStrategy.config,
        settings: coinConfig.settings || {},
        risk: coinConfig.risk || {}
      };

      return {
        symbol: cs.symbol,
        strategy_id: cs.strategy_id,
        strategy_name: baseStrategy.name,
        strategy_description: baseStrategy.description,
        active: cs.active,
        config: mergedConfig,
        created_at: cs.created_at,
        updated_at: cs.updated_at
      };
    });

    res.json({ 
      success: true, 
      coins 
    });
  } catch (error) {
    console.error('Fehler beim Laden der Coins:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Coins',
      error: error.message
    });
  }
});

/**
 * Erstellt oder aktualisiert eine Coin-Strategie-Zuordnung
 */
app.put('/api/coins/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { strategy_id, active, config } = req.body;

    // Validiere dass Strategie existiert
    if (strategy_id) {
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .select('id')
        .eq('id', strategy_id)
        .single();

      if (strategyError || !strategy) {
        return res.status(400).json({
          success: false,
          message: 'Strategie nicht gefunden'
        });
      }
    }

    // Upsert coin_strategies
    const updateData = {
      symbol: symbol.toUpperCase(),
      strategy_id: strategy_id || null,
      active: active !== undefined ? active : false,
      updated_at: new Date().toISOString()
    };

    // Wenn config übergeben wird, speichere nur Coin-spezifische Einstellungen
    if (config) {
      updateData.config = {
        settings: config.settings || {},
        risk: config.risk || {}
      };
    }

    const { data: coinStrategy, error } = await supabase
      .from('coin_strategies')
      .upsert(updateData, { onConflict: 'symbol' })
      .select(`
        *,
        strategies (
          id,
          name,
          description,
          config
        )
      `)
      .single();

    if (error) throw error;

    // Kombiniere für Response
    const baseStrategy = coinStrategy.strategies || {};
    const coinConfig = coinStrategy.config || {};
    const mergedConfig = {
      ...baseStrategy.config,
      settings: coinConfig.settings || {},
      risk: coinConfig.risk || {}
    };

    res.json({ 
      success: true, 
      coin: {
        symbol: coinStrategy.symbol,
        strategy_id: coinStrategy.strategy_id,
        strategy_name: baseStrategy.name,
        active: coinStrategy.active,
        config: mergedConfig
      }
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Coin-Strategie:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Aktualisieren der Coin-Strategie',
      error: error.message
    });
  }
});

/**
 * Toggle Coin aktiv/inaktiv
 */
app.patch('/api/coins/:symbol/toggle', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { active } = req.body;

    const { data: coinStrategy, error } = await supabase
      .from('coin_strategies')
      .update({ active: active })
      .eq('symbol', symbol.toUpperCase())
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      coin: coinStrategy 
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

    // Gesamtzahl der Trades für Pagination
    const { count: totalCount, error: countError } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Trades mit Pagination laden
    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({ 
      success: true, 
      trades: trades || [],
      total: totalCount || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
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
 * Gibt Trade-Statistiken zurück (Käufe/Verkäufe pro Strategie und Coin, Performance)
 */
app.get('/api/trades/stats', async (req, res) => {
  try {
    // Lade alle Trades für Statistiken
    const { data: allTrades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false });

    if (tradesError) throw tradesError;

    // Lade alle Strategien für Namen-Mapping
    const { data: strategies, error: strategiesError } = await supabase
      .from('strategies')
      .select('id, name');

    if (strategiesError) throw strategiesError;

    // Erstelle Strategie-ID zu Name Mapping
    const strategyMap = new Map();
    (strategies || []).forEach(s => strategyMap.set(s.id, s.name));

    // Statistiken pro Strategie
    const statsByStrategy = new Map();
    // Statistiken pro Coin
    const statsByCoin = new Map();

    (allTrades || []).forEach(trade => {
      const strategyName = strategyMap.get(trade.strategy_id) || 'Unbekannt';
      const isBuy = trade.side.toLowerCase() === 'buy';
      const pnl = trade.pnl || 0;

      // Statistiken pro Strategie
      if (!statsByStrategy.has(trade.strategy_id)) {
        statsByStrategy.set(trade.strategy_id, {
          strategy_id: trade.strategy_id,
          strategy_name: strategyName,
          buys: 0,
          sells: 0,
          total_pnl: 0
        });
      }
      const strategyStats = statsByStrategy.get(trade.strategy_id);
      if (isBuy) {
        strategyStats.buys++;
      } else {
        strategyStats.sells++;
      }
      strategyStats.total_pnl += pnl;

      // Statistiken pro Coin
      if (!statsByCoin.has(trade.symbol)) {
        statsByCoin.set(trade.symbol, {
          symbol: trade.symbol,
          buys: 0,
          sells: 0,
          total_pnl: 0
        });
      }
      const coinStats = statsByCoin.get(trade.symbol);
      if (isBuy) {
        coinStats.buys++;
      } else {
        coinStats.sells++;
      }
      coinStats.total_pnl += pnl;
    });

    res.json({
      success: true,
      by_strategy: Array.from(statsByStrategy.values()),
      by_coin: Array.from(statsByCoin.values())
    });
  } catch (error) {
    console.error('Fehler beim Laden der Trade-Statistiken:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Trade-Statistiken',
      error: error.message
    });
  }
});

/**
 * Gibt Bot-Einstellungen zurück
 */
app.get('/api/bot-settings', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('bot_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) throw error;

    // Konvertiere Array zu Objekt für einfacheren Zugriff
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    res.json({
      success: true,
      settings: settingsObj,
      raw: settings // Auch das rohe Array zurückgeben für Vollständigkeit
    });
  } catch (error) {
    console.error('Fehler beim Laden der Bot-Einstellungen:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Bot-Einstellungen',
      error: error.message
    });
  }
});

/**
 * Aktualisiert Bot-Einstellungen
 */
app.put('/api/bot-settings', async (req, res) => {
  try {
    const { settings } = req.body; // Erwartet: { key: value, ... }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Ungültige Einstellungen'
      });
    }

    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase
        .from('bot_settings')
        .update({ value: value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) {
        console.error(`Fehler beim Aktualisieren von ${key}:`, error);
        // Versuche zu erstellen falls nicht vorhanden
        const { error: insertError } = await supabase
          .from('bot_settings')
          .insert({ key, value, updated_at: new Date().toISOString() });

        if (insertError) {
          throw insertError;
        }
      }
    }

    // Lade Bot-Settings neu (wichtig für laufenden Bot)
    await loadBotSettings(true);

    res.json({
      success: true,
      message: 'Bot-Einstellungen aktualisiert'
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Bot-Einstellungen:', error);
    res.status(500).json({
      success: false,
      message: 'Fehler beim Aktualisieren der Bot-Einstellungen',
      error: error.message
    });
  }
});

/**
 * Gibt offene Positionen zurück
 * Nutzt die neue positions Tabelle für explizites Position-Tracking
 */
app.get('/api/positions', async (req, res) => {
  try {
    // Lade offene Positionen aus der positions Tabelle mit Strategy-Infos
    // WICHTIG: Nur Positionen mit Status 'open' werden angezeigt (nicht 'partial')
    // Reduzierte Positionen werden nicht mehr als "offen" angezeigt
    const { data: positions, error } = await supabase
      .from('positions')
      .select(`
        *,
        strategies:strategy_id (
          id,
          name,
          symbol,
          config
        )
      `)
      .eq('status', 'open')
      .gt('quantity', 0);
    
    if (error) {
      console.error('Fehler beim Laden der Positionen:', error);
      throw error;
    }
    
    console.log(`📊 ${positions?.length || 0} offene Positionen gefunden`);
    
    const allPositions = [];
    
    // Bearbeite jede Position
    for (const position of (positions || [])) {
      // Hole aktuellen Preis von Binance (falls verfügbar)
      let currentPrice = position.entry_price; // Fallback
      try {
        if (binanceClient && position.symbol) {
          const ticker = await binanceClient.prices({ symbol: position.symbol });
          currentPrice = parseFloat(ticker[position.symbol]) || position.entry_price;
        }
      } catch (error) {
        console.warn(`⚠️  Konnte aktuellen Preis für ${position.symbol} nicht laden:`, error.message);
      }
      
      const quantity = parseFloat(position.quantity);
      const entryPrice = parseFloat(position.entry_price);
      const pnl = (currentPrice - entryPrice) * quantity;
      const pnlPercent = entryPrice > 0 
        ? ((currentPrice - entryPrice) / entryPrice) * 100 
        : 0;
      
      const strategyName = position.strategies?.name || 'Unbekannt';
      const baseStrategy = position.strategies;
      
      // Lade vollständige Strategie-Konfiguration (inkl. coin_strategies)
      let fullStrategyConfig = null;
      let maShort = null;
      let maLong = null;
      let maCrossSellPrice = null;
      let stopLossPrice = null;
      let takeProfitPrice = null;
      let trailingStopPrice = null;
      let useTrailingStop = false;
      
      if (baseStrategy && position.symbol) {
        try {
          // Lade coin_strategies für dieses Symbol
          const { data: coinStrategy, error: coinError } = await supabase
            .from('coin_strategies')
            .select('config')
            .eq('strategy_id', position.strategy_id)
            .eq('symbol', position.symbol)
            .single();
          
          if (!coinError && coinStrategy) {
            // Merge Configs: Basis (strategies) + Coin-spezifisch (coin_strategies)
            const baseConfig = baseStrategy.config || {};
            const coinConfig = coinStrategy.config || {};
            fullStrategyConfig = {
              ...baseConfig,
              settings: coinConfig.settings || {},
              risk: coinConfig.risk || {}
            };
          } else {
            // Fallback: Nur Basis-Strategie Config
            fullStrategyConfig = baseStrategy.config || {};
          }
          
          // Hole Preis-Historie für MA-Berechnung
          let priceHistory = priceHistories.get(position.symbol) || [];
          
          // Wenn keine Historie vorhanden, versuche von Binance zu laden
          if (priceHistory.length === 0 && binanceClient) {
            try {
              // Verwende Zeitrahmen aus Strategie oder Fallback zu '1h'
              const timeframe = fullStrategyConfig?.timeframe || '1h';
              // Lade letzte 100 Kerzen für MA-Berechnung
              const candles = await binanceClient.candles({
                symbol: position.symbol,
                interval: timeframe,
                limit: 100
              });
              
              if (candles && candles.length > 0) {
                priceHistory = candles.map(c => parseFloat(c.close));
              }
            } catch (err) {
              console.warn(`⚠️  Konnte Preis-Historie für ${position.symbol} nicht laden:`, err.message);
            }
          }
          
          // Berechne MA-Werte wenn Historie vorhanden
          if (priceHistory.length > 0 && fullStrategyConfig) {
            const maShortPeriod = fullStrategyConfig.indicators?.ma_short ?? botSettings.default_indicators_ma_short;
            const maLongPeriod = fullStrategyConfig.indicators?.ma_long ?? botSettings.default_indicators_ma_long;
            
            if (maShortPeriod && maLongPeriod) {
              maShort = calculateMA(priceHistory, maShortPeriod);
              maLong = calculateMA(priceHistory, maLongPeriod);
              
              // Verkaufspreis bei MA Cross: Wenn MA Short < MA Long wird, wird zum aktuellen Preis verkauft
              // Wir zeigen den Preis, bei dem das Signal ausgelöst würde
              if (maShort && maLong) {
                // Wenn MA Short bereits unter MA Long ist, würde sofort verkauft werden
                if (maShort < maLong) {
                  maCrossSellPrice = currentPrice; // Würde sofort verkauft werden
                } else {
                  // Würde verkauft werden, wenn MA Short unter MA Long fällt
                  // Schätzung: Preis würde etwa bei MA Long liegen
                  maCrossSellPrice = maLong;
                }
              }
            }
          }
          
          // Berechne Stop Loss Preise und Take Profit
          if (fullStrategyConfig?.risk) {
            const stopLossPercent = fullStrategyConfig.risk.stop_loss_percent ?? 0;
            const takeProfitPercent = fullStrategyConfig.risk.take_profit_percent ?? 0;
            useTrailingStop = fullStrategyConfig.risk.use_trailing_stop === true;
            
            // Stop Loss / Trailing Stop Loss
            if (stopLossPercent > 0) {
              if (useTrailingStop) {
                // Trailing Stop Loss: Verwende den aktuellen trailing_stop_price aus der Position
                trailingStopPrice = position.trailing_stop_price 
                  ? parseFloat(position.trailing_stop_price) 
                  : null;
                
                // Wenn kein trailing_stop_price gesetzt ist, berechne initialen Wert
                if (!trailingStopPrice && position.highest_price) {
                  const highestPrice = parseFloat(position.highest_price);
                  trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
                } else if (!trailingStopPrice) {
                  // Fallback: Berechne basierend auf Entry Price
                  trailingStopPrice = entryPrice * (1 - stopLossPercent / 100);
                }
              } else {
                // Statischer Stop Loss
                stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
              }
            }
            
            // Take Profit (nur wenn TSL nicht aktiv)
            if (!useTrailingStop && takeProfitPercent > 0) {
              takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
            }
          }
        } catch (configError) {
          console.warn(`⚠️  Fehler beim Laden der Strategie-Konfiguration für ${position.symbol}:`, configError.message);
        }
      }
      
      // Berechne Trade Cooldown Information
      const now = Date.now();
      const tradeCooldownMs = fullStrategyConfig?.settings?.trade_cooldown_ms || 0;
      const lastTradeTime = lastTradeTimes.get(position.symbol) || 0;
      const cooldownRemainingMs = tradeCooldownMs > 0 && lastTradeTime > 0
        ? Math.max(0, tradeCooldownMs - (now - lastTradeTime))
        : 0;
      const cooldownRemainingSeconds = Math.round(cooldownRemainingMs / 1000);
      const cooldownRemainingMinutes = Math.round(cooldownRemainingMs / 60000);
      
      allPositions.push({
        id: position.id,
        symbol: position.symbol,
        quantity: quantity,
        entryPrice: entryPrice,
        currentPrice: currentPrice,
        pnl: pnl,
        pnlPercent: pnlPercent,
        strategyId: position.strategy_id,
        strategyName: strategyName,
        createdAt: position.opened_at,
        // Neue Felder für Verkaufsinformationen
        maShort: maShort,
        maLong: maLong,
        maCrossSellPrice: maCrossSellPrice,
        stopLossPrice: stopLossPrice,
        takeProfitPrice: takeProfitPrice,
        trailingStopPrice: trailingStopPrice,
        useTrailingStop: useTrailingStop,
        // Cooldown Information
        tradeCooldownMs: tradeCooldownMs,
        cooldownRemainingMs: cooldownRemainingMs,
        cooldownRemainingSeconds: cooldownRemainingSeconds,
        cooldownRemainingMinutes: cooldownRemainingMinutes,
        lastTradeTime: lastTradeTime > 0 ? new Date(lastTradeTime).toISOString() : null
      });
      
      console.log(`📍 Position #${position.id} gefunden: ${position.symbol} | Strategie: ${strategyName} | Menge: ${quantity} | Entry: ${entryPrice} | Aktuell: ${currentPrice.toFixed(8)}`);
    }

    console.log(`📊 API gibt ${allPositions.length} offene Positionen zurück`);

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
 * Gibt Testnet-Guthaben zurück
 */
app.get('/api/testnet-balance', async (req, res) => {
  try {
    if (!binanceClient) {
      return res.status(400).json({ 
        error: 'Binance Client nicht verfügbar',
        testnet: true 
      });
    }
    
    const accountInfo = await binanceClient.accountInfo();
    const balances = accountInfo.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked)
      }))
      .sort((a, b) => b.total - a.total); // Sortiere nach Gesamtbetrag
    
    // Finde USDT-Balance separat für einfachen Zugriff
    const usdtBalance = balances.find(b => b.asset === 'USDT');
    
    res.json({
      success: true,
      balances: balances,
      usdt: usdtBalance ? {
        free: usdtBalance.free,
        locked: usdtBalance.locked,
        total: usdtBalance.total
      } : null,
      testnet: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fehler beim Abrufen des Testnet-Guthabens:', error);
    res.status(500).json({
      error: error.message,
      code: error.code,
      testnet: true
    });
  }
});

/**
 * Führt einen direkten Verkauf aus dem Wallet aus
 */
app.post('/api/sell', async (req, res) => {
  try {
    const { asset, quantity, symbol } = req.body;

    if (!asset || !quantity || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'asset, quantity und symbol sind erforderlich'
      });
    }

    if (!binanceClient) {
      return res.status(400).json({
        success: false,
        error: 'Binance Client nicht verfügbar'
      });
    }

    // Prüfe verfügbares Guthaben
    const accountInfo = await binanceClient.accountInfo();
    const balance = accountInfo.balances.find(b => b.asset === asset);
    
    if (!balance || parseFloat(balance.free) < parseFloat(quantity)) {
      return res.status(400).json({
        success: false,
        error: `Nicht genügend ${asset} verfügbar. Verfügbar: ${balance ? parseFloat(balance.free) : 0}, Angefragt: ${quantity}`
      });
    }

    // Hole Lot Size Regeln für das Symbol
    const lotSize = lotSizes[symbol];
    if (!lotSize) {
      return res.status(400).json({
        success: false,
        error: `Keine Lot Size Konfiguration für ${symbol} gefunden`
      });
    }

    // Runde Menge auf Step Size
    let roundedQuantity = Math.floor(parseFloat(quantity) / lotSize.stepSize) * lotSize.stepSize;
    roundedQuantity = parseFloat(roundedQuantity.toFixed(lotSize.decimals));

    // Prüfe Min/Max
    if (roundedQuantity < lotSize.minQty) {
      return res.status(400).json({
        success: false,
        error: `Menge ${roundedQuantity} ist kleiner als Minimum ${lotSize.minQty}`
      });
    }
    if (roundedQuantity > lotSize.maxQty) {
      return res.status(400).json({
        success: false,
        error: `Menge ${roundedQuantity} ist größer als Maximum ${lotSize.maxQty}`
      });
    }

    // Prüfe verfügbares Guthaben nochmal mit gerundeter Menge
    if (parseFloat(balance.free) < roundedQuantity) {
      return res.status(400).json({
        success: false,
        error: `Nicht genügend ${asset} verfügbar nach Rundung. Verfügbar: ${parseFloat(balance.free)}, Benötigt: ${roundedQuantity}`
      });
    }

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🔄 FÜHRE MANUELLEN VERKAUF AUS`);
    console.log('═══════════════════════════════════════════════');
    console.log(`📊 Symbol: ${symbol}`);
    console.log(`💰 Asset: ${asset}`);
    console.log(`🔢 Menge: ${roundedQuantity}`);
    console.log('═══════════════════════════════════════════════');

    // Verkaufs-Order auf Binance Testnet platzieren
    const order = await binanceClient.order({
      symbol: symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: roundedQuantity.toString()
    });

    // Durchschnittspreis berechnen
    const avgPrice = order.fills && order.fills.length > 0
      ? order.fills.reduce((sum, fill) => sum + parseFloat(fill.price), 0) / order.fills.length
      : 0;

    const executedQty = parseFloat(order.executedQty);
    const total = avgPrice * executedQty;

    console.log(`✅ Verkauf erfolgreich!`);
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Ausgeführte Menge: ${executedQty}`);
    console.log(`   Durchschnittspreis: ${avgPrice.toFixed(8)} USDT`);
    console.log(`   Gesamtwert: ${total.toFixed(2)} USDT`);
    console.log('═══════════════════════════════════════════════');
    console.log('');

    // Trade in Datenbank speichern (ohne strategy_id für manuelle Trades)
    const { data: tradeData, error: dbError } = await supabase
      .from('trades')
      .insert({
        strategy_id: null, // Manueller Trade
        symbol: symbol,
        side: 'sell',
        price: avgPrice,
        quantity: executedQty,
        total: total,
        order_id: order.orderId.toString(),
        status: 'executed',
        executed_at: new Date().toISOString(),
        pnl: null, // Kein PnL für manuelle Trades ohne Entry-Preis
        exit_reason: 'manual', // NEU: Manueller Verkauf
        metadata: {
          manual: true,
          asset: asset,
          exit_reason: 'manual', // Auch in metadata
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

    if (dbError) {
      console.error('⚠️  Fehler beim Speichern in Datenbank:', dbError);
      // Trade war erfolgreich, auch wenn DB-Speicherung fehlschlug
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        symbol: symbol,
        side: 'SELL',
        quantity: executedQty,
        price: avgPrice,
        total: total,
        status: order.status
      },
      trade: tradeData ? tradeData[0] : null
    });

  } catch (error) {
    console.error('❌ Fehler beim Verkauf:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unbekannter Fehler beim Verkauf'
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
 * Validiert ob alle erforderlichen Bot-Einstellungen vorhanden sind
 * @param {Object} settings - Die geladenen Bot-Einstellungen
 * @returns {Object} { valid: boolean, missing: string[] }
 */
function validateBotSettings(settings) {
  const requiredSettings = [
    // Hinweis: trade_cooldown_ms und signal_cooldown_ms werden jetzt pro Coin konfiguriert (in coin_strategies.config.settings)
    'max_concurrent_trades',
    'default_trade_size_usdt',
    'signal_threshold_percent',
    'max_price_history',
    'max_total_exposure_usdt',
    'logging_price_log_interval',
    'logging_hold_log_interval',
    'default_indicators_ma_short',
    'default_indicators_ma_long',
    'default_indicators_rsi_period',
    'default_indicators_rsi_overbought',
    'default_indicators_rsi_oversold',
    'default_indicators_macd_fast_period',
    'default_indicators_macd_slow_period',
    'default_indicators_macd_signal_period',
    'default_indicators_bollinger_period',
    'default_indicators_bollinger_std_dev'
  ];
  
  const missing = [];
  requiredSettings.forEach(key => {
    if (settings[key] === undefined || settings[key] === null) {
      missing.push(key);
    }
  });
  
  return {
    valid: missing.length === 0,
    missing: missing
  };
}

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
      // Normale Settings
      else {
        botSettings[key] = value;
      }
    });

    // Validierung: Prüfe ob alle erforderlichen Einstellungen vorhanden sind
    const validation = validateBotSettings(botSettings);
    if (!validation.valid) {
      console.error('');
      console.error('═══════════════════════════════════════════════');
      console.error('❌ FEHLER: Bot-Einstellungen nicht vollständig!');
      console.error('═══════════════════════════════════════════════');
      console.error('Fehlende Einstellungen in bot_settings:');
      validation.missing.forEach(key => {
        console.error(`   - ${key}`);
      });
      console.error('');
      console.error('💡 Bitte fügen Sie die fehlenden Einstellungen in Supabase hinzu!');
      console.error('═══════════════════════════════════════════════');
      console.error('');
      return false;
    }

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
 * Lädt aktive Trading-Strategien von Supabase
 * NEU: Lädt coin_strategies mit JOIN zu strategies
 * - Symbol kommt aus coin_strategies
 * - Basis-Konfiguration (Indikatoren) kommt aus strategies
 * - Coin-spezifische Einstellungen (Settings, Risk) kommen aus coin_strategies
 */
async function loadStrategies() {
  try {
    console.log('📊 Lade aktive Coin-Strategien von Supabase...');
    
    // Lade coin_strategies mit JOIN zu strategies
    const { data: coinStrategies, error } = await supabase
      .from('coin_strategies')
      .select(`
        *,
        strategies (
          id,
          name,
          description,
          config
        )
      `)
      .eq('active', true);

    if (error) {
      console.error('❌ Fehler beim Laden der Coin-Strategien:', error);
      return [];
    }

    if (!coinStrategies || coinStrategies.length === 0) {
      console.log('⚠️  Keine aktiven Coin-Strategien gefunden');
      console.log('💡 Tipp: Aktivieren Sie einen Coin in Supabase (Table Editor → coin_strategies → active = true)');
      return [];
    }

    // Kombiniere Daten: Basis-Strategie + Coin-spezifische Einstellungen
    const strategies = coinStrategies
      .filter(cs => cs.strategies) // Nur wenn Strategie existiert
      .map(cs => {
        const baseStrategy = cs.strategies;
        const coinConfig = cs.config || {};
        
        // Merge Configs: Basis (strategies) + Coin-spezifisch (coin_strategies)
        const mergedConfig = {
          ...baseStrategy.config, // Basis: type, timeframe, indicators
          settings: coinConfig.settings || {}, // Coin-spezifisch: thresholds, cooldowns
          risk: coinConfig.risk || {} // Coin-spezifisch: trade size, stop loss, etc.
        };
        
        return {
          id: baseStrategy.id,
          name: baseStrategy.name,
          description: baseStrategy.description,
          symbol: cs.symbol, // Symbol kommt aus coin_strategies!
          active: cs.active,
          config: mergedConfig
        };
      });

    // Validierung: Prüfe ob alle Strategien vollständig konfiguriert sind
    const requiredSettings = ['signal_threshold_percent', 'signal_cooldown_ms', 'trade_cooldown_ms'];
    const requiredRisk = ['max_trade_size_usdt'];
    const invalidStrategies = [];
    
    strategies.forEach(strategy => {
      const missing = [];
      const settings = strategy.config?.settings || {};
      const risk = strategy.config?.risk || {};
      const indicators = strategy.config?.indicators || {};
      
      // Prüfe Settings
      requiredSettings.forEach(setting => {
        if (settings[setting] === undefined || settings[setting] === null) {
          missing.push(`config.settings.${setting}`);
        }
      });
      
      // Prüfe Risk Management
      requiredRisk.forEach(setting => {
        if (risk[setting] === undefined || risk[setting] === null) {
          missing.push(`config.risk.${setting}`);
        }
      });
      
      // Prüfe Indikatoren (mindestens MA Short und Long müssen vorhanden sein)
      if (indicators.ma_short === undefined || indicators.ma_short === null) {
        missing.push('config.indicators.ma_short');
      }
      if (indicators.ma_long === undefined || indicators.ma_long === null) {
        missing.push('config.indicators.ma_long');
      }
      
      // Prüfe ob Lot Size für Symbol vorhanden ist
      if (!lotSizes[strategy.symbol]) {
        missing.push(`lot_size_${strategy.symbol} (in bot_settings)`);
      }
      
      if (missing.length > 0) {
        invalidStrategies.push({
          name: strategy.name,
          symbol: strategy.symbol,
          missing: missing
        });
      }
    });
    
    if (invalidStrategies.length > 0) {
      console.error('');
      console.error('═══════════════════════════════════════════════');
      console.error('❌ FEHLER: Coin-Strategien nicht vollständig konfiguriert!');
      console.error('═══════════════════════════════════════════════');
      invalidStrategies.forEach(strategy => {
        console.error(`   ❌ ${strategy.name} (${strategy.symbol}):`);
        strategy.missing.forEach(setting => {
          console.error(`      - ${setting} fehlt`);
        });
      });
      console.error('');
      console.error('💡 Bitte fügen Sie die fehlenden Einstellungen hinzu:');
      console.error('   - In coin_strategies.config.settings: signal_threshold_percent, signal_cooldown_ms, trade_cooldown_ms');
      console.error('   - In coin_strategies.config.risk: max_trade_size_usdt');
      console.error('   - In strategies.config.indicators: ma_short, ma_long');
      console.error('   - In bot_settings: lot_size_SYMBOL für jedes verwendete Symbol');
      console.error('═══════════════════════════════════════════════');
      console.error('');
      
      // Entferne ungültige Strategien aus der Liste
      const validStrategies = strategies.filter(strategy => {
        const settings = strategy.config?.settings || {};
        const risk = strategy.config?.risk || {};
        const indicators = strategy.config?.indicators || {};
        
        const hasAllSettings = requiredSettings.every(setting => 
          settings[setting] !== undefined && settings[setting] !== null
        );
        const hasAllRisk = requiredRisk.every(setting => 
          risk[setting] !== undefined && risk[setting] !== null
        );
        const hasIndicators = (indicators.ma_short !== undefined && indicators.ma_short !== null) &&
                              (indicators.ma_long !== undefined && indicators.ma_long !== null);
        const hasLotSize = !!lotSizes[strategy.symbol];
        
        return hasAllSettings && hasAllRisk && hasIndicators && hasLotSize;
      });
      
      if (validStrategies.length === 0) {
        console.error('❌ Keine gültigen Coin-Strategien gefunden - Bot kann nicht starten!');
        return [];
      }
      
      console.log(`⚠️  Nur ${validStrategies.length} von ${strategies.length} Coin-Strategie(n) sind gültig`);
      return validStrategies;
    }

    console.log(`✅ ${strategies.length} aktive Coin-Strategie(n) geladen:`);
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
  
  // Indikator-Parameter aus Strategie oder Bot-Settings (OHNE Fallback)
  const maShortPeriod = config.indicators?.ma_short ?? botSettings.default_indicators_ma_short;
  const maLongPeriod = config.indicators?.ma_long ?? botSettings.default_indicators_ma_long;
  
  if (maShortPeriod === undefined || maShortPeriod === null) {
    console.error(`❌ FEHLER: ma_short nicht konfiguriert (weder in Strategie noch in bot_settings)!`);
    return {
      action: 'error',
      reason: `Konfigurationsfehler: ma_short fehlt`
    };
  }
  
  if (maLongPeriod === undefined || maLongPeriod === null) {
    console.error(`❌ FEHLER: ma_long nicht konfiguriert (weder in Strategie noch in bot_settings)!`);
    return {
      action: 'error',
      reason: `Konfigurationsfehler: ma_long fehlt`
    };
  }

  // Prüfen ob genug Daten vorhanden
  const rsiPeriod = config.indicators?.rsi_period ?? botSettings.default_indicators_rsi_period ?? 0;
  const macdSlowPeriod = config.indicators?.macd_slow_period ?? botSettings.default_indicators_macd_slow_period ?? 0;
  const requiredData = Math.max(maLongPeriod, rsiPeriod, macdSlowPeriod);
  
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
  const rsiPeriodValue = config.indicators?.rsi_period ?? botSettings.default_indicators_rsi_period;
  if (rsiPeriodValue !== undefined && rsiPeriodValue !== null) {
    indicators.rsi = calculateRSI(priceHistory, rsiPeriodValue);
  }

  // MACD berechnen (wenn aktiviert)
  const macdFastPeriod = config.indicators?.macd_fast_period ?? botSettings.default_indicators_macd_fast_period;
  if (macdFastPeriod !== undefined && macdFastPeriod !== null) {
    const macdSlowPeriodValue = config.indicators?.macd_slow_period ?? botSettings.default_indicators_macd_slow_period;
    const macdSignalPeriod = config.indicators?.macd_signal_period ?? botSettings.default_indicators_macd_signal_period;
    
    if (macdSlowPeriodValue === undefined || macdSlowPeriodValue === null || 
        macdSignalPeriod === undefined || macdSignalPeriod === null) {
      console.error(`❌ FEHLER: MACD-Parameter nicht vollständig konfiguriert!`);
    } else {
      indicators.macd = calculateMACD(
        priceHistory,
        macdFastPeriod,
        macdSlowPeriodValue,
        macdSignalPeriod
      );
    }
  }

  // Bollinger Bands berechnen (wenn aktiviert)
  const bollingerPeriod = config.indicators?.bollinger_period ?? botSettings.default_indicators_bollinger_period;
  if (bollingerPeriod !== undefined && bollingerPeriod !== null) {
    const bollingerStdDev = config.indicators?.bollinger_std_dev ?? botSettings.default_indicators_bollinger_std_dev;
    
    if (bollingerStdDev === undefined || bollingerStdDev === null) {
      console.error(`❌ FEHLER: Bollinger Bands Standard Deviation nicht konfiguriert!`);
    } else {
      indicators.bollinger = calculateBollingerBands(
        priceHistory,
        bollingerPeriod,
        bollingerStdDev
      );
    }
  }

  // Signal-Confidence basierend auf Indikatoren berechnen
  let confidence = Math.min(Math.abs(differencePercent) * 10, 100);
  let additionalReasons = [];

  // RSI-Filter
  if (indicators.rsi !== null) {
    const rsiOverbought = config.indicators?.rsi_overbought ?? botSettings.default_indicators_rsi_overbought;
    const rsiOversold = config.indicators?.rsi_oversold ?? botSettings.default_indicators_rsi_oversold;
    
    if (rsiOverbought === undefined || rsiOverbought === null || 
        rsiOversold === undefined || rsiOversold === null) {
      console.error(`❌ FEHLER: RSI Overbought/Oversold nicht konfiguriert!`);
    } else {
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

  // WICHTIG: Strategien generieren KEINE Verkaufssignale mehr!
  // Verkäufe werden ausschließlich durch Stop-Loss, Take-Profit oder Trailing Stop ausgelöst.
  // Bei bearish Signal: Einfach 'hold' zurückgeben (keine Aktion)
  
  // Bearish-Crossover erkannt, aber keine Verkaufsaktion
  if (differencePercent < -threshold) {
    return {
      action: 'hold',
      reason: `MA Crossover Bearish erkannt: MA${maShortPeriod}=${maShort.toFixed(2)} < MA${maLongPeriod}=${maLong.toFixed(2)} (Verkäufe nur durch SL/TP/TSL)${additionalReasons.length > 0 ? ' | ' + additionalReasons.join(', ') : ''}`,
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

  // Historie begrenzen (aus Supabase - MUSS vorhanden sein)
  const maxPriceHistory = botSettings.max_price_history;
  if (maxPriceHistory === undefined || maxPriceHistory === null) {
    console.error(`❌ FEHLER: max_price_history nicht in bot_settings konfiguriert!`);
    return {
      action: 'error',
      reason: 'Konfigurationsfehler: max_price_history fehlt'
    };
  }
  if (priceHistory.length > maxPriceHistory) {
    priceHistory.shift();
  }

  // Signal generieren mit symbol-spezifischer Historie
  return generateSignal(currentPrice, strategy, priceHistory);
}

/**
 * Prüft offene Positionen auf Stop-Loss und Take-Profit
 * Unterstützt sowohl statischen als auch Trailing Stop Loss
 * @param {number} currentPrice - Der aktuelle Preis
 * @param {string} symbol - Das Trading-Symbol
 */
async function checkStopLossTakeProfit(currentPrice, symbol) {
  // KRITISCH: Prüfe Positionen direkt aus der DATENBANK (wie canTrade es tut)
  // Die In-Memory Map kann leer oder veraltet sein - daher DB als Quelle der Wahrheit!
  const { data: dbPositions, error } = await supabase
    .from('positions')
    .select('*')
    .eq('symbol', symbol)
    .eq('status', 'open') // Nur wirklich offene Positionen prüfen (nicht 'partial')
    .gt('quantity', 0);
  
  if (error) {
    console.error(`❌ Fehler beim Laden der Positionen für ${symbol}:`, error);
    return;
  }
  
  if (!dbPositions || dbPositions.length === 0) {
    // Keine Positionen in DB - bereinige In-Memory Map falls vorhanden
    const positionsInMemory = Array.from(openPositions.entries()).filter(
      ([key, pos]) => pos.symbol === symbol
    );
    if (positionsInMemory.length > 0) {
      console.log(`🧹 [${symbol}] Bereinige ${positionsInMemory.length} veraltete Position(en) aus Memory`);
      for (const [key, pos] of positionsInMemory) {
        openPositions.delete(key);
      }
    }
    return;
  }
  
  // Prüfe jede Position aus der Datenbank
  for (const dbPosition of dbPositions) {
    const positionKey = `${dbPosition.strategy_id}_${symbol}`;
    
    // KRITISCH: Prüfe ob bereits ein Verkaufssignal für diese Position aktiv ist
    // Verhindert mehrfache Signale bei jedem Preis-Update
    const pendingSignal = pendingSellSignals.get(positionKey);
    if (pendingSignal) {
      const signalAge = Date.now() - pendingSignal.timestamp;
      const maxSignalAge = 60000; // 60 Sekunden - Signal wird automatisch zurückgesetzt wenn zu alt
      
      if (signalAge < maxSignalAge) {
        // Signal ist noch aktiv - überspringe weitere Prüfungen
        continue;
      } else {
        // Signal ist zu alt - entferne es (möglicherweise hängengeblieben)
        console.log(`🧹 [${symbol}] Entferne veraltetes Verkaufssignal (${Math.round(signalAge / 1000)}s alt)`);
        pendingSellSignals.delete(positionKey);
      }
    }
    
    // Finde die zugehörige Strategie
    const strategy = activeStrategies.find(s => s.id === dbPosition.strategy_id);
    if (!strategy) {
      console.warn(`⚠️  Keine Strategie gefunden für Position ${positionKey}`);
      continue;
    }
    
    // Hole Stop-Loss und Take-Profit aus Strategie-Config
    const stopLossPercent = strategy.config.risk?.stop_loss_percent ?? 0;
    const takeProfitPercent = strategy.config.risk?.take_profit_percent ?? 0;
    const useTrailingStop = strategy.config.risk?.use_trailing_stop === true;
    const activationThreshold = strategy.config.risk?.trailing_stop_activation_threshold ?? 0;
    
    // Wenn beide deaktiviert sind, überspringe
    if (stopLossPercent === 0 && takeProfitPercent === 0) {
      continue;
    }
    
    // Lade Position-Daten aus DB
    const entryPrice = parseFloat(dbPosition.entry_price);
    const quantity = parseFloat(dbPosition.quantity);
    const highestPrice = dbPosition.highest_price ? parseFloat(dbPosition.highest_price) : entryPrice;
    const trailingStopPrice = dbPosition.trailing_stop_price ? parseFloat(dbPosition.trailing_stop_price) : null;
    
    // Berechne Preisänderung in Prozent (relativ zum Entry Price)
    const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    // Synchronisiere In-Memory Map mit DB (für schnellen Zugriff)
    const position = openPositions.has(positionKey) 
      ? openPositions.get(positionKey)
      : {
          symbol: symbol,
          entryPrice: entryPrice,
          quantity: quantity,
          orderId: dbPosition.id,
          timestamp: new Date(dbPosition.opened_at),
          strategyId: dbPosition.strategy_id,
          highestPrice: highestPrice,
          trailingStopPrice: trailingStopPrice,
          useTrailingStop: dbPosition.use_trailing_stop === true,
          trailingStopActivationThreshold: dbPosition.trailing_stop_activation_threshold ? parseFloat(dbPosition.trailing_stop_activation_threshold) : 0
        };
    
    // Update In-Memory Map mit aktuellen DB-Werten
    position.entryPrice = entryPrice;
    position.quantity = quantity;
    position.highestPrice = highestPrice;
    position.trailingStopPrice = trailingStopPrice;
    openPositions.set(positionKey, position);

    // TRAILING STOP LOSS LOGIK
    // WICHTIG: Trailing Stop ist aktiviert, wenn useTrailingStop === true (wird beim Kauf gesetzt)
    // Bei jedem Preis-Update wird geprüft:
    // 1. Falls trailing_stop_price noch nicht initialisiert: Prüfe Aktivierungsschwelle (NUR EINMAL)
    // 2. Falls bereits initialisiert: Update highest_price und trailing_stop_price wenn nötig
    // 3. Prüfe ob Verkauf ausgelöst werden muss
    if (useTrailingStop && stopLossPercent > 0) {
      const oldHighestPrice = position.highestPrice ?? position.entryPrice;
      let highestPrice = oldHighestPrice;
      let trailingStopPrice = position.trailingStopPrice;
      // SCHRITT 1: Initialisierung (NUR EINMAL wenn trailing_stop_price noch null ist)
      // TSL ist SOFORT aktiv - KEINE Aktivierungsschwelle mehr!
      if (trailingStopPrice === null || trailingStopPrice === undefined) {
        // Trailing Stop wurde noch nicht initialisiert → Initialisiere SOFORT
        highestPrice = Math.max(highestPrice, currentPrice);
        trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
        
        console.log(`📈 Trailing Stop initialisiert für ${symbol}: ${trailingStopPrice.toFixed(8)} USDT (Highest: ${highestPrice.toFixed(8)})`);
      } else {
        // SCHRITT 2: Trailing Stop ist bereits initialisiert → Nur Updates, keine Aktivierungsschwelle-Prüfung mehr
        // Update highest_price und trailing_stop_price wenn Preis gestiegen ist
        if (currentPrice > highestPrice) {
          highestPrice = currentPrice;
          trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
          
          console.log(`📈 Trailing Stop angepasst für ${symbol}: ${trailingStopPrice.toFixed(8)} USDT (Highest: ${oldHighestPrice.toFixed(8)} → ${highestPrice.toFixed(8)})`);
        }
      }

      // SCHRITT 3: Update In-Memory Map und Datenbank wenn Änderungen vorgenommen wurden
      if (highestPrice !== oldHighestPrice || trailingStopPrice !== position.trailingStopPrice) {
        position.highestPrice = highestPrice;
        position.trailingStopPrice = trailingStopPrice;
        
        // Update Datenbank (asynchron, nicht blockierend)
        supabase
          .from('positions')
          .update({
            highest_price: highestPrice,
            trailing_stop_price: trailingStopPrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', dbPosition.id)
          .eq('strategy_id', dbPosition.strategy_id)
          .eq('symbol', symbol)
          .eq('status', 'open')
          .then(() => {
            // Optional: Logging für Trailing Stop Updates
          })
          .catch(err => {
            console.warn(`⚠️  Fehler beim Update von Trailing Stop: ${err.message}`);
          });
      }

      // SCHRITT 4: Prüfe ob Trailing Stop ausgelöst wurde (Verkauf)
      // WICHTIG: Nur prüfen wenn trailing_stop_price bereits gesetzt ist
      
      // DEBUG: Logge alle relevanten Werte für Diagnose
      console.log(`🔍 [${symbol}] Trailing Stop Debug:`, {
        useTrailingStop: useTrailingStop,
        stopLossPercent: stopLossPercent,
        trailingStopPrice: trailingStopPrice,
        trailingStopPriceType: typeof trailingStopPrice,
        currentPrice: currentPrice,
        currentPriceType: typeof currentPrice,
        highestPrice: highestPrice,
        entryPrice: entryPrice,
        priceChangePercent: priceChangePercent.toFixed(4) + '%',
        comparison: currentPrice <= trailingStopPrice,
        isNull: trailingStopPrice === null,
        isUndefined: trailingStopPrice === undefined,
        isNaN: isNaN(trailingStopPrice),
        difference: trailingStopPrice !== null && trailingStopPrice !== undefined && !isNaN(trailingStopPrice) 
          ? (currentPrice - trailingStopPrice).toFixed(8) 
          : 'N/A'
      });
      
      if (trailingStopPrice !== null && trailingStopPrice !== undefined && !isNaN(trailingStopPrice)) {
        // Verwende kleine Toleranz für Floating-Point-Vergleiche
        const tolerance = 0.00000001;
        const shouldSell = currentPrice <= (trailingStopPrice + tolerance);
        
        console.log(`🔍 [${symbol}] Trailing Stop Verkaufsprüfung:`, {
          currentPrice: currentPrice.toFixed(8),
          trailingStopPrice: trailingStopPrice.toFixed(8),
          tolerance: tolerance,
          comparison: `${currentPrice.toFixed(8)} <= ${(trailingStopPrice + tolerance).toFixed(8)}`,
          shouldSell: shouldSell
        });
        
        if (shouldSell) {
          const trailingPriceChangePercent = ((currentPrice - highestPrice) / highestPrice) * 100;
          
          console.log('');
          console.log('═══════════════════════════════════════════════');
          console.log(`🔄 TRAILING STOP-LOSS AUSGELÖST [${symbol}]`);
          console.log('═══════════════════════════════════════════════');
          console.log(`📊 Position: ${positionKey}`);
          console.log(`💰 Entry Price: ${position.entryPrice.toFixed(6)} USDT`);
          console.log(`📈 Highest Price: ${highestPrice.toFixed(6)} USDT`);
          console.log(`🔄 Trailing Stop Price: ${trailingStopPrice.toFixed(6)} USDT`);
          console.log(`📉 Current Price: ${currentPrice.toFixed(6)} USDT`);
          console.log(`📊 Preisänderung (Entry): ${priceChangePercent.toFixed(2)}%`);
          console.log(`📊 Preisänderung (Highest): ${trailingPriceChangePercent.toFixed(2)}%`);
          console.log(`🛑 Trailing Stop: ${stopLossPercent}%`);
          console.log('═══════════════════════════════════════════════');
          console.log('');

          await logBotEvent('warning', `Trailing Stop-Loss ausgelöst: ${symbol}`, {
            positionKey: positionKey,
            entryPrice: position.entryPrice,
            highestPrice: highestPrice,
            trailingStopPrice: trailingStopPrice,
            currentPrice: currentPrice,
            priceChangePercent: priceChangePercent,
            trailingPriceChangePercent: trailingPriceChangePercent,
            stopLossPercent: stopLossPercent,
            symbol: symbol,
            strategy_id: strategy.id
          });

          // KRITISCH: Setze State, um mehrfache Signale zu verhindern
          pendingSellSignals.set(positionKey, {
            timestamp: Date.now(),
            reason: 'Trailing Stop-Loss ausgelöst',
            exitReason: 'trailing_stop'
          });

          // Erstelle SELL-Signal für Trailing Stop-Loss
          const trailingStopSignal = {
            action: 'sell',
            price: currentPrice,
            reason: `Trailing Stop-Loss ausgelöst: ${currentPrice.toFixed(6)} <= ${trailingStopPrice.toFixed(6)} (${trailingPriceChangePercent.toFixed(2)}% von Highest)`,
            stopLoss: true,
            takeProfit: false,
            trailingStop: true,
            exitReason: 'trailing_stop', // NEU: Exit-Grund
            _positionData: position
          };

          // Position SOFORT entfernen, um Race-Conditions zu vermeiden
          openPositions.delete(positionKey);

          // Trade ausführen
          if (tradingEnabled && binanceClient) {
            try {
              await executeTrade(trailingStopSignal, strategy);
            } catch (error) {
              // Bei Fehler: State nach 30 Sekunden zurücksetzen (falls Trade fehlgeschlagen)
              console.error(`❌ Fehler beim Trailing Stop Trade: ${error.message}`);
              setTimeout(() => {
                if (pendingSellSignals.has(positionKey)) {
                  console.log(`🔄 [${symbol}] Setze Verkaufssignal zurück nach Fehler`);
                  pendingSellSignals.delete(positionKey);
                }
              }, 30000); // 30 Sekunden
            }
          }

          continue; // Überspringe Take-Profit Prüfung
        } else {
          // DEBUG: Warum wird nicht verkauft?
          const diff = currentPrice - trailingStopPrice;
          console.log(`⚠️  [${symbol}] Trailing Stop NICHT ausgelöst:`, {
            currentPrice: currentPrice.toFixed(8),
            trailingStopPrice: trailingStopPrice.toFixed(8),
            difference: diff.toFixed(8),
            differencePercent: ((diff / trailingStopPrice) * 100).toFixed(6) + '%',
            reason: diff > 0 ? 'Preis liegt ÜBER Trailing Stop' : 'Unbekannter Grund'
          });
        }
      } else {
        // DEBUG: Trailing Stop Price ist nicht gesetzt
        console.log(`⚠️  [${symbol}] Trailing Stop Price ist nicht gesetzt:`, {
          trailingStopPrice: trailingStopPrice,
          isNull: trailingStopPrice === null,
          isUndefined: trailingStopPrice === undefined,
          isNaN: isNaN(trailingStopPrice),
          useTrailingStop: useTrailingStop,
          stopLossPercent: stopLossPercent
        });
      }
    } else {
      // DEBUG: Trailing Stop ist nicht aktiviert
      console.log(`⚠️  [${symbol}] Trailing Stop ist nicht aktiviert:`, {
        useTrailingStop: useTrailingStop,
        stopLossPercent: stopLossPercent,
        reason: !useTrailingStop ? 'useTrailingStop ist false' : 'stopLossPercent ist 0'
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // WICHTIG: Wenn Trailing Stop aktiv ist, werden Stop-Loss und 
    // Take-Profit DEAKTIVIERT (nur TSL wird verwendet)
    // ═══════════════════════════════════════════════════════════════
    
    // STATISCHER STOP-LOSS LOGIK (NUR wenn Trailing Stop NICHT aktiv)
    if (!useTrailingStop && stopLossPercent > 0 && priceChangePercent <= -stopLossPercent) {
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

      // KRITISCH: Setze State, um mehrfache Signale zu verhindern
      pendingSellSignals.set(positionKey, {
        timestamp: Date.now(),
        reason: 'Stop-Loss ausgelöst',
        exitReason: 'stop_loss'
      });

      // Erstelle SELL-Signal für Stop-Loss
      const stopLossSignal = {
        action: 'sell',
        price: currentPrice,
        reason: `Stop-Loss ausgelöst: ${priceChangePercent.toFixed(2)}% <= -${stopLossPercent}%`,
        stopLoss: true,
        takeProfit: false,
        trailingStop: false,
        exitReason: 'stop_loss', // NEU: Exit-Grund
        _positionData: position
      };

      // Position SOFORT entfernen, um Race-Conditions zu vermeiden
      openPositions.delete(positionKey);

      // Trade ausführen
      if (tradingEnabled && binanceClient) {
        try {
          await executeTrade(stopLossSignal, strategy);
        } catch (error) {
          // Bei Fehler: State nach 30 Sekunden zurücksetzen (falls Trade fehlgeschlagen)
          console.error(`❌ Fehler beim Stop-Loss Trade: ${error.message}`);
          setTimeout(() => {
            if (pendingSellSignals.has(positionKey)) {
              console.log(`🔄 [${symbol}] Setze Verkaufssignal zurück nach Fehler`);
              pendingSellSignals.delete(positionKey);
            }
          }, 30000); // 30 Sekunden
        }
      }

      continue; // Überspringe Take-Profit Prüfung
    }

    // TAKE-PROFIT PRÜFUNG (NUR wenn Trailing Stop NICHT aktiv)
    // WICHTIG: Trailing Stop hat absolute Priorität - wenn aktiv, wird Take-Profit ignoriert
    if (!useTrailingStop && takeProfitPercent > 0 && priceChangePercent >= takeProfitPercent) {

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

      // KRITISCH: Setze State, um mehrfache Signale zu verhindern
      pendingSellSignals.set(positionKey, {
        timestamp: Date.now(),
        reason: 'Take-Profit ausgelöst',
        exitReason: 'take_profit'
      });

      // Erstelle SELL-Signal für Take-Profit
      const takeProfitSignal = {
        action: 'sell',
        price: currentPrice,
        reason: `Take-Profit ausgelöst: ${priceChangePercent.toFixed(2)}% >= +${takeProfitPercent}%`,
        stopLoss: false,
        takeProfit: true,
        trailingStop: false,
        exitReason: 'take_profit', // NEU: Exit-Grund
        _positionData: position
      };

      // Position SOFORT entfernen, um Race-Conditions zu vermeiden
      openPositions.delete(positionKey);

      // Trade ausführen
      if (tradingEnabled && binanceClient) {
        try {
          await executeTrade(takeProfitSignal, strategy);
        } catch (error) {
          // Bei Fehler: State nach 30 Sekunden zurücksetzen (falls Trade fehlgeschlagen)
          console.error(`❌ Fehler beim Take-Profit Trade: ${error.message}`);
          setTimeout(() => {
            if (pendingSellSignals.has(positionKey)) {
              console.log(`🔄 [${symbol}] Setze Verkaufssignal zurück nach Fehler`);
              pendingSellSignals.delete(positionKey);
            }
          }, 30000); // 30 Sekunden
        }
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
  // Trade-Größe aus Strategie (MUSS vorhanden sein - wird bereits in loadStrategies validiert)
  const maxTradeSize = strategy.config.risk?.max_trade_size_usdt;
  
  if (maxTradeSize === undefined || maxTradeSize === null) {
    console.error(`❌ FEHLER: max_trade_size_usdt nicht in Strategie ${strategy.name} konfiguriert!`);
    return null;
  }
  
  // Berechne Basis-Menge
  let quantity = maxTradeSize / price;
  
  // Hole Lot Size Regeln aus Supabase (MUSS vorhanden sein - wird bereits in loadStrategies validiert)
  const lotSize = lotSizes[symbol];
  
  if (!lotSize) {
    console.error(`❌ FEHLER: Keine Lot Size Konfiguration für ${symbol} gefunden!`);
    console.error(`💡 Bitte fügen Sie lot_size_${symbol} in bot_settings hinzu!`);
    return null;
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

  // NEU: Bei BUY-Orders: Prüfe verfügbares USDT-Guthaben (auch im Testnet!)
  if (signal.action === 'buy') {
    try {
      const accountInfo = await binanceClient.accountInfo();
      const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');
      
      if (!usdtBalance) {
        const reason = 'Kein USDT-Guthaben gefunden im Testnet';
        console.log(`⚠️  ${reason}`);
        console.log(`💡 Tipp: Gehen Sie zu https://testnet.binance.vision/ und holen Sie Testnet-Tokens!`);
        await logBotEvent('warning', `BUY-Order abgelehnt: Kein USDT-Guthaben`, {
          symbol: symbol,
          strategy_id: strategy.id,
          testnet: true
        });
        return { allowed: false, reason: reason };
      }
      
      const availableUSDT = parseFloat(usdtBalance.free);
      const quantity = calculateQuantity(signal.price, symbol, strategy);
      
      if (!quantity || quantity <= 0) {
        const reason = 'Fehler bei der Mengenberechnung';
        console.log(`⚠️  ${reason}`);
        return { allowed: false, reason: reason };
      }
      
      const requiredUSDT = signal.price * quantity;
      
      // Puffer von 1% für Gebühren und Preisänderungen
      const requiredWithBuffer = requiredUSDT * 1.01;
      
      if (availableUSDT < requiredWithBuffer) {
        const reason = `Unzureichendes USDT-Guthaben im Testnet: Verfügbar: ${availableUSDT.toFixed(2)} USDT, Benötigt: ~${requiredWithBuffer.toFixed(2)} USDT`;
        console.log(`⚠️  ${reason}`);
        console.log(`💡 Tipp: Gehen Sie zu https://testnet.binance.vision/ und holen Sie mehr Testnet-Tokens!`);
        await logBotEvent('warning', `BUY-Order abgelehnt: Unzureichendes Testnet-Guthaben`, {
          symbol: symbol,
          available_usdt: availableUSDT,
          required_usdt: requiredUSDT,
          required_with_buffer: requiredWithBuffer,
          strategy_id: strategy.id,
          testnet: true
        });
        return { allowed: false, reason: reason };
      }
      
      console.log(`💰 Testnet-Guthaben OK: ${availableUSDT.toFixed(2)} USDT verfügbar (Benötigt: ~${requiredWithBuffer.toFixed(2)} USDT)`);
    } catch (error) {
      console.error(`❌ Fehler beim Abrufen des Testnet-Guthabens: ${error.message}`);
      // Bei Fehler: Trade ablehnen (sicherer)
      await logBotEvent('error', `Fehler beim Balance-Check`, {
        error: error.message,
        error_code: error.code,
        symbol: symbol,
        strategy_id: strategy.id
      });
      return { allowed: false, reason: `Fehler beim Balance-Check: ${error.message}` };
    }
  }

  // Trade Cooldown prüfen (aus Strategie-Config, pro Symbol)
  // HINWEIS: Diese Prüfung wird jetzt primär in executeTrade() durchgeführt,
  // um Race Conditions zu vermeiden. Hier bleibt sie als zusätzlicher Fallback.
  const now = Date.now();
  const tradeCooldown = strategy.config.settings?.trade_cooldown_ms;
  if (tradeCooldown === undefined || tradeCooldown === null) {
    console.error(`❌ FEHLER: trade_cooldown_ms nicht in Strategie ${strategy.name} konfiguriert!`);
    return { allowed: false, reason: 'Konfigurationsfehler: trade_cooldown_ms fehlt' };
  }
  
  // Pro-Coin Trade-Cooldown prüfen
  const lastTradeTime = lastTradeTimes.get(symbol) || 0;
  const cooldownRemaining = tradeCooldown - (now - lastTradeTime);
  
  if (cooldownRemaining > 0) {
    const waitTime = Math.round(cooldownRemaining / 1000);
    const reason = `Trade Cooldown aktiv für ${symbol} - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`;
    console.log(`⏳ TRADE COOLDOWN AKTIV für ${symbol} - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`);
    return { allowed: false, reason: reason };
  }

  // NEU: Gesamt-Exposure prüfen
  const totalExposure = calculateTotalExposure();
  const maxTotalExposure = botSettings.max_total_exposure_usdt;
  if (maxTotalExposure === undefined || maxTotalExposure === null) {
    console.error(`❌ FEHLER: max_total_exposure_usdt nicht in bot_settings konfiguriert!`);
    return { allowed: false, reason: 'Konfigurationsfehler: max_total_exposure_usdt fehlt' };
  }
  if (totalExposure >= maxTotalExposure) {
    const reason = `Max Total Exposure erreicht: ${totalExposure.toFixed(2)} USDT (Limit: ${maxTotalExposure} USDT)`;
    console.log(`⚠️  ${reason}`);
    return { allowed: false, reason: reason };
  }

  // Maximale gleichzeitige Trades prüfen
  const maxConcurrentTrades = strategy.config.risk?.max_concurrent_trades || botSettings.max_concurrent_trades;
  if (maxConcurrentTrades === undefined || maxConcurrentTrades === null) {
    console.error(`❌ FEHLER: max_concurrent_trades nicht konfiguriert (weder in Strategie noch in bot_settings)!`);
    return { allowed: false, reason: 'Konfigurationsfehler: max_concurrent_trades fehlt' };
  }
  if (openPositions.size >= maxConcurrentTrades) {
    const reason = `Maximum gleichzeitiger Trades erreicht (${maxConcurrentTrades})`;
    console.log(`⚠️  ${reason}`);
    return { allowed: false, reason: reason };
  }

  // Prüfung ob Trade läuft wird jetzt durch die Promise-basierte Queue in executeTrade() gehandhabt
  // Diese Prüfung ist nicht mehr notwendig, da die Queue sicherstellt, dass nur ein Trade gleichzeitig läuft

  // Bei BUY: Prüfen ob bereits eine offene Position existiert
  if (signal.action === 'buy') {
    // KRITISCH: Prüfe zuerst In-Memory Map (schneller, verhindert Race Conditions)
    const positionKey = `${strategy.id}_${symbol}`;
    const memPosition = openPositions.get(positionKey);
    
    if (memPosition && memPosition.quantity > 0.0001) {
      const reason = `Bereits eine offene Position in Memory: ${symbol} - ${memPosition.quantity} @ ${memPosition.entryPrice}`;
      console.log(`⚠️  ${reason}`);
      await logBotEvent('warning', `BUY-Signal ignoriert: Bereits offene Position (Memory)`, {
        symbol: symbol,
        quantity: memPosition.quantity,
        entry_price: memPosition.entryPrice,
        strategy_id: strategy.id
      });
      return { allowed: false, reason: reason };
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STATUS-PRÜFUNG: Verhindert Doppel-Käufe
    // ═══════════════════════════════════════════════════════════════
    // Check positions Tabelle (mit trade_status)
    const { data: existingPosition, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('strategy_id', strategy.id)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .gt('quantity', 0)
      .maybeSingle();
    
    // WICHTIG: Prüfe trade_status wenn Position existiert
    if (existingPosition) {
      const tradeStatus = existingPosition.trade_status;
      
      // Status-Prüfung: Kein Kauf erlaubt wenn Status != PENDING
      if (tradeStatus && tradeStatus !== 'PENDING') {
        const reason = `Kauf nicht erlaubt: Position hat Status '${tradeStatus}' (erwartet: 'PENDING' oder keine Position)`;
        console.log(`⚠️  ${reason}`);
        await logBotEvent('warning', `BUY-Signal ignoriert: Ungültiger Status`, {
          symbol: symbol,
          current_status: tradeStatus,
          expected_status: 'PENDING',
          strategy_id: strategy.id
        });
        return { allowed: false, reason: reason };
      }
    }
    
    if (posError) {
      console.error(`❌ Fehler beim Prüfen der Position: ${posError.message}`);
    }
    
    if (existingPosition && parseFloat(existingPosition.quantity) > 0) {
      // STATE-OF-THE-ART: Prüfe auch bei Binance ob Position wirklich noch existiert
      const syncResult = await syncPositionWithBinance(strategy.id, symbol);
      
      if (syncResult.synced && syncResult.action === 'closed') {
        // Position wurde geschlossen - erlaube neuen Kauf
        console.log(`✅ Position wurde geschlossen - erlaube neuen Kauf`);
        return { allowed: true, reason: 'Position wurde geschlossen' };
      }
      
      const quantity = parseFloat(existingPosition.quantity);
      const minTradeableQuantity = 0.0001;
      
      // Wenn Position existiert aber Menge sehr klein ist, erlaube neuen Kauf
      if (quantity > 0 && quantity < minTradeableQuantity) {
        console.log(`⚠️  Position mit sehr kleiner Menge gefunden (${quantity}), erlaube neuen Kauf`);
        // Bereinige die kleine Position automatisch
        await supabase
          .from('positions')
          .update({
            quantity: 0,
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('id', existingPosition.id);
        
        // Entferne aus In-Memory Map
        const positionKey = `${strategy.id}_${symbol}`;
        if (openPositions.has(positionKey)) {
          openPositions.delete(positionKey);
        }
        
        return { allowed: true, reason: 'OK - Kleine Position bereinigt' };
      }
      
      if (quantity >= minTradeableQuantity) {
        const reason = `Bereits eine offene Position vorhanden: ${symbol} - ${quantity} @ ${existingPosition.entry_price}`;
        console.log(`⚠️  ${reason}`);
        await logBotEvent('warning', `BUY-Signal ignoriert: Bereits offene Position`, {
          symbol: symbol,
          quantity: quantity,
          entry_price: existingPosition.entry_price,
          strategy_id: strategy.id
        });
        return { allowed: false, reason: reason };
      }
    }
  }

  // Bei SELL: Prüfen ob offene Position existiert
  if (signal.action === 'sell') {
    // ═══════════════════════════════════════════════════════════════
    // STATUS-PRÜFUNG: Verhindert Doppel-Verkäufe
    // ═══════════════════════════════════════════════════════════════
    // Check positions Tabelle (mit trade_status)
    const { data: position, error: posError } = await supabase
      .from('positions')
      .select('*')
      .eq('strategy_id', strategy.id)
      .eq('symbol', symbol)
      .in('status', ['open', 'partial'])
      .gt('quantity', 0)
      .maybeSingle();
    
    if (posError || !position || parseFloat(position.quantity) <= 0) {
      const reason = `Keine offene Position zum Verkaufen: ${symbol}`;
      console.log(`⚠️  KEINE OFFENE POSITION ZUM VERKAUFEN: ${symbol}`);
      console.log(`   Strategie: ${strategy.name} (ID: ${strategy.id})`);
      
      await logBotEvent('warning', `SELL-Signal ignoriert: Keine offene Position`, {
        symbol: symbol,
        strategy_id: strategy.id,
        strategy_name: strategy.name
      });
      return { allowed: false, reason: reason };
    }
    
    // WICHTIG: Prüfe trade_status - nur OFFEN erlaubt Verkauf
    const tradeStatus = position.trade_status;
    if (tradeStatus && tradeStatus !== 'OFFEN') {
      const reason = `Verkauf nicht erlaubt: Position hat Status '${tradeStatus}' (erwartet: 'OFFEN')`;
      console.log(`⚠️  ${reason}`);
      await logBotEvent('warning', `SELL-Signal ignoriert: Ungültiger Status`, {
        symbol: symbol,
        current_status: tradeStatus,
        expected_status: 'OFFEN',
        strategy_id: strategy.id
      });
      return { allowed: false, reason: reason };
    }
  }

  return { allowed: true, reason: 'OK' };
}

/**
 * Führt einen Trade auf Binance Testnet aus
 */
async function executeTrade(signal, strategy) {
  const symbol = strategy.symbol; // WICHTIG: Symbol aus Strategie, nicht global!
  
  // KRITISCH: Promise-basierte Queue pro Symbol - verhindert Race Conditions
  // Warte auf vorherige Trades für dieses Symbol
  const previousTrade = tradeQueues.get(symbol);
  if (previousTrade) {
    try {
      await previousTrade;
    } catch (error) {
      // Ignoriere Fehler von vorherigen Trades
    }
  }

  // Erstelle neues Promise für diesen Trade
  let resolveTrade;
  const tradePromise = new Promise((resolve) => {
    resolveTrade = resolve;
  });
  tradeQueues.set(symbol, tradePromise);
  
  try {
    // KRITISCH: Cooldown prüfen (pro Symbol, ohne zu setzen)
    // Die Queue verhindert bereits Race Conditions, da nur ein Trade gleichzeitig pro Symbol ausgeführt wird
    const now = Date.now();
    const tradeCooldown = strategy.config.settings?.trade_cooldown_ms;
    if (tradeCooldown === undefined || tradeCooldown === null) {
      console.error(`❌ FEHLER: trade_cooldown_ms nicht in Strategie ${strategy.name} konfiguriert!`);
      resolveTrade();
      tradeQueues.delete(symbol);
      return null;
    }
    
    // Pro-Coin Trade-Cooldown prüfen
    const lastTradeTime = lastTradeTimes.get(symbol) || 0;
    const cooldownRemaining = tradeCooldown - (now - lastTradeTime);
    if (cooldownRemaining > 0) {
      const waitTime = Math.round(cooldownRemaining / 1000);
      const reason = `Trade Cooldown aktiv für ${symbol} - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`;
      console.log(`⏳ TRADE COOLDOWN AKTIV für ${symbol} - Warte noch ${waitTime}s (${Math.round(waitTime / 60)} Minuten)`);
      resolveTrade();
      tradeQueues.delete(symbol);
      console.log(`⚠️  Trade nicht ausgeführt: ${reason}`);
      return null;
    }

    // Trading-Checks durchführen (Cooldown wurde bereits geprüft)
    const tradeCheck = await canTrade(signal, strategy);
    if (!tradeCheck.allowed) {
      // Trade-Queue auflösen und freigeben
      resolveTrade();
      tradeQueues.delete(symbol);
      // Logge warum Trade nicht ausgeführt wird
      console.log(`⚠️  Trade nicht ausgeführt: ${tradeCheck.reason}`);
      return null;
    }

    // KRITISCH: Cooldown SOFORT setzen VOR Order-Platzierung (verhindert Doppelausführungen)
    // Falls Order fehlschlägt, wird Cooldown trotzdem gesetzt (verhindert Spam)
    lastTradeTimes.set(symbol, Date.now());
    console.log(`⏳ Trade-Cooldown gesetzt für ${symbol} (${Math.round(tradeCooldown / 1000)}s)`);

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🔄 FÜHRE ${signal.action.toUpperCase()}-ORDER AUS`);
    console.log('═══════════════════════════════════════════════');

    const side = signal.action === 'buy' ? 'BUY' : 'SELL';
    let quantity;
    
    if (side === 'BUY') {
      // Bei Kauf: Berechne Menge basierend auf max_trade_size_usdt
      quantity = calculateQuantity(signal.price, symbol, strategy);
      if (!quantity || quantity <= 0) {
        console.error(`❌ FEHLER: Konnte Menge für Kauf nicht berechnen`);
        resolveTrade();
        tradeQueues.delete(symbol);
        return null;
      }
    } else {
      // Bei Verkauf: IMMER die gesamte Position verkaufen (ignoriere max_trade_size)
      const positionKey = `${strategy.id}_${symbol}`;
      const position = openPositions.get(positionKey);
      
      if (!position || position.quantity <= 0) {
        // Fallback: Prüfe in Datenbank
        const { data: dbPosition, error: posError } = await supabase
          .from('positions')
          .select('quantity')
          .eq('strategy_id', strategy.id)
          .eq('symbol', symbol)
          .in('status', ['open', 'partial'])
          .gt('quantity', 0)
          .maybeSingle();
        
        if (posError || !dbPosition) {
          console.error(`❌ Keine Position gefunden für Verkauf: ${symbol}`);
          await logBotEvent('error', `SELL ohne Position`, {
            symbol: symbol,
            strategy_id: strategy.id,
            error: posError?.message || 'Position nicht gefunden'
          });
          resolveTrade();
          tradeQueues.delete(symbol);
          return null;
        }
        
        quantity = parseFloat(dbPosition.quantity);
      } else {
        quantity = position.quantity;
      }
      
      // Stelle sicher, dass Menge korrekt gerundet ist (Lot Size)
      const lotSize = lotSizes[symbol];
      if (lotSize) {
        quantity = Math.floor(quantity / lotSize.stepSize) * lotSize.stepSize;
        quantity = parseFloat(quantity.toFixed(lotSize.decimals));
        
        // Prüfe Minimum
        if (quantity < lotSize.minQty) {
          console.warn(`⚠️  Position-Menge ${quantity} < Minimum ${lotSize.minQty} - verwende Minimum`);
          quantity = lotSize.minQty;
        }
      }
      
      console.log(`📊 Verkaufe GESAMTE Position: ${quantity} ${symbol}`);
    }

    console.log(`📊 Symbol: ${symbol}`);
    console.log(`📈 Seite: ${side}`);
    console.log(`💰 Preis: ${signal.price} USDT`);
    console.log(`🔢 Menge: ${quantity}`);
    console.log(`💵 Wert: ~${(signal.price * quantity).toFixed(2)} USDT`);

    // SCHICHT 1: Idempotenz-Check VOR Order-Platzierung
    // Prüfe ob bereits ein identischer Trade existiert (innerhalb der letzten 5 Sekunden)
    const recentTradeCheck = await supabase
      .from('trades')
      .select('id, order_id, created_at')
      .eq('strategy_id', strategy.id)
      .eq('symbol', symbol)
      .eq('side', signal.action)
      .gte('created_at', new Date(Date.now() - 5000).toISOString()) // Letzte 5 Sekunden
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (recentTradeCheck.data) {
      const timeDiff = Math.round((Date.now() - new Date(recentTradeCheck.data.created_at).getTime()) / 1000);
      const reason = `Idempotenz-Check: Identischer Trade wurde bereits vor ${timeDiff}s ausgeführt (Order ID: ${recentTradeCheck.data.order_id || 'N/A'})`;
      console.log(`⚠️  ${reason}`);
      await logBotEvent('warning', `Trade abgelehnt: Idempotenz-Check`, {
        symbol: symbol,
        strategy_id: strategy.id,
        side: signal.action,
        existing_order_id: recentTradeCheck.data.order_id,
        time_diff_seconds: timeDiff
      });
      resolveTrade();
      tradeQueues.delete(symbol);
      return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // STATUS-ÜBERGANG: Setze Status VOR Order-Platzierung
    // ═══════════════════════════════════════════════════════════════
    // BUY: PENDING → KAUFSIGNAL
    // SELL: OFFEN → VERKAUFSIGNAL
    const newStatus = side === 'BUY' ? 'KAUFSIGNAL' : 'VERKAUFSIGNAL';
    
    // Finde Position in DB um Status zu setzen
    if (side === 'SELL') {
      // Bei SELL: Setze Status auf VERKAUFSIGNAL
      const { error: statusError } = await supabase
        .from('positions')
        .update({ 
          trade_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('strategy_id', strategy.id)
        .eq('symbol', symbol)
        .eq('trade_status', 'OFFEN') // Nur wenn Status aktuell OFFEN ist
        .gt('quantity', 0);
      
      if (statusError) {
        console.error(`❌ Fehler beim Setzen des Status auf ${newStatus}: ${statusError.message}`);
        // Fahre trotzdem fort, aber logge Fehler
      } else {
        console.log(`✅ Status gesetzt: OFFEN → ${newStatus} für ${symbol}`);
      }
    }
    // Hinweis: Bei BUY wird Status in openOrUpdatePosition() gesetzt

    // Order auf Binance Testnet platzieren
    const order = await binanceClient.order({
      symbol: symbol,
      side: side,
      type: 'MARKET',
      quantity: quantity.toString()
    });

    // SCHICHT 2: Idempotenz-Check NACH Order-Platzierung
    // Prüfe ob Order-ID bereits in DB existiert (falls Order bereits verarbeitet wurde)
    const existingOrderCheck = await supabase
      .from('trades')
      .select('id, strategy_id, symbol, side, created_at')
      .eq('order_id', order.orderId.toString())
      .maybeSingle();
    
    if (existingOrderCheck.data) {
      const reason = `Order-ID ${order.orderId} wurde bereits verarbeitet - überspringe DB-Speicherung`;
      console.log(`⚠️  ${reason}`);
      console.log(`   Vorhandener Trade: ${existingOrderCheck.data.symbol} ${existingOrderCheck.data.side} (ID: ${existingOrderCheck.data.id})`);
      await logBotEvent('warning', `Duplikat erkannt: Order-ID bereits verarbeitet`, {
        order_id: order.orderId.toString(),
        existing_trade_id: existingOrderCheck.data.id,
        symbol: symbol,
        strategy_id: strategy.id
      });
      // Order wurde bereits verarbeitet - überspringe DB-Speicherung und Position-Update
      resolveTrade();
      tradeQueues.delete(symbol);
      return order; // Gebe Order zurück, aber speichere nicht nochmal
    }

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

    // Position tracking mit neuer DB-basierter Lösung
    const positionKey = `${strategy.id}_${symbol}`;
    if (side === 'BUY') {
      // Neue Position öffnen oder erweitern (Average Down/Up)
      try {
        await openOrUpdatePosition(strategy.id, symbol, executedQty, avgPrice);
        
        // Update In-Memory Map für schnellen Zugriff
        const existingPos = openPositions.get(positionKey);
        const useTrailingStop = strategy.config.risk?.use_trailing_stop === true;
        const stopLossPercent = strategy.config.risk?.stop_loss_percent ?? 0;
        const activationThreshold = strategy.config.risk?.trailing_stop_activation_threshold ?? 0;
        
        if (existingPos) {
          // Position erweitert - berechne neuen Durchschnittspreis
          const newTotalValue = (existingPos.quantity * existingPos.entryPrice) + (executedQty * avgPrice);
          const newTotalQuantity = existingPos.quantity + executedQty;
          const newAvgPrice = newTotalValue / newTotalQuantity;
          
          // Trailing Stop: highest_price = MAX(altes_highest_price, neuer_entry_price)
          const oldHighestPrice = existingPos.highestPrice ?? existingPos.entryPrice;
          const newHighestPrice = Math.max(oldHighestPrice, newAvgPrice);
          
          // Berechne neuen Trailing Stop Preis (wenn Trailing aktiv)
          // TSL wird SOFORT initialisiert (keine Aktivierungsschwelle mehr!)
          let newTrailingStopPrice = existingPos.trailingStopPrice;
          if (useTrailingStop && stopLossPercent > 0) {
            newTrailingStopPrice = newHighestPrice * (1 - stopLossPercent / 100);
          }
          
          const updatedPosition = {
            symbol: symbol,
            entryPrice: newAvgPrice,
            quantity: newTotalQuantity,
            orderId: order.orderId,
            timestamp: new Date(),
            strategyId: strategy.id
          };
          
          // Füge Trailing Stop Felder hinzu wenn aktiv
          if (useTrailingStop) {
            updatedPosition.highestPrice = newHighestPrice;
            updatedPosition.trailingStopPrice = newTrailingStopPrice;
            updatedPosition.useTrailingStop = true;
            updatedPosition.trailingStopActivationThreshold = 0; // Nicht mehr verwendet
          }
          
          openPositions.set(positionKey, updatedPosition);
        } else {
          // Neue Position
          const initialHighestPrice = avgPrice;
          // TSL wird SOFORT initialisiert (keine Aktivierungsschwelle mehr!)
          const initialTrailingStopPrice = useTrailingStop && stopLossPercent > 0
            ? initialHighestPrice * (1 - stopLossPercent / 100)
            : null;
          
          const newPosition = {
            symbol: symbol,
            entryPrice: avgPrice,
            quantity: executedQty,
            orderId: order.orderId,
            timestamp: new Date(),
            strategyId: strategy.id
          };
          
          // Füge Trailing Stop Felder hinzu wenn aktiv
          if (useTrailingStop) {
            newPosition.highestPrice = initialHighestPrice;
            newPosition.trailingStopPrice = initialTrailingStopPrice;
            newPosition.useTrailingStop = true;
            newPosition.trailingStopActivationThreshold = 0; // Nicht mehr verwendet
          }
          
          openPositions.set(positionKey, newPosition);
        }
        
        await logBotEvent('info', `Position geöffnet/erweitert: ${symbol}`, {
          positionKey: positionKey,
          entryPrice: avgPrice,
          quantity: executedQty,
          orderId: order.orderId.toString(),
          strategy_id: strategy.id,
          strategy_name: strategy.name
        });
      } catch (error) {
        console.error(`❌ Fehler beim Öffnen/Erweitern der Position: ${error.message}`);
        await logBotEvent('error', `Fehler beim Position-Update`, {
          error: error.message,
          positionKey: positionKey,
          symbol: symbol,
          strategy_id: strategy.id
        });
      }
    } else {
      // SELL - Position reduzieren oder schließen
      try {
        // Bestimme Exit-Grund aus Signal
        const exitReason = signal.exitReason || 
                          (signal.trailingStop ? 'trailing_stop' :
                           signal.stopLoss ? 'stop_loss' :
                           signal.takeProfit ? 'take_profit' :
                           signal.reason?.includes('MA Cross') ? 'ma_cross' :
                           'other');
        
        const result = await reduceOrClosePosition(strategy.id, symbol, executedQty, exitReason);
        
        if (result.action === 'no_position') {
          console.error(`❌ WARNUNG: SELL ohne offene Position für ${symbol}`);
          await logBotEvent('warning', `SELL ohne offene Position`, {
            positionKey: positionKey,
            symbol: symbol,
            strategy_id: strategy.id
          });
        } else {
          const entryPrice = result.entry_price;
          
          // Speichere entry_price im Signal für PnL-Berechnung in saveTradeToDatabase
          signal._entryPrice = entryPrice;
          
          console.log(`📊 Position ${result.action === 'closed' ? 'geschlossen' : 'reduziert'}: ${positionKey}`);
          console.log(`   Entry: ${entryPrice} USDT, Exit: ${avgPrice.toFixed(6)} USDT`);
          console.log(`   Menge: ${executedQty.toFixed(2)}`);
          
          await logBotEvent('info', `Position ${result.action === 'closed' ? 'geschlossen' : 'reduziert'}: ${symbol}`, {
            positionKey: positionKey,
            action: result.action,
            entryPrice: entryPrice,
            exitPrice: avgPrice,
            quantity: executedQty,
            remaining_quantity: result.remaining_quantity,
            strategy_id: strategy.id,
            strategy_name: strategy.name
          });
          
          // Update In-Memory Map
          if (result.action === 'closed') {
            openPositions.delete(positionKey);
            // KRITISCH: Entferne Verkaufssignal-State wenn Position geschlossen wurde
            if (pendingSellSignals.has(positionKey)) {
              console.log(`✅ [${symbol}] Verkaufssignal-State entfernt (Position geschlossen)`);
              pendingSellSignals.delete(positionKey);
            }
          } else if (result.remaining_quantity > 0) {
            const memPos = openPositions.get(positionKey);
            if (memPos) {
              memPos.quantity = result.remaining_quantity;
            }
          }
          
          // KRITISCH: Validiere Position nach Verkauf um sicherzustellen, dass alles synchron ist
          // Dies stellt sicher, dass geschlossene Positionen auch wirklich aus der DB entfernt werden
          await validateAndCleanupPosition(strategy.id, symbol);
        }
        
        // Auch bei 'no_position': Validiere und bereinige trotzdem
        if (result.action === 'no_position') {
          await validateAndCleanupPosition(strategy.id, symbol);
        }
      } catch (error) {
        console.error(`❌ Fehler beim Reduzieren/Schließen der Position: ${error.message}`);
        await logBotEvent('error', `Fehler beim Position-Close`, {
          error: error.message,
          positionKey: positionKey,
          symbol: symbol,
          strategy_id: strategy.id
        });
        
        // Bei Fehler: Versuche trotzdem zu validieren und zu bereinigen
        try {
          await validateAndCleanupPosition(strategy.id, symbol);
        } catch (validationError) {
          console.error(`❌ Fehler bei Validierung nach Fehler: ${validationError.message}`);
        }
      }
    }

    // Trade in Datenbank speichern
    await saveTradeToDatabase(order, signal, strategy);

    // Cooldown wurde bereits VOR Order-Platzierung gesetzt (verhindert Doppelausführungen)

    // Trade-Queue auflösen und freigeben
    resolveTrade();
    tradeQueues.delete(symbol);

    return order;

  } catch (error) {
    // WICHTIG: Trade-Queue IMMER auflösen und freigeben, auch bei Fehlern! (pro Symbol)
    if (resolveTrade) {
      resolveTrade();
    }
    tradeQueues.delete(symbol);
    console.error('');
    console.error('═══════════════════════════════════════════════');
    console.error('❌ ORDER FEHLGESCHLAGEN');
    console.error('═══════════════════════════════════════════════');
    console.error(`Fehler: ${error.message}`);
    console.error(`Code: ${error.code || 'N/A'}`);
    console.error(`Symbol: ${symbol}`);
    console.error('═══════════════════════════════════════════════');
    console.error('');

    // STATE-OF-THE-ART: Bei "insufficient balance" Fehler prüfe Binance-Guthaben
    const isInsufficientBalance = error.code === -2010 || 
                                   error.message?.toLowerCase().includes('insufficient balance');
    
    if (isInsufficientBalance && signal.action === 'sell') {
      console.log('🔍 "Insufficient Balance" Fehler erkannt - Prüfe Binance-Guthaben...');
      
      const positionKey = `${strategy.id}_${symbol}`;
      
      // Entferne Position aus In-Memory Map (falls noch vorhanden)
      if (openPositions.has(positionKey)) {
        openPositions.delete(positionKey);
        console.log(`🗑️  Position aus In-Memory Map entfernt: ${positionKey}`);
      }
      
      // Synchronisiere Position mit Binance
      const syncResult = await syncPositionWithBinance(strategy.id, symbol);
      
      if (syncResult.synced && syncResult.action === 'closed') {
        console.log(`✅ Position automatisch geschlossen: ${syncResult.reason}`);
        await logBotEvent('info', `Position geschlossen nach insufficient balance Fehler`, {
          symbol: symbol,
          reason: syncResult.reason,
          binanceBalance: syncResult.binanceBalance,
          dbQuantity: syncResult.dbQuantity,
          strategy_id: strategy.id,
          error_code: error.code,
          error_message: error.message
        });
        
        // Position wurde geschlossen - kein Grund zur Wiederherstellung
        // Fehler in Datenbank loggen
        await logTradeError(error, signal, strategy);
        return null;
      }
    }

    // WICHTIG: Bei SELL-Fehler Position wiederherstellen (nur wenn nicht geschlossen wurde)
    if (signal.action === 'sell' && signal._positionData) {
      // Prüfe nochmal ob Position wirklich noch existiert
      const { data: checkPosition } = await supabase
        .from('positions')
        .select('*')
        .eq('strategy_id', strategy.id)
        .eq('symbol', symbol)
        .in('status', ['open', 'partial'])
        .gt('quantity', 0)
        .maybeSingle();
      
      if (checkPosition && parseFloat(checkPosition.quantity) > 0) {
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
      } else {
        console.log(`ℹ️  Position existiert nicht mehr - keine Wiederherstellung nötig`);
      }
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
    let exitReason = null;
    if (signal.action === 'sell') {
      // Bestimme Exit-Grund aus Signal
      exitReason = signal.exitReason || 
                   (signal.trailingStop ? 'trailing_stop' :
                    signal.stopLoss ? 'stop_loss' :
                    signal.takeProfit ? 'take_profit' :
                    signal.reason?.includes('MA Cross') ? 'ma_cross' :
                    signal.metadata?.manual ? 'manual' :
                    'other');
      
      // Verwende die entry_price die im Signal gespeichert wurde (aus der DB)
      const entryPrice = signal._entryPrice;
      if (entryPrice && entryPrice > 0) {
        pnl = (avgPrice - entryPrice) * executedQty;
        pnlPercent = ((avgPrice - entryPrice) / entryPrice) * 100;
        console.log(`💰 PnL berechnet: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`);
      } else {
        console.log(`⚠️  Keine Entry-Price für PnL-Berechnung gefunden`);
      }
    }

    // SCHICHT 4: Database-Level Idempotenz (UNIQUE Constraint auf order_id)
    // Versuche Trade einzufügen - falls order_id bereits existiert, wird ein Fehler zurückgegeben
    const tradeData = {
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
        exit_reason: exitReason, // Auch in metadata für Rückwärtskompatibilität
        exit_details: {
          reason: signal.reason,
          trailingStop: signal.trailingStop || false,
          stopLoss: signal.stopLoss || false,
          takeProfit: signal.takeProfit || false
        },
        testnet: true
      }
    };
    
    // Füge exit_reason hinzu wenn SELL-Trade
    if (signal.action === 'sell' && exitReason) {
      tradeData.exit_reason = exitReason;
    }
    
    const { data, error } = await supabase
      .from('trades')
      .insert(tradeData)
      .select();

    if (error) {
      // Prüfe ob Fehler durch Duplikat verursacht wurde (UNIQUE Constraint Verletzung)
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('unique')) {
        console.warn(`⚠️  Trade bereits in Datenbank vorhanden (Order-ID: ${order.orderId}) - überspringe`);
        await logBotEvent('warning', `Duplikat erkannt: Trade bereits in DB`, {
          order_id: order.orderId.toString(),
          symbol: symbol,
          strategy_id: strategy.id,
          error_code: error.code
        });
        return null; // Trade bereits vorhanden - kein Fehler, aber auch kein neuer Eintrag
      } else {
        console.error('❌ Fehler beim Speichern in Datenbank:', error.message);
        await logBotEvent('error', 'Fehler beim Speichern des Trades in Datenbank', {
          error: error.message,
          error_code: error.code,
          orderId: order.orderId,
          symbol: symbol
        });
      }
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
        // Stop-Loss und Take-Profit sind optional (0 bedeutet deaktiviert)
        const stopLossPercent = strategy.config.risk?.stop_loss_percent ?? 0;
        const takeProfitPercent = strategy.config.risk?.take_profit_percent ?? 0;
        const useTrailingStop = strategy.config.risk?.use_trailing_stop === true;
        const activationThreshold = strategy.config.risk?.trailing_stop_activation_threshold ?? 0;

        // TRAILING STOP LOSS LOGIK
        if (useTrailingStop && stopLossPercent > 0) {
          // Initialisiere Trailing Stop Felder falls nicht vorhanden
          let highestPrice = position.highestPrice ?? position.entryPrice;
          let trailingStopPrice = position.trailingStopPrice;
          const trailingActivationThreshold = position.trailingStopActivationThreshold ?? activationThreshold;

          // Prüfe ob Trailing Stop aktiviert werden soll (Mindest-Gewinn-Schwelle)
          const shouldActivateTrailing = trailingActivationThreshold === 0 || priceChangePercent >= trailingActivationThreshold;

          if (shouldActivateTrailing) {
            // Update highest_price wenn currentPrice > highestPrice
            if (currentPrice > highestPrice) {
              highestPrice = currentPrice;
              trailingStopPrice = highestPrice * (1 - stopLossPercent / 100);
              
              // Update Position
              position.highestPrice = highestPrice;
              position.trailingStopPrice = trailingStopPrice;
            }

            // Prüfe ob Trailing Stop ausgelöst wurde
            if (trailingStopPrice && currentPrice <= trailingStopPrice) {
              const trailingPriceChangePercent = ((currentPrice - highestPrice) / highestPrice) * 100;
              const pnl = (currentPrice - position.entryPrice) * position.quantity;
              totalPnl += pnl;
              currentBalance += pnl;
              
              trades.push({
                entryPrice: position.entryPrice,
                exitPrice: currentPrice,
                quantity: position.quantity,
                pnl: pnl,
                pnlPercent: priceChangePercent,
                reason: 'trailing_stop_loss',
                highestPrice: highestPrice,
                trailingStopPrice: trailingStopPrice,
                trailingPriceChangePercent: trailingPriceChangePercent,
                timestamp: timestamp
              });

              if (pnl > 0) winCount++;
              else lossCount++;

              position = null;
              continue;
            }
          }
        }

        // STATISCHER STOP-LOSS LOGIK (wenn Trailing Stop nicht aktiv oder noch nicht aktiviert)
        if (!useTrailingStop && stopLossPercent > 0 && priceChangePercent <= -stopLossPercent) {
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

        // TAKE-PROFIT PRÜFUNG (kann parallel zu Trailing Stop laufen, wenn aktiviert)
        if (takeProfitPercent > 0 && priceChangePercent >= takeProfitPercent) {
          // Wenn Trailing Stop aktiv ist, überspringe Take-Profit (Trailing Stop hat Priorität)
          if (useTrailingStop) {
            // Skip Take-Profit wenn Trailing aktiv
          } else {
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
      }

      // Trade ausführen basierend auf Signal
      if (signal.action === 'buy' && !position) {
        const tradeSize = strategy.config.risk?.max_trade_size_usdt;
        if (tradeSize === undefined || tradeSize === null) {
          console.error(`❌ FEHLER: max_trade_size_usdt nicht in Strategie ${strategy.name} konfiguriert!`);
          continue; // Überspringe Backtest wenn Trade-Größe fehlt
        }
        const quantity = tradeSize / currentPrice;
        
        const useTrailingStop = strategy.config.risk?.use_trailing_stop === true;
        const stopLossPercent = strategy.config.risk?.stop_loss_percent ?? 0;
        const activationThreshold = strategy.config.risk?.trailing_stop_activation_threshold ?? 0;
        
        position = {
          entryPrice: currentPrice,
          quantity: quantity,
          timestamp: timestamp
        };
        
        // Initialisiere Trailing Stop Felder wenn aktiv
        if (useTrailingStop && stopLossPercent > 0) {
          position.highestPrice = currentPrice;
          position.trailingStopPrice = currentPrice * (1 - stopLossPercent / 100);
          position.useTrailingStop = true;
          position.trailingStopActivationThreshold = activationThreshold;
        }
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
      const priceLogInterval = botSettings.logging_price_log_interval;
      if (priceLogInterval === undefined || priceLogInterval === null) {
        console.error(`❌ FEHLER: logging_price_log_interval nicht in bot_settings konfiguriert!`);
        return; // Überspringe Logging wenn nicht konfiguriert
      }
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
          // KRITISCH: Prüfe ob bereits ein aktives Signal vorhanden ist
          const positionKey = `${strategy.id}_${symbol}`;
          
          // Bei BUY-Signalen: Prüfe ob bereits ein Kaufsignal aktiv ist
          if (signal.action === 'buy') {
            const pendingSignal = pendingBuySignals.get(positionKey);
            if (pendingSignal) {
              const signalAge = Date.now() - pendingSignal.timestamp;
              const maxSignalAge = 60000; // 60 Sekunden
              
              if (signalAge < maxSignalAge) {
                // Signal ist noch aktiv - überspringe dieses Signal
                console.log(`⏭️  [${symbol}] BUY-Signal übersprungen: Bereits aktives Kaufsignal vorhanden (${pendingSignal.reason})`);
                continue;
              } else {
                // Signal ist zu alt - entferne es
                console.log(`🧹 [${symbol}] Entferne veraltetes Kaufsignal (${Math.round(signalAge / 1000)}s alt)`);
                pendingBuySignals.delete(positionKey);
              }
            }
          }
          
          // Bei SELL-Signalen: Prüfe ob bereits ein Verkaufssignal aktiv ist
          if (signal.action === 'sell') {
            const pendingSignal = pendingSellSignals.get(positionKey);
            if (pendingSignal) {
              const signalAge = Date.now() - pendingSignal.timestamp;
              const maxSignalAge = 60000; // 60 Sekunden
              
              if (signalAge < maxSignalAge) {
                // Signal ist noch aktiv - überspringe dieses Signal
                console.log(`⏭️  [${symbol}] SELL-Signal übersprungen: Bereits aktives Verkaufssignal vorhanden (${pendingSignal.reason})`);
                continue;
              } else {
                // Signal ist zu alt - entferne es
                console.log(`🧹 [${symbol}] Entferne veraltetes Verkaufssignal (${Math.round(signalAge / 1000)}s alt)`);
                pendingSellSignals.delete(positionKey);
              }
            }
          }
          
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

          // KRITISCH: Cooldown SOFORT setzen VOR Signal-Verarbeitung (verhindert Doppel-Signale)
          lastSignalTimes.set(symbol, now);

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

          // Order ausführen (wenn aktiviert)
          if (tradingEnabled && binanceClient) {
            // KRITISCH: Bei BUY nochmal Position prüfen (verhindert Doppel-Käufe)
            if (signal.action === 'buy') {
              const positionKey = `${strategy.id}_${symbol}`;
              const memPosition = openPositions.get(positionKey);
              if (memPosition && memPosition.quantity > 0.0001) {
                console.log(`⚠️  [${symbol}] BUY-Signal ignoriert: Bereits offene Position vorhanden (${memPosition.quantity} @ ${memPosition.entryPrice})`);
                continue; // Überspringe dieses Signal
              }
            }
            
            console.log(`🔄 [${symbol}] Versuche Trade auszuführen: ${signal.action.toUpperCase()} @ ${signal.price} USDT`);
            await logBotEvent('info', `Trade-Ausführung gestartet: ${signal.action.toUpperCase()}`, {
              action: signal.action,
              price: signal.price,
              symbol: symbol,
              strategy_id: strategy.id
            });
            
            try {
              const positionKey = `${strategy.id}_${symbol}`;
              
              // KRITISCH: Setze State für Signale NACH allen Checks, VOR Trade-Ausführung
              // Dies verhindert mehrfache Signale, aber nur wenn Trade wirklich ausgeführt werden kann
              
              // Bei BUY-Signalen: Setze pendingBuySignals
              if (signal.action === 'buy') {
                // Prüfe nochmal ob nicht bereits ein Signal aktiv ist (Race Condition Schutz)
                if (!pendingBuySignals.has(positionKey)) {
                  pendingBuySignals.set(positionKey, {
                    timestamp: Date.now(),
                    reason: signal.reason || 'Kaufsignal'
                  });
                  console.log(`🔒 [${symbol}] Kaufsignal-State gesetzt`);
                }
              }
              
              // Bei SELL-Signalen: Setze pendingSellSignals (nur für MA Cross)
              if (signal.action === 'sell' && signal.exitReason === 'ma_cross') {
                // Prüfe nochmal ob nicht bereits ein Signal aktiv ist (Race Condition Schutz)
                if (!pendingSellSignals.has(positionKey)) {
                  pendingSellSignals.set(positionKey, {
                    timestamp: Date.now(),
                    reason: 'MA Cross Signal',
                    exitReason: 'ma_cross'
                  });
                  console.log(`🔒 [${symbol}] Verkaufssignal-State gesetzt (MA Cross)`);
                }
              }
              
              const tradeResult = await executeTrade(signal, strategy);
              
              // Bei erfolgreichem BUY-Trade: State zurücksetzen
              if (signal.action === 'buy' && tradeResult) {
                if (pendingBuySignals.has(positionKey)) {
                  console.log(`✅ [${symbol}] Kaufsignal-State entfernt (Trade erfolgreich)`);
                  pendingBuySignals.delete(positionKey);
                }
              }
              
              // Bei erfolgreichem SELL-Trade: State zurücksetzen
              if (signal.action === 'sell' && tradeResult) {
                if (pendingSellSignals.has(positionKey)) {
                  console.log(`✅ [${symbol}] Verkaufssignal-State entfernt (Trade erfolgreich)`);
                  pendingSellSignals.delete(positionKey);
                }
              }
              
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
                // Wenn Trade nicht ausgeführt wurde (z.B. wegen Cooldown), entferne State wieder
                // damit beim nächsten Preis-Update ein neues Signal generiert werden kann
                if (signal.action === 'sell' && signal.exitReason === 'ma_cross') {
                  const positionKey = `${strategy.id}_${symbol}`;
                  if (pendingSellSignals.has(positionKey)) {
                    console.log(`🔄 [${symbol}] Verkaufssignal-State entfernt (Trade nicht ausgeführt)`);
                    pendingSellSignals.delete(positionKey);
                  }
                }
              }
            } catch (tradeError) {
              console.error(`❌ [${symbol}] Fehler beim Trade: ${tradeError.message}`);
              // Bei Fehler: State sofort zurücksetzen (nicht nach 30 Sekunden warten)
              if (signal.action === 'sell') {
                const positionKey = `${strategy.id}_${symbol}`;
                if (pendingSellSignals.has(positionKey)) {
                  console.log(`🔄 [${symbol}] Setze Verkaufssignal zurück nach Fehler`);
                  pendingSellSignals.delete(positionKey);
                }
              }
            }
          } else {
            console.log(`💡 [${symbol}] Trading deaktiviert - Nur Signal-Generierung`);
          }
        } 
        // Hold-Signal
        else if (signal.action === 'hold') {
          const showHold = botSettings.logging_show_hold_signals !== false;
          const holdInterval = botSettings.logging_hold_log_interval;
          if (holdInterval === undefined || holdInterval === null) {
            console.error(`❌ FEHLER: logging_hold_log_interval nicht in bot_settings konfiguriert!`);
            continue; // Überspringe Hold-Logging wenn nicht konfiguriert
          }
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
  await loadOpenPositionsFromDB();

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
  lastTradeTimes.clear();
  tradesInProgress.clear();
  tradeQueues.clear();
  activeStrategies = [];
  
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
  
  // STATE-OF-THE-ART: Periodische Position-Synchronisation mit Binance
  // Starte nach 2 Minuten (damit Bot initialisiert ist) und dann alle 10 Minuten
  setTimeout(() => {
    console.log('🔄 Starte periodische Position-Synchronisation mit Binance (alle 10 Minuten)...');
    
    // Erste Synchronisation nach 2 Minuten
    setTimeout(async () => {
      if (botStatus === 'läuft') {
        console.log('🔄 Erste Position-Synchronisation beim Start...');
        await syncAllPositionsWithBinance();
      }
    }, 2 * 60 * 1000);
    
    // Periodische Synchronisation alle 10 Minuten
    setInterval(async () => {
      if (botStatus === 'läuft') {
        await syncAllPositionsWithBinance();
      }
    }, 10 * 60 * 1000); // Alle 10 Minuten
  }, 60000); // Starte nach 1 Minute
});

