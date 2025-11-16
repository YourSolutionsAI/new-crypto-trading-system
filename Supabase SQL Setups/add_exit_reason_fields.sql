-- ================================================================
-- ADD EXIT REASON FIELDS
-- ================================================================
-- Fügt close_reason zu positions und exit_reason zu trades hinzu
-- Führen Sie dieses SQL im Supabase SQL Editor aus
-- ================================================================

-- 1. ERWEITERE POSITIONS TABELLE UM close_reason
-- ================================================================

-- Füge close_reason Spalte hinzu (wenn sie noch nicht existiert)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'close_reason'
  ) THEN
    ALTER TABLE positions 
    ADD COLUMN close_reason TEXT 
    CHECK (close_reason IN ('trailing_stop', 'stop_loss', 'take_profit', 'ma_cross', 'manual', 'other'));
    
    -- Index für schnelle Abfragen
    CREATE INDEX idx_positions_close_reason ON positions(close_reason);
    
    RAISE NOTICE 'Spalte close_reason wurde zu positions hinzugefügt';
  ELSE
    RAISE NOTICE 'Spalte close_reason existiert bereits in positions';
  END IF;
END $$;

-- 2. ERWEITERE TRADES TABELLE UM exit_reason
-- ================================================================

-- Füge exit_reason Spalte hinzu (wenn sie noch nicht existiert)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'exit_reason'
  ) THEN
    ALTER TABLE trades 
    ADD COLUMN exit_reason TEXT 
    CHECK (exit_reason IN ('trailing_stop', 'stop_loss', 'take_profit', 'ma_cross', 'manual', 'other'));
    
    -- Index für schnelle Abfragen
    CREATE INDEX idx_trades_exit_reason ON trades(exit_reason);
    
    RAISE NOTICE 'Spalte exit_reason wurde zu trades hinzugefügt';
  ELSE
    RAISE NOTICE 'Spalte exit_reason existiert bereits in trades';
  END IF;
END $$;

-- 3. MIGRIERE BESTEHENDE DATEN (OPTIONAL)
-- ================================================================
-- Versuche exit_reason aus metadata zu extrahieren (falls vorhanden)

UPDATE trades t
SET exit_reason = CASE
  WHEN t.metadata->>'exit_reason' IS NOT NULL THEN t.metadata->>'exit_reason'
  WHEN t.side = 'sell' AND t.metadata->'signal'->>'trailingStop' = 'true' THEN 'trailing_stop'
  WHEN t.side = 'sell' AND t.metadata->'signal'->>'stopLoss' = 'true' THEN 'stop_loss'
  WHEN t.side = 'sell' AND t.metadata->'signal'->>'takeProfit' = 'true' THEN 'take_profit'
  WHEN t.side = 'sell' AND t.metadata->'signal'->>'reason' LIKE '%MA Cross%' THEN 'ma_cross'
  WHEN t.side = 'sell' AND t.metadata->>'manual' = 'true' THEN 'manual'
  WHEN t.side = 'sell' THEN 'other'
  ELSE NULL
END
WHERE t.side = 'sell' AND t.exit_reason IS NULL;

-- 4. VERIFIZIERUNG
-- ================================================================
-- Zeige Statistiken über Exit-Gründe

SELECT 
  'Migration erfolgreich!' as status,
  COUNT(*) FILTER (WHERE close_reason IS NOT NULL) as positions_with_close_reason,
  COUNT(*) FILTER (WHERE exit_reason IS NOT NULL) as trades_with_exit_reason
FROM (
  SELECT close_reason FROM positions WHERE status = 'closed'
  UNION ALL
  SELECT exit_reason FROM trades WHERE side = 'sell'
) combined;

-- Zeige Exit-Grund Verteilung für Trades
SELECT 
  exit_reason,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as percentage
FROM trades
WHERE side = 'sell' AND exit_reason IS NOT NULL
GROUP BY exit_reason
ORDER BY count DESC;

-- Zeige Close-Grund Verteilung für Positionen
SELECT 
  close_reason,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as percentage
FROM positions
WHERE status = 'closed' AND close_reason IS NOT NULL
GROUP BY close_reason
ORDER BY count DESC;

-- ================================================================
-- HINWEISE
-- ================================================================
-- 1. close_reason wird beim Schließen einer Position gesetzt
-- 2. exit_reason wird beim Speichern eines SELL-Trades gesetzt
-- 3. Beide Felder sind optional (können NULL sein für alte Daten)
-- 4. Mögliche Werte:
--    - 'trailing_stop': Trailing Stop Loss ausgelöst
--    - 'stop_loss': Statischer Stop Loss ausgelöst
--    - 'take_profit': Take Profit ausgelöst
--    - 'ma_cross': MA Crossover Signal (Bearish)
--    - 'manual': Manueller Verkauf
--    - 'other': Andere Gründe

