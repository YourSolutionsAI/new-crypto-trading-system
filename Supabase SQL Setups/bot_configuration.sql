-- ================================================================
-- BOT KONFIGURATION - ALLES IN SUPABASE
-- ================================================================
-- Führen Sie dieses SQL im Supabase SQL Editor aus
-- Danach können Sie ALLE Einstellungen über die Datenbank ändern!
-- ================================================================

-- ================================================================
-- 1. BOT_SETTINGS ERWEITERN
-- ================================================================

-- Lot Size Konfiguration pro Symbol
INSERT INTO bot_settings (key, value, description)
VALUES 
  -- DOGEUSDT Lot Size
  ('lot_size_DOGEUSDT', 
   '{"minQty": 1, "maxQty": 9000000, "stepSize": 1, "decimals": 0}'::jsonb,
   'Lot Size Regeln für DOGEUSDT'),
  
  -- BTCUSDT Lot Size
  ('lot_size_BTCUSDT', 
   '{"minQty": 0.00001, "maxQty": 9000, "stepSize": 0.00001, "decimals": 5}'::jsonb,
   'Lot Size Regeln für BTCUSDT'),
  
  -- ETHUSDT Lot Size
  ('lot_size_ETHUSDT', 
   '{"minQty": 0.0001, "maxQty": 9000, "stepSize": 0.0001, "decimals": 4}'::jsonb,
   'Lot Size Regeln für ETHUSDT'),
  
  -- BNBUSDT Lot Size
  ('lot_size_BNBUSDT', 
   '{"minQty": 0.001, "maxQty": 9000, "stepSize": 0.001, "decimals": 3}'::jsonb,
   'Lot Size Regeln für BNBUSDT'),
  
  -- SOLUSDT Lot Size
  ('lot_size_SOLUSDT', 
   '{"minQty": 0.01, "maxQty": 9000, "stepSize": 0.01, "decimals": 2}'::jsonb,
   'Lot Size Regeln für SOLUSDT'),
  
  -- XRPUSDT Lot Size
  ('lot_size_XRPUSDT', 
   '{"minQty": 0.1, "maxQty": 9000000, "stepSize": 0.1, "decimals": 1}'::jsonb,
   'Lot Size Regeln für XRPUSDT'),
  
  -- ADAUSDT Lot Size
  ('lot_size_ADAUSDT', 
   '{"minQty": 0.1, "maxQty": 9000000, "stepSize": 0.1, "decimals": 1}'::jsonb,
   'Lot Size Regeln für ADAUSDT'),
  
  -- SHIBUSDT Lot Size
  ('lot_size_SHIBUSDT', 
   '{"minQty": 1, "maxQty": 90000000, "stepSize": 1, "decimals": 0}'::jsonb,
   'Lot Size Regeln für SHIBUSDT')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- ================================================================
-- 2. TRADING EINSTELLUNGEN
-- ================================================================

INSERT INTO bot_settings (key, value, description)
VALUES 
  -- Trade Cooldown (Millisekunden)
  ('trade_cooldown_ms', '300000'::jsonb, 'Pause zwischen Trades (5 Minuten = 300000ms)'),
  
  -- Signal Cooldown (Millisekunden)
  ('signal_cooldown_ms', '60000'::jsonb, 'Pause zwischen Signalen (1 Minute = 60000ms)'),
  
  -- Max gleichzeitige Trades
  ('max_concurrent_trades', '3'::jsonb, 'Maximale Anzahl offener Positionen gleichzeitig'),
  
  -- Standard Trade-Größe in USDT
  ('default_trade_size_usdt', '100'::jsonb, 'Standard Trade-Größe wenn nicht in Strategie definiert'),
  
  -- Signal Threshold (Prozent)
  ('signal_threshold_percent', '0.01'::jsonb, 'Minimale MA-Differenz für Signale (0.01 = 0.01%)'),
  
  -- Logging Einstellungen
  ('logging_verbose', 'false'::jsonb, 'Ausführliche Logs'),
  ('logging_show_hold_signals', 'true'::jsonb, 'Hold-Signale anzeigen'),
  ('logging_price_log_interval', '10'::jsonb, 'Preis alle X Updates loggen'),
  ('logging_hold_log_interval', '50'::jsonb, 'Hold-Signal alle X Updates loggen')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- ================================================================
-- 3. STRATEGIE FÜR DOGEUSDT KONFIGURIEREN
-- ================================================================

-- Bestehende Strategie aktualisieren
UPDATE strategies
SET 
  symbol = 'DOGEUSDT',
  description = 'Moving Average Cross-over Strategie für Dogecoin',
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
WHERE name = 'MA Cross Strategy';

-- ================================================================
-- 4. WEBSOCKET KONFIGURATION
-- ================================================================

INSERT INTO bot_settings (key, value, description)
VALUES 
  -- WebSocket URLs pro Symbol
  ('websocket_DOGEUSDT', '"wss://stream.binance.com:9443/ws/dogeusdt@trade"'::jsonb, 'WebSocket URL für DOGEUSDT'),
  ('websocket_BTCUSDT', '"wss://stream.binance.com:9443/ws/btcusdt@trade"'::jsonb, 'WebSocket URL für BTCUSDT'),
  ('websocket_ETHUSDT', '"wss://stream.binance.com:9443/ws/ethusdt@trade"'::jsonb, 'WebSocket URL für ETHUSDT'),
  ('websocket_BNBUSDT', '"wss://stream.binance.com:9443/ws/bnbusdt@trade"'::jsonb, 'WebSocket URL für BNBUSDT'),
  ('websocket_SOLUSDT', '"wss://stream.binance.com:9443/ws/solusdt@trade"'::jsonb, 'WebSocket URL für SOLUSDT')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- ================================================================
-- 5. ALLE EINSTELLUNGEN ANZEIGEN
-- ================================================================

SELECT 
  key,
  value,
  description,
  updated_at
FROM bot_settings
ORDER BY 
  CASE 
    WHEN key LIKE 'lot_size_%' THEN 1
    WHEN key LIKE 'websocket_%' THEN 2
    ELSE 3
  END,
  key;

-- ================================================================
-- 6. VIEW FÜR EINFACHEN ZUGRIFF
-- ================================================================

-- View für Lot Sizes
CREATE OR REPLACE VIEW v_lot_sizes AS
SELECT 
  REPLACE(key, 'lot_size_', '') as symbol,
  value->>'minQty' as min_qty,
  value->>'maxQty' as max_qty,
  value->>'stepSize' as step_size,
  value->>'decimals' as decimals,
  updated_at
FROM bot_settings
WHERE key LIKE 'lot_size_%';

-- View für WebSocket URLs
CREATE OR REPLACE VIEW v_websockets AS
SELECT 
  REPLACE(key, 'websocket_', '') as symbol,
  value::text as websocket_url,
  updated_at
FROM bot_settings
WHERE key LIKE 'websocket_%';

-- View für Trading Settings
CREATE OR REPLACE VIEW v_trading_settings AS
SELECT 
  key,
  value,
  description,
  updated_at
FROM bot_settings
WHERE key NOT LIKE 'lot_size_%'
  AND key NOT LIKE 'websocket_%'
ORDER BY key;

-- ================================================================
-- FERTIG! ALLE EINSTELLUNGEN SIND IN SUPABASE
-- ================================================================

-- Beispiel-Abfragen:

-- Lot Size für DOGE abrufen
-- SELECT * FROM v_lot_sizes WHERE symbol = 'DOGEUSDT';

-- Alle Trading-Settings
-- SELECT * FROM v_trading_settings;

-- WebSocket URL abrufen
-- SELECT * FROM v_websockets WHERE symbol = 'DOGEUSDT';

-- Trade Cooldown ändern (von 5 auf 10 Minuten)
-- UPDATE bot_settings SET value = '600000'::jsonb WHERE key = 'trade_cooldown_ms';

-- Signal Threshold ändern (von 0.01% auf 0.05%)
-- UPDATE bot_settings SET value = '0.05'::jsonb WHERE key = 'signal_threshold_percent';

