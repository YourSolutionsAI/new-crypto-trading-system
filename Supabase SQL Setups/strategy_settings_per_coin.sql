-- ================================================================
-- STRATEGIE-EINSTELLUNGEN PRO COIN KONFIGURIEREN
-- ================================================================
-- Fügt pro-Coin-spezifische Einstellungen zu allen Strategien hinzu
-- Jede Strategie MUSS diese Einstellungen haben (keine Fallbacks mehr!)
-- ================================================================
-- Führen Sie dieses SQL im Supabase SQL Editor aus
-- ================================================================

-- ================================================================
-- 1. DOGEUSDT - Sehr volatil, höherer Threshold
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.01,
    "signal_cooldown_ms": 60000,
    "trade_cooldown_ms": 300000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'DOGEUSDT';

-- ================================================================
-- 2. BTCUSDT - Wenig volatil, niedrigerer Threshold
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.002,
    "signal_cooldown_ms": 120000,
    "trade_cooldown_ms": 600000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'BTCUSDT';

-- ================================================================
-- 3. ETHUSDT - Moderat volatil, mittlerer Threshold
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.005,
    "signal_cooldown_ms": 90000,
    "trade_cooldown_ms": 450000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'ETHUSDT';

-- ================================================================
-- 4. BNBUSDT - Moderat volatil
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.005,
    "signal_cooldown_ms": 90000,
    "trade_cooldown_ms": 450000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'BNBUSDT';

-- ================================================================
-- 5. SOLUSDT - Hoch volatil
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.008,
    "signal_cooldown_ms": 75000,
    "trade_cooldown_ms": 375000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'SOLUSDT';

-- ================================================================
-- 6. XRPUSDT - Moderat volatil
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.005,
    "signal_cooldown_ms": 90000,
    "trade_cooldown_ms": 450000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'XRPUSDT';

-- ================================================================
-- 7. ADAUSDT - Moderat volatil
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.005,
    "signal_cooldown_ms": 90000,
    "trade_cooldown_ms": 450000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'ADAUSDT';

-- ================================================================
-- 8. SHIBUSDT - Extrem volatil, höherer Threshold
-- ================================================================
UPDATE strategies
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{settings}',
  '{
    "signal_threshold_percent": 0.015,
    "signal_cooldown_ms": 45000,
    "trade_cooldown_ms": 240000
  }'::jsonb
),
updated_at = NOW()
WHERE symbol = 'SHIBUSDT';

-- ================================================================
-- 9. ALLE STRATEGIEN ÜBERPRÜFEN
-- ================================================================
SELECT 
  name,
  symbol,
  active,
  config->'settings'->>'signal_threshold_percent' as threshold_percent,
  config->'settings'->>'signal_cooldown_ms' as signal_cooldown_ms,
  config->'settings'->>'trade_cooldown_ms' as trade_cooldown_ms,
  CASE 
    WHEN config->'settings'->>'signal_threshold_percent' IS NULL THEN '❌ FEHLT'
    WHEN config->'settings'->>'signal_cooldown_ms' IS NULL THEN '❌ FEHLT'
    WHEN config->'settings'->>'trade_cooldown_ms' IS NULL THEN '❌ FEHLT'
    ELSE '✅ OK'
  END as status
FROM strategies
ORDER BY 
  active DESC,
  symbol;

-- ================================================================
-- 10. SIGNAL_THRESHOLD_PERCENT AUS BOT_SETTINGS ENTFERNEN
-- ================================================================
-- WICHTIG: Diese Einstellung wird jetzt nur noch pro Strategie gespeichert!
-- ================================================================

DELETE FROM bot_settings
WHERE key = 'signal_threshold_percent';

DELETE FROM bot_settings
WHERE key = 'signal_cooldown_ms';

DELETE FROM bot_settings
WHERE key = 'trade_cooldown_ms';

-- ================================================================
-- 11. ÜBERPRÜFUNG: Welche bot_settings bleiben übrig?
-- ================================================================
SELECT 
  key,
  value,
  description
FROM bot_settings
ORDER BY key;

-- ================================================================
-- FERTIG! ✅
-- ================================================================
-- Alle Strategien haben jetzt pro-Coin-spezifische Einstellungen
-- Die globalen Einstellungen wurden entfernt
-- ================================================================

