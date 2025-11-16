-- ================================================================
-- BINANCE EXCHANGE INFO PERSISTIERUNG
-- ================================================================
-- Speichert Exchange-Informationen zu unseren Coins in der Datenbank
-- Ermöglicht:
-- - Monitoring von Status-Änderungen (TRADING → BREAK/HALT)
-- - Erkennung von Filter-Änderungen (minQty, minNotional, etc.)
-- - Automatische Alerts bei kritischen Änderungen
-- - Order-Validierung gegen aktuelle Binance-Limits
-- ================================================================

-- ================================================================
-- 1. RATE LIMITS (Globale Binance Rate Limits)
-- ================================================================
CREATE TABLE IF NOT EXISTS binance_rate_limits (
  id SERIAL PRIMARY KEY,
  rate_limit_type TEXT NOT NULL,              -- "REQUEST_WEIGHT", "ORDERS", "RAW_REQUESTS"
  interval TEXT NOT NULL,                     -- "SECOND", "MINUTE", "DAY"
  interval_num INTEGER NOT NULL,
  limit_value INTEGER NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_rate_limits_updated ON binance_rate_limits(last_updated_at DESC);

COMMENT ON TABLE binance_rate_limits IS 'Globale Binance API Rate Limits';

-- ================================================================
-- 2. AKTUELLE EXCHANGE INFO (1 Zeile pro Coin)
-- ================================================================
CREATE TABLE IF NOT EXISTS coin_exchange_info (
  symbol TEXT PRIMARY KEY,                    -- z.B. "BTCUSDT"
  
  -- Status & Basic Info
  status TEXT NOT NULL,                       -- "TRADING", "BREAK", "HALT"
  is_spot_trading_allowed BOOLEAN,
  is_margin_trading_allowed BOOLEAN,
  quote_order_qty_market_allowed BOOLEAN,
  allow_trailing_stop BOOLEAN,
  
  -- Assets & Precision
  base_asset TEXT NOT NULL,                   -- z.B. "BTC"
  quote_asset TEXT NOT NULL,                  -- z.B. "USDT"
  base_asset_precision INTEGER,
  quote_asset_precision INTEGER,
  quote_precision INTEGER,
  base_commission_precision INTEGER,
  quote_commission_precision INTEGER,
  
  -- Order Types & Features
  order_types TEXT[],                         -- Array: ["LIMIT", "MARKET", ...]
  iceberg_allowed BOOLEAN,
  oco_allowed BOOLEAN,
  oto_allowed BOOLEAN,
  cancel_replace_allowed BOOLEAN,
  amend_allowed BOOLEAN,
  peg_instructions_allowed BOOLEAN,
  
  -- Self Trade Prevention
  default_self_trade_prevention_mode TEXT,
  allowed_self_trade_prevention_modes TEXT[],
  
  -- Wichtigste Filter (für schnellen Zugriff)
  -- PRICE_FILTER
  min_price DECIMAL(20,8),
  max_price DECIMAL(20,8),
  tick_size DECIMAL(20,8),
  
  -- LOT_SIZE
  min_qty DECIMAL(20,8),
  max_qty DECIMAL(20,8),
  step_size DECIMAL(20,8),
  
  -- NOTIONAL
  min_notional DECIMAL(20,8),
  max_notional DECIMAL(20,8),
  apply_min_to_market BOOLEAN,
  
  -- Vollständige Filter als JSON (für Details)
  filters JSONB NOT NULL,                     -- Alle Filter im Original-Format
  
  -- Permissions
  permissions TEXT[],
  permission_sets JSONB,
  
  -- Timestamps
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_coin_exchange_info_status ON coin_exchange_info(status);
CREATE INDEX IF NOT EXISTS idx_coin_exchange_info_updated ON coin_exchange_info(last_updated_at);

-- Kommentar
COMMENT ON TABLE coin_exchange_info IS 'Aktuelle Binance Exchange-Informationen für unsere gehandelten Coins';

-- ================================================================
-- 3. ÄNDERUNGSVERLAUF (History für Monitoring)
-- ================================================================
CREATE TABLE IF NOT EXISTS coin_exchange_info_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  
  -- Was hat sich geändert?
  change_type TEXT NOT NULL,                  -- "status", "filter", "permission"
  field_name TEXT,                            -- z.B. "min_qty", "status"
  old_value TEXT,
  new_value TEXT,
  
  -- Vollständiger Snapshot (optional)
  snapshot JSONB,
  
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_history_symbol ON coin_exchange_info_history(symbol);
CREATE INDEX IF NOT EXISTS idx_exchange_history_type ON coin_exchange_info_history(change_type);
CREATE INDEX IF NOT EXISTS idx_exchange_history_changed_at ON coin_exchange_info_history(changed_at);

COMMENT ON TABLE coin_exchange_info_history IS 'Historischer Verlauf aller Änderungen an Exchange-Informationen';

-- ================================================================
-- 4. MONITORING ALERTS
-- ================================================================
CREATE TABLE IF NOT EXISTS coin_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  alert_type TEXT NOT NULL,                   -- "status_change", "filter_change", "permission_change"
  severity TEXT NOT NULL,                     -- "critical", "warning", "info"
  message TEXT NOT NULL,
  details JSONB,
  
  -- Status
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_alerts_symbol ON coin_alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_coin_alerts_severity ON coin_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_coin_alerts_acknowledged ON coin_alerts(is_acknowledged);
CREATE INDEX IF NOT EXISTS idx_coin_alerts_created ON coin_alerts(created_at DESC);

COMMENT ON TABLE coin_alerts IS 'System-Alerts bei kritischen Änderungen (Status, Filter, etc.)';

-- ================================================================
-- 5. HELPER FUNCTION: Vergleiche und erkenne Änderungen
-- ================================================================
CREATE OR REPLACE FUNCTION detect_exchange_info_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Status-Änderung
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'status', 'status', OLD.status, NEW.status);
    
    -- Alert erstellen bei kritischen Status-Änderungen
    IF NEW.status IN ('BREAK', 'HALT', 'PRE_TRADING', 'POST_TRADING') THEN
      INSERT INTO coin_alerts (symbol, alert_type, severity, message, details)
      VALUES (
        NEW.symbol, 
        'status_change', 
        CASE 
          WHEN NEW.status = 'HALT' THEN 'critical'
          WHEN NEW.status = 'BREAK' THEN 'warning'
          ELSE 'info'
        END,
        format('⚠️ Symbol %s Status geändert: %s → %s', NEW.symbol, OLD.status, NEW.status),
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'timestamp', NOW())
      );
    END IF;
  END IF;
  
  -- Min Qty Änderung
  IF OLD.min_qty IS DISTINCT FROM NEW.min_qty THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'filter', 'min_qty', OLD.min_qty::TEXT, NEW.min_qty::TEXT);
    
    INSERT INTO coin_alerts (symbol, alert_type, severity, message, details)
    VALUES (
      NEW.symbol,
      'filter_change',
      'info',
      format('ℹ️ Min Qty für %s geändert: %s → %s', NEW.symbol, OLD.min_qty, NEW.min_qty),
      jsonb_build_object('filter', 'min_qty', 'old_value', OLD.min_qty, 'new_value', NEW.min_qty)
    );
  END IF;
  
  -- Max Qty Änderung
  IF OLD.max_qty IS DISTINCT FROM NEW.max_qty THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'filter', 'max_qty', OLD.max_qty::TEXT, NEW.max_qty::TEXT);
  END IF;
  
  -- Step Size Änderung
  IF OLD.step_size IS DISTINCT FROM NEW.step_size THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'filter', 'step_size', OLD.step_size::TEXT, NEW.step_size::TEXT);
  END IF;
  
  -- Min Notional Änderung
  IF OLD.min_notional IS DISTINCT FROM NEW.min_notional THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'filter', 'min_notional', OLD.min_notional::TEXT, NEW.min_notional::TEXT);
    
    -- Alert bei signifikanten Änderungen (>10%)
    IF OLD.min_notional > 0 AND ABS(NEW.min_notional - OLD.min_notional) / OLD.min_notional > 0.1 THEN
      INSERT INTO coin_alerts (symbol, alert_type, severity, message, details)
      VALUES (
        NEW.symbol,
        'filter_change',
        'warning',
        format('⚠️ Min Notional für %s um >10%% geändert: %s → %s', NEW.symbol, OLD.min_notional, NEW.min_notional),
        jsonb_build_object('filter', 'min_notional', 'old_value', OLD.min_notional, 'new_value', NEW.min_notional, 'change_percent', ((NEW.min_notional - OLD.min_notional) / OLD.min_notional * 100))
      );
    END IF;
  END IF;
  
  -- Tick Size Änderung
  IF OLD.tick_size IS DISTINCT FROM NEW.tick_size THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'filter', 'tick_size', OLD.tick_size::TEXT, NEW.tick_size::TEXT);
  END IF;
  
  -- Spot Trading Status Änderung
  IF OLD.is_spot_trading_allowed IS DISTINCT FROM NEW.is_spot_trading_allowed THEN
    INSERT INTO coin_exchange_info_history (symbol, change_type, field_name, old_value, new_value)
    VALUES (NEW.symbol, 'permission', 'is_spot_trading_allowed', OLD.is_spot_trading_allowed::TEXT, NEW.is_spot_trading_allowed::TEXT);
    
    -- Kritischer Alert wenn Spot Trading deaktiviert wird
    IF NEW.is_spot_trading_allowed = false THEN
      INSERT INTO coin_alerts (symbol, alert_type, severity, message, details)
      VALUES (
        NEW.symbol,
        'permission_change',
        'critical',
        format('🚨 CRITICAL: Spot Trading für %s wurde deaktiviert!', NEW.symbol),
        jsonb_build_object('old_value', OLD.is_spot_trading_allowed, 'new_value', NEW.is_spot_trading_allowed)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger auf UPDATE
DROP TRIGGER IF EXISTS exchange_info_change_detection ON coin_exchange_info;
CREATE TRIGGER exchange_info_change_detection
AFTER UPDATE ON coin_exchange_info
FOR EACH ROW
EXECUTE FUNCTION detect_exchange_info_changes();

-- ================================================================
-- 6. VIEW: Coins mit Exchange-Info und Alert-Status
-- ================================================================
CREATE OR REPLACE VIEW coins_with_exchange_info AS
SELECT 
  cs.symbol,
  cs.active,
  cs.strategy_id,
  cs.config as bot_config,
  
  -- Exchange Info
  cei.status,
  cei.is_spot_trading_allowed,
  cei.min_price,
  cei.max_price,
  cei.tick_size,
  cei.min_qty,
  cei.max_qty,
  cei.step_size,
  cei.min_notional,
  cei.max_notional,
  cei.filters,
  cei.order_types,
  
  -- Status Flags
  CASE 
    WHEN cei.status != 'TRADING' THEN true 
    ELSE false 
  END as has_trading_restriction,
  
  CASE
    WHEN cei.last_updated_at < NOW() - INTERVAL '2 days' THEN true
    ELSE false
  END as exchange_info_outdated,
  
  -- Alert Count
  (SELECT COUNT(*) 
   FROM coin_alerts 
   WHERE symbol = cs.symbol 
     AND is_acknowledged = false
  ) as unacknowledged_alerts_count,
  
  cs.updated_at as bot_config_updated_at,
  cei.last_updated_at as exchange_info_updated_at,
  cei.first_seen_at as exchange_info_first_seen_at
  
FROM coin_strategies cs
LEFT JOIN coin_exchange_info cei ON cs.symbol = cei.symbol;

COMMENT ON VIEW coins_with_exchange_info IS 'Vollständige Coin-Übersicht mit Bot-Config und Exchange-Info';

-- ================================================================
-- 7. FUNCTION: Bereinige alte History-Einträge (Maintenance)
-- ================================================================
CREATE OR REPLACE FUNCTION cleanup_old_history(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM coin_exchange_info_history
  WHERE changed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_history IS 'Löscht History-Einträge älter als X Tage (Standard: 90)';

-- ================================================================
-- 8. INITIAL DATA COMMENT
-- ================================================================
-- Nach Ausführung dieses Skripts:
-- 1. Backend-Sync ausführen um initiale Daten zu laden
-- 2. Oder manuell über Frontend "Sync Exchange Info" Button
-- ================================================================

-- Beispiel-Query: Hole alle Coins mit kritischen Alerts
-- SELECT * FROM coins_with_exchange_info WHERE unacknowledged_alerts_count > 0;

-- Beispiel-Query: Hole alle Status-Änderungen der letzten 7 Tage
-- SELECT * FROM coin_exchange_info_history 
-- WHERE change_type = 'status' 
--   AND changed_at > NOW() - INTERVAL '7 days'
-- ORDER BY changed_at DESC;

