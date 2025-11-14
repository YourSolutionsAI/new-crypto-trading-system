-- ================================================================
-- MULTI-COIN STRATEGIEN HINZUFÜGEN
-- ================================================================
-- Fügt Trading-Strategien für mehrere Coins hinzu
-- Sie können dann einfach zwischen Coins wechseln!
-- ================================================================

-- ================================================================
-- 1. BESTEHENDE DOGE-STRATEGIE AKTUALISIEREN
-- ================================================================

UPDATE strategies
SET 
  name = 'MA Cross - DOGE',
  description = 'Moving Average Crossover für Dogecoin (sehr volatil)',
  symbol = 'DOGEUSDT',
  active = true,  -- Diese bleibt aktiv
  config = '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 3
    }
  }'::jsonb,
  updated_at = NOW()
WHERE name = 'MA Cross Strategy' OR name = 'MA Cross - DOGE';

-- ================================================================
-- 2. BITCOIN STRATEGIE
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - BTC',
  'Moving Average Crossover für Bitcoin (wenig volatil, große Trades)',
  false,  -- Zunächst deaktiviert
  'BTCUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 2
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 3. ETHEREUM STRATEGIE
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - ETH',
  'Moving Average Crossover für Ethereum (moderat volatil)',
  false,  -- Zunächst deaktiviert
  'ETHUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 4. BINANCE COIN STRATEGIE
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - BNB',
  'Moving Average Crossover für Binance Coin',
  false,  -- Zunächst deaktiviert
  'BNBUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 5. SOLANA STRATEGIE
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - SOL',
  'Moving Average Crossover für Solana (sehr volatil)',
  false,  -- Zunächst deaktiviert
  'SOLUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 15,
      "ma_long": 40
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 6. XRP STRATEGIE
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - XRP',
  'Moving Average Crossover für Ripple',
  false,  -- Zunächst deaktiviert
  'XRPUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 7. CARDANO STRATEGIE
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - ADA',
  'Moving Average Crossover für Cardano',
  false,  -- Zunächst deaktiviert
  'ADAUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 8. SHIBA INU STRATEGIE (MEME COIN - SEHR VOLATIL!)
-- ================================================================

INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross - SHIB',
  'Moving Average Crossover für Shiba Inu (extrem volatil, nur für Tests!)',
  false,  -- Zunächst deaktiviert
  'SHIBUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "realtime",
    "indicators": {
      "ma_short": 10,
      "ma_long": 30
    },
    "risk": {
      "max_trade_size_usdt": 50,
      "stop_loss_percent": 0,
      "take_profit_percent": 0,
      "max_concurrent_trades": 2
    }
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  symbol = EXCLUDED.symbol,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 9. ALLE STRATEGIEN ANZEIGEN
-- ================================================================

SELECT 
  name,
  symbol,
  active,
  config->'indicators'->>'ma_short' as ma_short,
  config->'indicators'->>'ma_long' as ma_long,
  config->'risk'->>'max_trade_size_usdt' as trade_size,
  created_at,
  updated_at
FROM strategies
ORDER BY 
  active DESC,  -- Aktive zuerst
  symbol;

-- ================================================================
-- 10. ZUSAMMENFASSUNG
-- ================================================================

SELECT 
  COUNT(*) as total_strategies,
  SUM(CASE WHEN active THEN 1 ELSE 0 END) as active_strategies,
  SUM(CASE WHEN NOT active THEN 1 ELSE 0 END) as inactive_strategies
FROM strategies;

-- ================================================================
-- WIE ZWISCHEN COINS WECHSELN?
-- ================================================================

-- Option 1: Nur eine Strategie aktiv (aktuelles System)
/*
-- DOGE deaktivieren
UPDATE strategies SET active = false WHERE name = 'MA Cross - DOGE';

-- ETH aktivieren
UPDATE strategies SET active = true WHERE name = 'MA Cross - ETH';

-- Bot neu starten → Handelt jetzt ETH!
*/

-- Option 2: Mehrere gleichzeitig aktiv (Phase 2 - Code-Anpassung nötig)
/*
-- DOGE aktiv
UPDATE strategies SET active = true WHERE name = 'MA Cross - DOGE';

-- ETH aktiv
UPDATE strategies SET active = true WHERE name = 'MA Cross - ETH';

-- BTC aktiv
UPDATE strategies SET active = true WHERE name = 'MA Cross - BTC';

-- Bot neu starten → Handelt ALLE 3 gleichzeitig! (benötigt Phase 2 Code)
*/

-- ================================================================
-- FERTIG!
-- ================================================================
-- Sie haben jetzt 8 Strategien für verschiedene Coins
-- Aktuell ist nur DOGE aktiv
-- Zum Wechseln: Eine deaktivieren, andere aktivieren, Bot neustarten
-- ================================================================

