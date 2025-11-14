-- ================================================================
-- SUPABASE: STRATEGIE-SYMBOL AKTUALISIEREN
-- ================================================================
-- Führen Sie dieses SQL im Supabase SQL Editor aus
-- ================================================================

-- 1. Aktuelle Strategie auf DOGEUSDT umstellen
UPDATE strategies
SET 
  symbol = 'DOGEUSDT',
  updated_at = NOW()
WHERE name = 'MA Cross Strategy';

-- 2. Überprüfen, ob das Update funktioniert hat
SELECT 
  id,
  name,
  symbol,
  active,
  updated_at
FROM strategies;

-- ================================================================
-- OPTIONAL: Neue Strategien für andere Coins erstellen
-- ================================================================

-- Strategie für Bitcoin (wenn Sie später BTC handeln möchten)
INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross Strategy - BTC',
  'Moving Average Cross-over Strategie für Bitcoin',
  false,  -- Zunächst deaktiviert
  'BTCUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "1h",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 2,
      "take_profit_percent": 5,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Strategie für Ethereum
INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross Strategy - ETH',
  'Moving Average Cross-over Strategie für Ethereum',
  false,  -- Zunächst deaktiviert
  'ETHUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "1h",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 2,
      "take_profit_percent": 5,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Strategie für Solana
INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross Strategy - SOL',
  'Moving Average Cross-over Strategie für Solana',
  false,  -- Zunächst deaktiviert
  'SOLUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "1h",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 2,
      "take_profit_percent": 5,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- ALLE TRADES ÜBERPRÜFEN
-- ================================================================

-- Zeige alle Trades (sollten jetzt DOGEUSDT sein)
SELECT 
  id,
  symbol,
  side,
  price,
  quantity,
  total,
  pnl,
  status,
  created_at
FROM trades
ORDER BY created_at DESC
LIMIT 20;

-- ================================================================
-- SYMBOL-KONSISTENZ ÜBERPRÜFEN
-- ================================================================

-- Überprüfe ob Trades und Strategien zusammenpassen
SELECT 
  s.name as strategy_name,
  s.symbol as strategy_symbol,
  s.active,
  COUNT(t.id) as total_trades,
  SUM(CASE WHEN t.side = 'buy' THEN 1 ELSE 0 END) as buy_trades,
  SUM(CASE WHEN t.side = 'sell' THEN 1 ELSE 0 END) as sell_trades,
  SUM(t.pnl) as total_pnl
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id
GROUP BY s.id, s.name, s.symbol, s.active
ORDER BY s.created_at;

-- ================================================================
-- CLEANUP: Trades mit falschem Symbol korrigieren (optional)
-- ================================================================

-- Falls Sie Trades haben, die noch BTCUSDT zeigen, aber eigentlich DOGE waren
-- VORSICHT: Nur ausführen wenn Sie sicher sind!
/*
UPDATE trades
SET symbol = 'DOGEUSDT'
WHERE symbol = 'BTCUSDT'
  AND price < 1  -- DOGE kostet ~$0.16, BTC ~$97.000
  AND created_at > NOW() - INTERVAL '1 day';
*/

-- ================================================================
-- FERTIG!
-- ================================================================

