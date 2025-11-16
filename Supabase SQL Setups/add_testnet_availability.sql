-- ================================================================
-- TESTNET VERFÜGBARKEIT MIGRATION
-- ================================================================
-- Fügt eine Spalte hinzu, die anzeigt ob ein Symbol im Testnet verfügbar ist
-- Datum: 2025-01-16
-- ================================================================

-- Füge neue Spalte hinzu
ALTER TABLE coin_exchange_info 
ADD COLUMN IF NOT EXISTS in_testnet_available BOOLEAN DEFAULT NULL;

-- Kommentar
COMMENT ON COLUMN coin_exchange_info.in_testnet_available IS 'Gibt an ob das Symbol im Binance Testnet verfügbar ist (true/false). NULL wenn nicht geprüft.';

-- Index für schnelle Abfrage
CREATE INDEX IF NOT EXISTS idx_coin_exchange_info_testnet ON coin_exchange_info(in_testnet_available);

-- Erfolgsmeldung
DO $$
BEGIN
  RAISE NOTICE '✅ Spalte in_testnet_available erfolgreich hinzugefügt';
END $$;

