-- ================================================================
-- POSITIONS TABLE FÜR EXPLIZITES POSITION-TRACKING
-- ================================================================
-- Diese Tabelle speichert explizit alle offenen Positionen
-- und vermeidet die Notwendigkeit, sie aus Trades zu berechnen
-- ================================================================

-- 1. POSITIONS TABELLE ERSTELLEN
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  
  -- Position Details
  quantity DECIMAL(20, 8) NOT NULL CHECK (quantity >= 0),
  entry_price DECIMAL(20, 8) NOT NULL,
  
  -- Tracking
  total_buy_quantity DECIMAL(20, 8) DEFAULT 0, -- Gesamte gekaufte Menge
  total_buy_value DECIMAL(20, 8) DEFAULT 0,    -- Gesamter Kaufwert für gewichteten Durchschnitt
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'partial')),
  
  -- Zeitstempel
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indizes für Performance
CREATE INDEX idx_positions_strategy_id ON positions(strategy_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_strategy_symbol ON positions(strategy_id, symbol);

-- Eindeutigkeit: Nur eine offene Position pro Strategie/Symbol
CREATE UNIQUE INDEX idx_positions_unique_open 
ON positions(strategy_id, symbol) 
WHERE status = 'open';

-- 2. TRIGGER FÜR UPDATED_AT
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_positions_updated_at_trigger
BEFORE UPDATE ON positions
FOR EACH ROW
EXECUTE FUNCTION update_positions_updated_at();

-- 3. FUNKTIONEN FÜR POSITION-MANAGEMENT

-- Funktion: Position öffnen oder erweitern
CREATE OR REPLACE FUNCTION open_or_update_position(
  p_strategy_id UUID,
  p_symbol TEXT,
  p_quantity DECIMAL(20, 8),
  p_price DECIMAL(20, 8)
)
RETURNS UUID AS $$
DECLARE
  v_position_id UUID;
  v_existing_quantity DECIMAL(20, 8);
  v_existing_value DECIMAL(20, 8);
  v_new_total_value DECIMAL(20, 8);
  v_new_entry_price DECIMAL(20, 8);
BEGIN
  -- Prüfe ob bereits eine offene Position existiert
  SELECT id, quantity, total_buy_value 
  INTO v_position_id, v_existing_quantity, v_existing_value
  FROM positions
  WHERE strategy_id = p_strategy_id 
    AND symbol = p_symbol 
    AND status = 'open'
  FOR UPDATE;
  
  IF v_position_id IS NULL THEN
    -- Neue Position erstellen
    INSERT INTO positions (
      strategy_id, symbol, quantity, entry_price, 
      total_buy_quantity, total_buy_value, status
    ) VALUES (
      p_strategy_id, p_symbol, p_quantity, p_price,
      p_quantity, p_quantity * p_price, 'open'
    )
    RETURNING id INTO v_position_id;
  ELSE
    -- Bestehende Position erweitern (Average Up/Down)
    v_new_total_value := v_existing_value + (p_quantity * p_price);
    v_new_entry_price := v_new_total_value / (v_existing_quantity + p_quantity);
    
    UPDATE positions
    SET quantity = quantity + p_quantity,
        entry_price = v_new_entry_price,
        total_buy_quantity = total_buy_quantity + p_quantity,
        total_buy_value = v_new_total_value
    WHERE id = v_position_id;
  END IF;
  
  RETURN v_position_id;
END;
$$ LANGUAGE plpgsql;

-- Funktion: Position reduzieren oder schließen
CREATE OR REPLACE FUNCTION reduce_or_close_position(
  p_strategy_id UUID,
  p_symbol TEXT,
  p_quantity DECIMAL(20, 8)
)
RETURNS RECORD AS $$
DECLARE
  v_position_id UUID;
  v_current_quantity DECIMAL(20, 8);
  v_entry_price DECIMAL(20, 8);
  v_result RECORD;
BEGIN
  -- Hole aktuelle Position
  SELECT id, quantity, entry_price 
  INTO v_position_id, v_current_quantity, v_entry_price
  FROM positions
  WHERE strategy_id = p_strategy_id 
    AND symbol = p_symbol 
    AND status = 'open'
  FOR UPDATE;
  
  IF v_position_id IS NULL THEN
    -- Keine offene Position gefunden
    SELECT NULL::UUID as position_id, 
           0::DECIMAL as remaining_quantity, 
           'no_position'::TEXT as action,
           0::DECIMAL as entry_price INTO v_result;
    RETURN v_result;
  END IF;
  
  IF p_quantity >= v_current_quantity THEN
    -- Position komplett schließen
    UPDATE positions
    SET quantity = 0,
        status = 'closed',
        closed_at = NOW()
    WHERE id = v_position_id;
    
    SELECT v_position_id as position_id, 
           0::DECIMAL as remaining_quantity, 
           'closed'::TEXT as action,
           v_entry_price as entry_price INTO v_result;
  ELSE
    -- Position teilweise reduzieren
    UPDATE positions
    SET quantity = quantity - p_quantity,
        status = 'partial'
    WHERE id = v_position_id;
    
    SELECT v_position_id as position_id, 
           (v_current_quantity - p_quantity) as remaining_quantity, 
           'reduced'::TEXT as action,
           v_entry_price as entry_price INTO v_result;
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 4. VIEW FÜR EINFACHE ABFRAGEN
CREATE OR REPLACE VIEW active_positions AS
SELECT 
  p.id,
  p.strategy_id,
  s.name as strategy_name,
  p.symbol,
  p.quantity,
  p.entry_price,
  p.quantity * p.entry_price as position_value,
  p.opened_at,
  p.updated_at
FROM positions p
JOIN strategies s ON s.id = p.strategy_id
WHERE p.status = 'open' AND p.quantity > 0
ORDER BY p.opened_at DESC;

-- 5. MIGRATION: Bestehende offene Positionen aus Trades berechnen
-- (Nur einmalig ausführen nach Tabellen-Erstellung)
-- Auskommentiert, da es manuell ausgeführt werden sollte
/*
DO $$
DECLARE
  v_strategy RECORD;
  v_net_quantity DECIMAL(20, 8);
  v_weighted_avg_price DECIMAL(20, 8);
BEGIN
  -- Für jede aktive Strategie
  FOR v_strategy IN 
    SELECT id, symbol FROM strategies WHERE active = true
  LOOP
    -- Berechne Netto-Position
    WITH trade_summary AS (
      SELECT 
        SUM(CASE WHEN side = 'buy' THEN quantity ELSE 0 END) as total_buy_qty,
        SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE 0 END) as total_buy_value,
        SUM(CASE WHEN side = 'sell' THEN quantity ELSE 0 END) as total_sell_qty
      FROM trades
      WHERE strategy_id = v_strategy.id 
        AND symbol = v_strategy.symbol
        AND status = 'executed'
    )
    SELECT 
      total_buy_qty - total_sell_qty,
      CASE 
        WHEN total_buy_qty > 0 THEN total_buy_value / total_buy_qty 
        ELSE 0 
      END
    INTO v_net_quantity, v_weighted_avg_price
    FROM trade_summary;
    
    -- Wenn Netto-Position > 0, erstelle Position
    IF v_net_quantity > 0.00000001 THEN
      INSERT INTO positions (
        strategy_id, symbol, quantity, entry_price, 
        total_buy_quantity, total_buy_value, status
      ) VALUES (
        v_strategy.id, v_strategy.symbol, v_net_quantity, v_weighted_avg_price,
        v_net_quantity, v_net_quantity * v_weighted_avg_price, 'open'
      );
      
      RAISE NOTICE 'Migrated position for % %: % @ %', 
        v_strategy.symbol, v_strategy.id, v_net_quantity, v_weighted_avg_price;
    END IF;
  END LOOP;
END $$;
*/
