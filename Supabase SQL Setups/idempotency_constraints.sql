-- ================================================================
-- IDEMPOTENZ-CONSTRAINTS FÜR TRADES TABELLE
-- ================================================================
-- Diese Constraints verhindern Duplikate auf Datenbank-Ebene
-- und stellen sicher, dass keine doppelten Trades gespeichert werden
-- ================================================================

-- 1. UNIQUE CONSTRAINT AUF ORDER_ID
-- Verhindert, dass dieselbe Order-ID mehrfach gespeichert wird
-- Dies ist die wichtigste Schutzebene gegen Duplikate
DO $$ 
BEGIN
  -- Prüfe ob Constraint bereits existiert
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'unique_order_id'
  ) THEN
    ALTER TABLE trades 
    ADD CONSTRAINT unique_order_id UNIQUE (order_id);
    
    RAISE NOTICE 'UNIQUE Constraint auf order_id hinzugefügt';
  ELSE
    RAISE NOTICE 'UNIQUE Constraint auf order_id existiert bereits';
  END IF;
END $$;

-- 2. INDEX FÜR IDEMPOTENZ-CHECKS
-- Optimiert die Performance von Idempotenz-Checks im Code
-- (Prüfung auf identische Trades innerhalb eines Zeitfensters)
CREATE INDEX IF NOT EXISTS idx_trades_idempotency 
ON trades(strategy_id, symbol, side, created_at DESC);

-- 3. INDEX FÜR ORDER_ID LOOKUPS
-- Optimiert die Suche nach Order-IDs (wird für Idempotenz-Check verwendet)
CREATE INDEX IF NOT EXISTS idx_trades_order_id 
ON trades(order_id) 
WHERE order_id IS NOT NULL;

-- 4. KOMMENTARE FÜR DOKUMENTATION
COMMENT ON CONSTRAINT unique_order_id ON trades IS 
'Verhindert Duplikate: Jede Binance Order-ID darf nur einmal gespeichert werden';

COMMENT ON INDEX idx_trades_idempotency IS 
'Optimiert Idempotenz-Checks: Schnelle Suche nach identischen Trades (Strategy/Symbol/Side/Zeit)';

COMMENT ON INDEX idx_trades_order_id IS 
'Optimiert Order-ID Lookups: Schnelle Suche nach bereits verarbeiteten Order-IDs';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Führe diese Queries aus, um zu prüfen ob alles korrekt eingerichtet ist:

-- Prüfe ob UNIQUE Constraint existiert:
-- SELECT conname, contype 
-- FROM pg_constraint 
-- WHERE conrelid = 'trades'::regclass 
-- AND conname = 'unique_order_id';

-- Prüfe ob Indizes existieren:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'trades' 
-- AND indexname IN ('idx_trades_idempotency', 'idx_trades_order_id');

-- Prüfe auf Duplikate (sollte keine zurückgeben):
-- SELECT order_id, COUNT(*) as count
-- FROM trades
-- WHERE order_id IS NOT NULL
-- GROUP BY order_id
-- HAVING COUNT(*) > 1;

