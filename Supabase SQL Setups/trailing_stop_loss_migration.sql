-- ================================================================
-- TRAILING STOP LOSS MIGRATION
-- ================================================================
-- Erweitert die positions Tabelle um Trailing Stop Loss Felder
-- Führen Sie dieses SQL im Supabase SQL Editor aus
-- ================================================================

-- 1. ERWEITERE POSITIONS TABELLE UM TRAILING STOP LOSS FELDER
-- ================================================================

-- Füge neue Spalten hinzu (wenn sie noch nicht existieren)
DO $$ 
BEGIN
  -- highest_price: Höchstpreis seit Position-Eröffnung
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'highest_price'
  ) THEN
    ALTER TABLE positions 
    ADD COLUMN highest_price DECIMAL(20, 8);
  END IF;

  -- trailing_stop_price: Aktueller Trailing Stop Preis
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'trailing_stop_price'
  ) THEN
    ALTER TABLE positions 
    ADD COLUMN trailing_stop_price DECIMAL(20, 8);
  END IF;

  -- use_trailing_stop: Flag ob Trailing Stop aktiv ist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'use_trailing_stop'
  ) THEN
    ALTER TABLE positions 
    ADD COLUMN use_trailing_stop BOOLEAN DEFAULT false;
  END IF;

  -- trailing_stop_activation_threshold: Mindest-Gewinn in % bevor Trailing aktiv wird (optional)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'positions' AND column_name = 'trailing_stop_activation_threshold'
  ) THEN
    ALTER TABLE positions 
    ADD COLUMN trailing_stop_activation_threshold DECIMAL(5, 2) DEFAULT 0;
  END IF;
END $$;

-- 2. MIGRIERE BESTEHENDE OFFENE POSITIONEN
-- ================================================================
-- Setze highest_price und trailing_stop_price für bestehende Positionen
-- basierend auf Strategie-Konfiguration

UPDATE positions p
SET 
  -- Initialisiere highest_price mit entry_price
  highest_price = COALESCE(p.highest_price, p.entry_price),
  -- Initialisiere trailing_stop_price basierend auf Strategie-Config
  trailing_stop_price = CASE
    WHEN p.highest_price IS NULL THEN
      -- Berechne initialen Trailing Stop basierend auf Strategie-Config
      p.entry_price * (1 - COALESCE(
        (s.config->'risk'->>'stop_loss_percent')::DECIMAL / 100,
        0.02  -- Default 2%
      ))
    ELSE p.trailing_stop_price
  END,
  -- use_trailing_stop aus Strategie-Config (default: false)
  use_trailing_stop = COALESCE(
    (s.config->'risk'->>'use_trailing_stop')::BOOLEAN,
    false
  ),
  -- trailing_stop_activation_threshold aus Strategie-Config (default: 0)
  trailing_stop_activation_threshold = COALESCE(
    (s.config->'risk'->>'trailing_stop_activation_threshold')::DECIMAL,
    0
  )
FROM strategies s
WHERE p.strategy_id = s.id
  AND p.status = 'open'
  AND p.quantity > 0;

-- 3. ERWEITERE STRATEGIES CONFIG FÜR TRAILING STOP LOSS
-- ================================================================
-- Füge Trailing Stop Loss Optionen zu bestehenden Strategien hinzu
-- (nur wenn sie noch nicht existieren)

UPDATE strategies
SET config = jsonb_set(
  jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{risk}',
    COALESCE(config->'risk', '{}'::jsonb) || jsonb_build_object(
      'use_trailing_stop', COALESCE((config->'risk'->>'use_trailing_stop')::BOOLEAN, false),
      'trailing_stop_activation_threshold', COALESCE(
        (config->'risk'->>'trailing_stop_activation_threshold')::DECIMAL,
        0
      )
    )
  ),
  '{updated_at}',
  to_jsonb(NOW())
)
WHERE config->'risk'->>'use_trailing_stop' IS NULL;

-- 4. VERIFIZIERUNG
-- ================================================================
-- Prüfe ob Migration erfolgreich war

SELECT 
  'Migration erfolgreich!' as status,
  COUNT(*) FILTER (WHERE highest_price IS NOT NULL) as positions_with_highest_price,
  COUNT(*) FILTER (WHERE trailing_stop_price IS NOT NULL) as positions_with_trailing_stop,
  COUNT(*) FILTER (WHERE use_trailing_stop = true) as positions_with_trailing_enabled,
  COUNT(*) as total_open_positions
FROM positions
WHERE status = 'open' AND quantity > 0;

-- Zeige Strategien mit Trailing Stop Config
SELECT 
  name,
  symbol,
  config->'risk'->>'stop_loss_percent' as stop_loss_percent,
  config->'risk'->>'use_trailing_stop' as use_trailing_stop,
  config->'risk'->>'trailing_stop_activation_threshold' as activation_threshold
FROM strategies
WHERE config->'risk'->>'use_trailing_stop' IS NOT NULL
ORDER BY name;

-- ================================================================
-- HINWEISE
-- ================================================================
-- 1. Bestehende offene Positionen wurden automatisch migriert
-- 2. Neue Positionen erhalten Trailing Stop Werte aus Strategie-Config
-- 3. use_trailing_stop = false bedeutet: Normale statische Stop Loss Logik
-- 4. use_trailing_stop = true bedeutet: Trailing Stop Loss Logik
-- 5. trailing_stop_activation_threshold = 0 bedeutet: Sofort aktiv
-- 6. trailing_stop_activation_threshold > 0 bedeutet: Erst nach X% Gewinn aktiv

