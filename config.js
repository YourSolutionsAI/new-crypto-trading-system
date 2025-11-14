/**
 * ═══════════════════════════════════════════════
 * TRADING BOT KONFIGURATION
 * ═══════════════════════════════════════════════
 * 
 * Diese Datei enthält alle wichtigen Konfigurationseinstellungen.
 * Ändern Sie diese Werte nach Bedarf und starten Sie den Bot neu.
 */

module.exports = {
  
  // ═══════════════════════════════════════════════
  // MARKTDATEN-KONFIGURATION
  // ═══════════════════════════════════════════════
  
  market: {
    // Trading-Paar (muss mit Binance WebSocket übereinstimmen!)
    symbol: 'DOGEUSDT',
    
    // WebSocket-URL für Live-Daten
    websocketUrl: 'wss://stream.binance.com:9443/ws/dogeusdt@trade',
    
    // Maximale Preishistorie
    maxPriceHistory: 100,
  },

  // ═══════════════════════════════════════════════
  // SIGNAL-GENERIERUNG
  // ═══════════════════════════════════════════════
  
  signals: {
    // Threshold für BUY/SELL Signale (in Prozent)
    // 0.01% = sehr sensitiv (viele Signale)
    // 0.1% = moderat (mittlere Anzahl Signale)
    // 0.5% = konservativ (wenige Signale)
    threshold: 0.01,
    
    // Cooldown zwischen Signalen (Millisekunden)
    // 60000 = 1 Minute
    // 300000 = 5 Minuten
    signalCooldown: 60000,
    
    // Wie oft Preise geloggt werden (alle X Preise)
    priceLogInterval: 10,
    
    // Wie oft Hold-Signale geloggt werden (alle X Preise)
    holdLogInterval: 50,
  },

  // ═══════════════════════════════════════════════
  // TRADING-KONFIGURATION
  // ═══════════════════════════════════════════════
  
  trading: {
    // Master-Switch (wird von TRADING_ENABLED env var überschrieben)
    enabled: false,
    
    // Cooldown zwischen Trades (Millisekunden)
    // 60000 = 1 Minute (für Tests)
    // 300000 = 5 Minuten (normal)
    // 600000 = 10 Minuten (konservativ)
    tradeCooldown: 300000,
    
    // Maximale gleichzeitige offene Positionen
    maxConcurrentTrades: 3,
    
    // Standard Trade-Größe in USDT (wird von Strategie-Config überschrieben)
    defaultTradeSize: 100,
    
    // Minimale Trade-Größe in USDT
    minTradeSize: 10,
    
    // Maximale Trade-Größe in USDT
    maxTradeSize: 1000,
  },

  // ═══════════════════════════════════════════════
  // BINANCE LOT SIZE KONFIGURATION
  // ═══════════════════════════════════════════════
  
  lotSizes: {
    // Lot Size pro Symbol (Binance Anforderungen)
    // Format: Symbol -> { minQty, maxQty, stepSize }
    
    BTCUSDT: {
      minQty: 0.00001,      // Minimale Menge
      maxQty: 9000,         // Maximale Menge
      stepSize: 0.00001,    // Schrittgröße
      decimals: 5,          // Dezimalstellen
    },
    
    ETHUSDT: {
      minQty: 0.0001,
      maxQty: 9000,
      stepSize: 0.0001,
      decimals: 4,
    },
    
    BNBUSDT: {
      minQty: 0.001,
      maxQty: 9000,
      stepSize: 0.001,
      decimals: 3,
    },
    
    DOGEUSDT: {
      minQty: 1,            // DOGE muss in ganzen Zahlen sein!
      maxQty: 9000000,
      stepSize: 1,
      decimals: 0,          // Keine Dezimalstellen!
    },
    
    SHIBUSDT: {
      minQty: 1,
      maxQty: 90000000,
      stepSize: 1,
      decimals: 0,
    },
    
    XRPUSDT: {
      minQty: 0.1,
      maxQty: 9000000,
      stepSize: 0.1,
      decimals: 1,
    },
    
    ADAUSDT: {
      minQty: 0.1,
      maxQty: 9000000,
      stepSize: 0.1,
      decimals: 1,
    },
    
    SOLUSDT: {
      minQty: 0.01,
      maxQty: 9000,
      stepSize: 0.01,
      decimals: 2,
    },
    
    // Fallback für unbekannte Symbole
    DEFAULT: {
      minQty: 1,
      maxQty: 1000000,
      stepSize: 1,
      decimals: 0,
    },
  },

  // ═══════════════════════════════════════════════
  // LOGGING-KONFIGURATION
  // ═══════════════════════════════════════════════
  
  logging: {
    // Verbose-Modus (mehr Details in Logs)
    verbose: false,
    
    // Zeige Trade-Details in Logs
    showTradeDetails: true,
    
    // Zeige Hold-Signale
    showHoldSignals: true,
    
    // Zeige Datensammlungs-Fortschritt
    showDataProgress: true,
  },

  // ═══════════════════════════════════════════════
  // RISK MANAGEMENT
  // ═══════════════════════════════════════════════
  
  risk: {
    // Stop-Loss in Prozent (0 = deaktiviert)
    stopLossPercent: 0,
    
    // Take-Profit in Prozent (0 = deaktiviert)
    takeProfitPercent: 0,
    
    // Maximaler täglicher Verlust in USDT (0 = unbegrenzt)
    maxDailyLoss: 0,
    
    // Maximale Anzahl Trades pro Tag (0 = unbegrenzt)
    maxDailyTrades: 0,
  },

  // ═══════════════════════════════════════════════
  // SERVER-KONFIGURATION
  // ═══════════════════════════════════════════════
  
  server: {
    // Port (wird von process.env.PORT überschrieben)
    port: 10000,
    
    // Host
    host: '0.0.0.0',
    
    // CORS Origins
    corsOrigins: [
      'http://localhost:3000',
      /\.vercel\.app$/,
    ],
  },

  // ═══════════════════════════════════════════════
  // ENTWICKLER-MODUS
  // ═══════════════════════════════════════════════
  
  dev: {
    // Simulationsmodus (keine echten API-Calls)
    simulation: false,
    
    // Test-Daten verwenden
    useTestData: false,
    
    // Debug-Modus
    debug: false,
  },
};

