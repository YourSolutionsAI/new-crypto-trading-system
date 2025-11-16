-- ================================================================
-- INITIALIZE BOT_SETTINGS FOR EXISTING COINS
-- ================================================================
-- Dieses Script füllt lot_sizes und websockets für alle Coins
-- aus coin_strategies automatisch basierend auf coin_exchange_info
-- ================================================================

-- ================================================================
-- 1. FUNKTION: Berechne Dezimalstellen aus step_size
-- ================================================================
CREATE OR REPLACE FUNCTION calculate_decimals(step_size_value DECIMAL)
RETURNS INTEGER AS $$
DECLARE
  step_size_text TEXT;
  decimal_position INTEGER;
BEGIN
  step_size_text := step_size_value::TEXT;
  decimal_position := POSITION('.' IN step_size_text);
  
  IF decimal_position = 0 THEN
    RETURN 0;
  ELSE
    RETURN LENGTH(step_size_text) - decimal_position;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 2. LOT_SIZES INITIALISIEREN
-- ================================================================
-- Für jeden Coin in coin_strategies, der noch keine lot_size hat

INSERT INTO bot_settings (key, value, description, updated_at)
SELECT 
  CONCAT('lot_size_', cs.symbol) as key,
  jsonb_build_object(
    'minQty', COALESCE(cei.min_qty, 0.1),
    'maxQty', COALESCE(cei.max_qty, 9000000),
    'stepSize', COALESCE(cei.step_size, 0.1),
    'decimals', calculate_decimals(COALESCE(cei.step_size, 0.1))
  ) as value,
  CONCAT('Lot Size Regeln für ', cs.symbol, ' (automatisch generiert)') as description,
  NOW() as updated_at
FROM coin_strategies cs
LEFT JOIN coin_exchange_info cei ON cei.symbol = cs.symbol
WHERE NOT EXISTS (
  SELECT 1 FROM bot_settings bs 
  WHERE bs.key = CONCAT('lot_size_', cs.symbol)
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ================================================================
-- 3. WEBSOCKETS INITIALISIEREN
-- ================================================================
-- Für jeden Coin in coin_strategies, der noch keine websocket hat

INSERT INTO bot_settings (key, value, description, updated_at)
SELECT 
  CONCAT('websocket_', cs.symbol) as key,
  to_jsonb(CONCAT('wss://stream.binance.com:9443/ws/', LOWER(cs.symbol), '@trade')) as value,
  CONCAT('WebSocket URL für ', cs.symbol, ' (automatisch generiert)') as description,
  NOW() as updated_at
FROM coin_strategies cs
WHERE NOT EXISTS (
  SELECT 1 FROM bot_settings bs 
  WHERE bs.key = CONCAT('websocket_', cs.symbol)
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ================================================================
-- 4. ERGEBNISSE ANZEIGEN
-- ================================================================

-- Alle Lot Sizes
SELECT 
  key,
  value,
  description,
  updated_at
FROM bot_settings
WHERE key LIKE 'lot_size_%'
ORDER BY key;

-- Alle WebSockets
SELECT 
  key,
  value,
  description,
  updated_at
FROM bot_settings
WHERE key LIKE 'websocket_%'
ORDER BY key;

-- ================================================================
-- 5. PRÜFUNG: Coins ohne Exchange Info
-- ================================================================

SELECT 
  cs.symbol,
  'Keine Exchange-Info verfügbar - Bitte Exchange-Info synchronisieren!' as status
FROM coin_strategies cs
LEFT JOIN coin_exchange_info cei ON cei.symbol = cs.symbol
WHERE cei.symbol IS NULL;

-- ================================================================
-- HINWEISE
-- ================================================================

-- ✅ Dieses Script:
--    1. Liest alle Coins aus coin_strategies
--    2. Holt Lot Size Daten aus coin_exchange_info
--    3. Berechnet Dezimalstellen automatisch
--    4. Generiert WebSocket URLs
--    5. Fügt alles in bot_settings ein

-- ⚠️ Voraussetzungen:
--    - coin_strategies Tabelle muss existieren
--    - coin_exchange_info Tabelle muss existieren und synchronisiert sein
--    - bot_settings Tabelle muss existieren

-- 🔄 Nach Ausführung:
--    - Bot neu starten oder loadBotSettings() aufrufen
--    - Neue Coins werden automatisch trading-ready

-- 💡 Wenn coin_exchange_info leer ist:
--    - Führen Sie erst Exchange-Info Sync aus (Button im Frontend)
--    - Dann dieses Script nochmal ausführen

