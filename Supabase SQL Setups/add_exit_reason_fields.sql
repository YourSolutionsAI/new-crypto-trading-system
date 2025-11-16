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
-- WICHTIG: Nur ausführen wenn exit_reason Spalte existiert

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'exit_reason'
  ) THEN
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
    
    RAISE NOTICE 'Bestehende Trades wurden migriert';
  ELSE
    RAISE NOTICE 'exit_reason Spalte existiert nicht - Migration übersprungen';
  END IF;
END $$;

-- 4. VERIFIZIERUNG
-- ================================================================
-- Zeige Statistiken über Exit-Gründe (nur wenn Spalten existieren)

DO $$
DECLARE
  v_close_reason_exists BOOLEAN;
  v_exit_reason_exists BOOLEAN;
BEGIN
  -- Prüfe ob Spalten existieren
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'close_reason'
  ) INTO v_close_reason_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'exit_reason'
  ) INTO v_exit_reason_exists;
  
  -- Zeige Status
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Status:';
  RAISE NOTICE 'close_reason existiert: %', v_close_reason_exists;
  RAISE NOTICE 'exit_reason existiert: %', v_exit_reason_exists;
  RAISE NOTICE '========================================';
END $$;

-- Zeige Close-Grund Verteilung für Positionen (nur wenn Spalte existiert)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'close_reason'
  ) THEN
    SELECT COUNT(*) INTO v_count
    FROM positions
    WHERE status = 'closed' AND close_reason IS NOT NULL;
    
    RAISE NOTICE 'Positionen mit close_reason: %', v_count;
  END IF;
END $$;

-- Zeige Exit-Grund Verteilung für Trades (nur wenn Spalte existiert)
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trades' AND column_name = 'exit_reason'
  ) THEN
    SELECT COUNT(*) INTO v_count
    FROM trades
    WHERE side = 'sell' AND exit_reason IS NOT NULL;
    
    RAISE NOTICE 'Trades mit exit_reason: %', v_count;
  END IF;
END $$;

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

