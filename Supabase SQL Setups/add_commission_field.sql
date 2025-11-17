-- ================================================================
-- HINZUFÜGEN DER COMMISSION SPALTE ZUR TRADES TABELLE
-- ================================================================
-- Diese Migration fügt ein commission Feld hinzu, um Handelsgebühren zu speichern
-- Führen Sie diese SQL-Befehle im Supabase SQL Editor aus
-- ================================================================

-- Füge commission Spalte hinzu (falls nicht vorhanden)
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS commission DECIMAL(20, 8);

-- Füge commission_asset Spalte hinzu (z.B. "USDT" oder "BNB")
ALTER TABLE trades 
ADD COLUMN IF NOT EXISTS commission_asset TEXT;

-- Kommentar hinzufügen für Dokumentation
COMMENT ON COLUMN trades.commission IS 'Handelsgebühr für diesen Trade (von Binance)';
COMMENT ON COLUMN trades.commission_asset IS 'Asset in dem die Gebühr bezahlt wurde (z.B. USDT, BNB)';

-- Index für schnelle Abfragen von Gebühren (optional, aber nützlich)
CREATE INDEX IF NOT EXISTS idx_trades_commission ON trades(commission) WHERE commission IS NOT NULL;

