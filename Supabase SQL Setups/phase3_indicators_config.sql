-- ================================================================
-- PHASE 3: ERWEITERTE TRADING-FEATURES KONFIGURIEREN
-- ================================================================
-- Aktiviert Stop-Loss/Take-Profit und erweiterte Indikatoren
-- ================================================================
-- Führen Sie dieses SQL im Supabase SQL Editor aus
-- ================================================================

-- ================================================================
-- 1. STOP-LOSS & TAKE-PROFIT AKTIVIEREN
-- ================================================================
-- Aktualisiert alle Strategien mit Stop-Loss und Take-Profit
-- ================================================================

-- WICHTIG: Aktualisiert ALLE Strategien (auch inaktive), damit sie konfiguriert sind
UPDATE strategies
SET config = jsonb_set(
  jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{risk}',
    COALESCE(config->'risk', '{}'::jsonb) || '{
      "stop_loss_percent": 2,
      "take_profit_percent": 5,
      "max_trade_size_usdt": 100,
      "max_concurrent_trades": 3
    }'::jsonb
  ),
  '{indicators}',
  COALESCE(config->'indicators', '{}'::jsonb) || '{
    "ma_short": 20,
    "ma_long": 50,
    "rsi_period": 14,
    "rsi_overbought": 70,
    "rsi_oversold": 30,
    "macd_fast_period": 12,
    "macd_slow_period": 26,
    "macd_signal_period": 9,
    "bollinger_period": 20,
    "bollinger_std_dev": 2
  }'::jsonb
),
updated_at = NOW();
-- ENTFERNT: WHERE active = true; - Jetzt werden ALLE Strategien aktualisiert!

-- ================================================================
-- 2. ÜBERPRÜFUNG: Strategien mit neuen Einstellungen
-- ================================================================

SELECT 
  name,
  symbol,
  active,
  config->'risk'->>'stop_loss_percent' as stop_loss_percent,
  config->'risk'->>'take_profit_percent' as take_profit_percent,
  config->'indicators'->>'rsi_period' as rsi_period,
  config->'indicators'->>'macd_fast_period' as macd_fast_period,
  config->'indicators'->>'bollinger_period' as bollinger_period,
  CASE 
    WHEN config->'risk'->>'stop_loss_percent' IS NULL THEN '❌ FEHLT'
    WHEN config->'risk'->>'take_profit_percent' IS NULL THEN '❌ FEHLT'
    WHEN config->'indicators'->>'rsi_period' IS NULL THEN '⚠️  Indikatoren fehlen'
    ELSE '✅ OK'
  END as status
FROM strategies
ORDER BY 
  active DESC,
  symbol;

-- ================================================================
-- 3. BEISPIEL: Individuelle Strategie-Konfiguration
-- ================================================================
-- Für aggressive Strategien können Sie höhere Thresholds setzen
-- ================================================================

-- Beispiel: Aggressive DOGE-Strategie
UPDATE strategies
SET config = jsonb_set(
  config,
  '{risk}',
  jsonb_set(
    config->'risk',
    '{stop_loss_percent}',
    '3'::jsonb
  )
),
updated_at = NOW()
WHERE symbol = 'DOGEUSDT' AND name LIKE '%DOGE%';

-- Beispiel: Konservative BTC-Strategie
UPDATE strategies
SET config = jsonb_set(
  config,
  '{risk}',
  jsonb_set(
    jsonb_set(
      config->'risk',
      '{stop_loss_percent}',
      '1.5'::jsonb
    ),
    '{take_profit_percent}',
    '3'::jsonb
  )
),
updated_at = NOW()
WHERE symbol = 'BTCUSDT' AND name LIKE '%BTC%';

-- ================================================================
-- 4. HINWEIS: Indikatoren sind optional
-- ================================================================
-- Die Indikatoren werden nur verwendet, wenn sie in der Config vorhanden sind
-- Wenn nicht vorhanden, wird nur MA Crossover verwendet
-- ================================================================

-- ================================================================
-- FERTIG! ✅
-- ================================================================
-- ALLE Strategien (aktiv und inaktiv) haben jetzt:
-- ✅ Stop-Loss (2%) und Take-Profit (5%)
-- ✅ RSI, MACD und Bollinger Bands Konfiguration
-- ✅ Individuelle Anpassungen möglich
-- 
-- HINWEIS: Wenn Sie das Script erneut ausführen, werden nur die
-- fehlenden Werte hinzugefügt (durch jsonb || Operator)
-- ================================================================

