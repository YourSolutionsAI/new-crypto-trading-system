-- =====================================================
-- Migration: Add trade_status column to positions table
-- =====================================================
-- Zweck: Implementierung eines expliziten Status-Modells
--        zur Verhinderung von Doppel-Käufen und -Verkäufen
-- =====================================================

-- Schritt 1: Erstelle ENUM-Typ für trade_status
DO $$ BEGIN
  CREATE TYPE trade_status_type AS ENUM (
    'PENDING',        -- Coin aktiv, kein offener Trade
    'KAUFSIGNAL',     -- Kauf wurde ausgelöst, warte auf Ausführung
    'OFFEN',          -- Position gekauft, Preisüberwachung läuft
    'VERKAUFSIGNAL'   -- Verkauf ausgelöst, warte auf Ausführung
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Schritt 2: Füge trade_status Spalte hinzu
ALTER TABLE positions 
ADD COLUMN IF NOT EXISTS trade_status trade_status_type DEFAULT 'OFFEN';

-- Schritt 3: Setze bestehende offene Positionen auf 'OFFEN'
-- (Alle existierenden Positionen sind offene Trades)
UPDATE positions 
SET trade_status = 'OFFEN' 
WHERE trade_status IS NULL;

-- Schritt 4: Mache trade_status NOT NULL
ALTER TABLE positions 
ALTER COLUMN trade_status SET NOT NULL;

-- Schritt 5: Erstelle Index für trade_status (Performance-Optimierung)
CREATE INDEX IF NOT EXISTS idx_positions_trade_status 
ON positions(trade_status);

-- Schritt 6: Erstelle zusammengesetzten Index für häufige Abfragen
-- (strategy_id + symbol + trade_status)
CREATE INDEX IF NOT EXISTS idx_positions_strategy_symbol_status 
ON positions(strategy_id, symbol, trade_status);

-- =====================================================
-- Hilfsfunktionen für Status-Übergänge
-- =====================================================

-- Funktion: Prüfe ob ein Coin in einem bestimmten Status ist
CREATE OR REPLACE FUNCTION check_trade_status(
  p_strategy_id UUID,
  p_symbol TEXT,
  p_expected_status trade_status_type
)
RETURNS BOOLEAN AS $$
DECLARE
  current_status trade_status_type;
BEGIN
  SELECT trade_status INTO current_status
  FROM positions
  WHERE strategy_id = p_strategy_id 
    AND symbol = p_symbol
    AND quantity > 0
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN current_status = p_expected_status;
END;
$$ LANGUAGE plpgsql;

-- Funktion: Hole aktuellen Status eines Coins
CREATE OR REPLACE FUNCTION get_trade_status(
  p_strategy_id UUID,
  p_symbol TEXT
)
RETURNS trade_status_type AS $$
DECLARE
  current_status trade_status_type;
BEGIN
  SELECT trade_status INTO current_status
  FROM positions
  WHERE strategy_id = p_strategy_id 
    AND symbol = p_symbol
    AND quantity > 0
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Wenn keine Position gefunden, gib 'PENDING' zurück
  IF current_status IS NULL THEN
    RETURN 'PENDING';
  END IF;
  
  RETURN current_status;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Logging und Monitoring
-- =====================================================

-- Tabelle für Status-Übergänge (optional, für Debugging)
CREATE TABLE IF NOT EXISTS trade_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  old_status trade_status_type,
  new_status trade_status_type NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für trade_status_log
CREATE INDEX IF NOT EXISTS idx_trade_status_log_strategy_symbol 
ON trade_status_log(strategy_id, symbol, created_at DESC);

-- Trigger: Logge Status-Änderungen automatisch
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur loggen wenn Status sich geändert hat
  IF OLD.trade_status IS DISTINCT FROM NEW.trade_status THEN
    INSERT INTO trade_status_log (
      strategy_id,
      symbol,
      old_status,
      new_status,
      reason
    ) VALUES (
      NEW.strategy_id,
      NEW.symbol,
      OLD.trade_status,
      NEW.trade_status,
      'Automatische Status-Änderung'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger erstellen (nur wenn noch nicht vorhanden)
DROP TRIGGER IF EXISTS trigger_log_status_change ON positions;
CREATE TRIGGER trigger_log_status_change
AFTER UPDATE ON positions
FOR EACH ROW
EXECUTE FUNCTION log_status_change();

-- =====================================================
-- Constraints und Validierung
-- =====================================================

-- Constraint: Eine Position kann nur einmal im Status KAUFSIGNAL sein
-- (verhindert Race Conditions bei gleichzeitigen Käufen)
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_unique_kaufsignal
ON positions(strategy_id, symbol)
WHERE trade_status = 'KAUFSIGNAL' AND quantity > 0;

-- Constraint: Eine Position kann nur einmal im Status VERKAUFSIGNAL sein
-- (verhindert Race Conditions bei gleichzeitigen Verkäufen)
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_unique_verkaufsignal
ON positions(strategy_id, symbol)
WHERE trade_status = 'VERKAUFSIGNAL' AND quantity > 0;

-- =====================================================
-- Status-Statistiken (für Monitoring)
-- =====================================================

-- View: Zeige Status-Verteilung aller Positionen
CREATE OR REPLACE VIEW v_trade_status_summary AS
SELECT 
  trade_status,
  COUNT(*) as count,
  COUNT(DISTINCT symbol) as unique_symbols,
  SUM(quantity * entry_price) as total_value_usdt
FROM positions
WHERE quantity > 0
GROUP BY trade_status
ORDER BY trade_status;

-- =====================================================
-- Cleanup-Funktion für hängende Status
-- =====================================================

-- Funktion: Setze hängende KAUFSIGNAL/VERKAUFSIGNAL zurück
-- (Falls ein Signal nicht ausgeführt wurde und hängt)
CREATE OR REPLACE FUNCTION cleanup_hanging_signals(
  p_timeout_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(
  strategy_id UUID,
  symbol TEXT,
  old_status trade_status_type,
  age_minutes INTEGER
) AS $$
BEGIN
  -- Finde hängende Signale älter als timeout
  RETURN QUERY
  WITH hanging_signals AS (
    SELECT 
      p.id,
      p.strategy_id,
      p.symbol,
      p.trade_status,
      EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 60 AS age_minutes
    FROM positions p
    WHERE p.trade_status IN ('KAUFSIGNAL', 'VERKAUFSIGNAL')
      AND p.updated_at < NOW() - INTERVAL '1 minute' * p_timeout_minutes
  )
  UPDATE positions p
  SET 
    trade_status = CASE 
      WHEN p.trade_status = 'KAUFSIGNAL' THEN 'PENDING'
      WHEN p.trade_status = 'VERKAUFSIGNAL' THEN 'OFFEN'
    END,
    updated_at = NOW()
  FROM hanging_signals hs
  WHERE p.id = hs.id
  RETURNING p.strategy_id, p.symbol, hs.trade_status, hs.age_minutes::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Kommentare für Dokumentation
-- =====================================================

COMMENT ON COLUMN positions.trade_status IS 
'Status des Trades: PENDING (kein Trade), KAUFSIGNAL (Kauf läuft), OFFEN (Position offen), VERKAUFSIGNAL (Verkauf läuft)';

COMMENT ON FUNCTION check_trade_status IS 
'Prüft ob eine Position in einem bestimmten Status ist';

COMMENT ON FUNCTION get_trade_status IS 
'Gibt den aktuellen Status einer Position zurück (PENDING wenn keine Position)';

COMMENT ON FUNCTION cleanup_hanging_signals IS 
'Bereinigt hängende KAUFSIGNAL/VERKAUFSIGNAL Status (z.B. nach Timeouts)';

COMMENT ON TABLE trade_status_log IS 
'Audit-Log für alle Status-Änderungen (für Debugging und Monitoring)';

-- =====================================================
-- Fertig!
-- =====================================================

SELECT 'Migration erfolgreich abgeschlossen!' as status;
SELECT * FROM v_trade_status_summary;

