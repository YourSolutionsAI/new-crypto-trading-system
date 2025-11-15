-- ================================================================
-- MIGRATION: STRATEGIEN VON COINS TRENNEN
-- ================================================================
-- Diese Migration trennt Strategien von Coins:
-- - Strategien enthalten nur Basis-Konfiguration (MA, Strategie-Typ)
-- - Coin-spezifische Einstellungen (Trade Size, Thresholds, Cooldowns, Risk) 
--   werden in coin_strategies gespeichert
-- ================================================================

-- ================================================================
-- 1. NEUE TABELLE: coin_strategies
-- ================================================================

CREATE TABLE IF NOT EXISTS coin_strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE, -- Ein Coin = Eine Strategie (1:1)
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT false,
  
  -- Coin-spezifische Einstellungen (werden in Strategie-Config überschrieben)
  config JSONB DEFAULT '{
    "settings": {
      "signal_threshold_percent": null,
      "signal_cooldown_ms": null,
      "trade_cooldown_ms": null
    },
    "risk": {
      "max_trade_size_usdt": null,
      "stop_loss_percent": null,
      "take_profit_percent": null,
      "use_trailing_stop": false,
      "trailing_stop_activation_threshold": null
    }
  }'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_coin_strategies_symbol ON coin_strategies(symbol);
CREATE INDEX IF NOT EXISTS idx_coin_strategies_strategy_id ON coin_strategies(strategy_id);
CREATE INDEX IF NOT EXISTS idx_coin_strategies_active ON coin_strategies(active);

-- Trigger für updated_at
CREATE TRIGGER update_coin_strategies_updated_at
BEFORE UPDATE ON coin_strategies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 2. STRATEGIEN BEREINIGEN: Symbol und Coin-spezifische Einstellungen entfernen
-- ================================================================

-- Erstelle Standard-Strategien (wenn noch nicht vorhanden)
INSERT INTO strategies (name, description, config)
VALUES 
  (
    'MA Cross Conservative',
    'Konservative Moving Average Crossover Strategie (MA 20/50) - Für stabile Coins wie BTC, ETH',
    '{
      "type": "ma_cross",
      "timeframe": "realtime",
      "indicators": {
        "ma_short": 20,
        "ma_long": 50
      }
    }'::jsonb
  ),
  (
    'MA Cross Aggressiv',
    'Aggressive Moving Average Crossover Strategie (MA 10/30) - Für volatile Coins wie DOGE, SHIB',
    '{
      "type": "ma_cross",
      "timeframe": "realtime",
      "indicators": {
        "ma_short": 10,
        "ma_long": 30
      }
    }'::jsonb
  ),
  (
    'MA Cross Balanced',
    'Ausgewogene Moving Average Crossover Strategie (MA 15/40) - Für mittlere Volatilität',
    '{
      "type": "ma_cross",
      "timeframe": "realtime",
      "indicators": {
        "ma_short": 15,
        "ma_long": 40
      }
    }'::jsonb
  ),
  (
    'RSI + MA Cross',
    'Kombination aus RSI und Moving Average Crossover - Für alle Coins',
    '{
      "type": "rsi_ma_cross",
      "timeframe": "realtime",
      "indicators": {
        "ma_short": 20,
        "ma_long": 50,
        "rsi_period": 14,
        "rsi_overbought": 70,
        "rsi_oversold": 30
      }
    }'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- 3. BESTEHENDE DATEN MIGRIEREN
-- ================================================================

-- Migriere bestehende Strategien zu coin_strategies
-- Extrahiere Coin-spezifische Einstellungen aus strategies.config
-- WICHTIG: ON CONFLICT verhindert Duplikat-Fehler bei mehrmaliger Ausführung
INSERT INTO coin_strategies (symbol, strategy_id, active, config)
SELECT 
  s.symbol,
  s.id as strategy_id,
  s.active,
  jsonb_build_object(
    'settings', COALESCE(s.config->'settings', '{}'::jsonb),
    'risk', COALESCE(s.config->'risk', '{}'::jsonb)
  ) as config
FROM strategies s
WHERE s.symbol IS NOT NULL
ON CONFLICT (symbol) DO UPDATE SET
  strategy_id = EXCLUDED.strategy_id,
  active = EXCLUDED.active,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ================================================================
-- 4. STRATEGIEN BEREINIGEN: Entferne Coin-spezifische Daten
-- ================================================================

-- Entferne symbol, active und Coin-spezifische Einstellungen aus strategies
-- (Behalte nur Basis-Konfiguration: indicators, type, timeframe)

-- Aktualisiere bestehende Strategien: Entferne Coin-spezifische Config-Teile
UPDATE strategies
SET 
  config = jsonb_build_object(
    'type', COALESCE(config->'type', '"ma_cross"'::jsonb),
    'timeframe', COALESCE(config->'timeframe', '"realtime"'::jsonb),
    'indicators', COALESCE(config->'indicators', '{}'::jsonb)
  ),
  symbol = NULL,
  active = false,
  updated_at = NOW()
WHERE symbol IS NOT NULL;

-- ================================================================
-- 5. ZUORDNUNG BESTEHENDER COINS ZU STANDARD-STRATEGIEN
-- ================================================================

-- Ordne bestehende Coins Standard-Strategien zu (basierend auf Volatilität)
-- DOGE, SHIB → Aggressiv
UPDATE coin_strategies cs
SET strategy_id = (
  SELECT id FROM strategies WHERE name = 'MA Cross Aggressiv'
)
WHERE cs.symbol IN ('DOGEUSDT', 'SHIBUSDT')
  AND cs.strategy_id IS NULL;

-- BTC, ETH, BNB → Conservative
UPDATE coin_strategies cs
SET strategy_id = (
  SELECT id FROM strategies WHERE name = 'MA Cross Conservative'
)
WHERE cs.symbol IN ('BTCUSDT', 'ETHUSDT', 'BNBUSDT')
  AND cs.strategy_id IS NULL;

-- SOL, XRP, ADA → Balanced
UPDATE coin_strategies cs
SET strategy_id = (
  SELECT id FROM strategies WHERE name = 'MA Cross Balanced'
)
WHERE cs.symbol IN ('SOLUSDT', 'XRPUSDT', 'ADAUSDT')
  AND cs.strategy_id IS NULL;

-- ================================================================
-- 6. ÜBERPRÜFUNG
-- ================================================================

-- Zeige alle Coin-Strategien
SELECT 
  cs.symbol,
  s.name as strategy_name,
  cs.active,
  cs.config->'risk'->>'max_trade_size_usdt' as trade_size,
  cs.config->'settings'->>'signal_threshold_percent' as signal_threshold,
  cs.created_at
FROM coin_strategies cs
LEFT JOIN strategies s ON cs.strategy_id = s.id
ORDER BY cs.symbol;

-- Zeige alle Strategien (sollten kein Symbol mehr haben)
SELECT 
  name,
  description,
  config->'indicators'->>'ma_short' as ma_short,
  config->'indicators'->>'ma_long' as ma_long,
  symbol, -- Sollte NULL sein
  active -- Sollte false sein
FROM strategies
ORDER BY name;

-- ================================================================
-- 7. HINWEISE
-- ================================================================

-- ✅ Migration abgeschlossen!
-- 
-- NÄCHSTE SCHRITTE:
-- 1. Überprüfen Sie die coin_strategies Tabelle
-- 2. Passen Sie Coin-spezifische Einstellungen in coin_strategies an
-- 3. Backend-Code muss angepasst werden (loadStrategies lädt jetzt coin_strategies)
-- 4. Frontend muss angepasst werden (neue Coins-Seite)
--
-- WICHTIG: 
-- - strategies.symbol wird NICHT mehr verwendet (kann später entfernt werden)
-- - strategies.active wird NICHT mehr verwendet (aktiv/inaktiv ist jetzt in coin_strategies)
-- - Alle Coin-spezifischen Einstellungen sind jetzt in coin_strategies.config
-- ================================================================

