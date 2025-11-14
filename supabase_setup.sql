-- ================================================================
-- SUPABASE DATENBANK-SETUP FÜR CRYPTO TRADING BOT
-- ================================================================
-- Führen Sie diese SQL-Befehle im Supabase SQL Editor aus
-- (Dashboard → SQL Editor → New Query)
-- ================================================================

-- 1. STRATEGIES TABELLE
-- Speichert Trading-Strategien mit Konfigurationen
CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT false,
  symbol TEXT DEFAULT 'BTCUSDT', -- Trading-Paar (z.B. BTCUSDT, ETHUSDT)
  
  -- Strategie-Konfiguration als JSON
  config JSONB DEFAULT '{
    "type": "simple_ma",
    "timeframe": "1h",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50
    },
    "risk": {
      "max_trade_size": 100,
      "stop_loss_percent": 2,
      "take_profit_percent": 5
    }
  }'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfrage aktiver Strategien
CREATE INDEX idx_strategies_active ON strategies(active);

-- 2. TRADES TABELLE
-- Speichert alle durchgeführten Trades
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  
  symbol TEXT NOT NULL, -- z.B. 'BTCUSDT'
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  
  -- Preis und Mengen-Informationen
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  total DECIMAL(20, 8) NOT NULL,
  
  -- Order-Informationen
  order_id TEXT, -- Binance Order ID
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
  
  -- Gewinn/Verlust
  pnl DECIMAL(20, 8), -- Profit and Loss
  pnl_percent DECIMAL(10, 4),
  
  -- Timestamps
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Zusätzliche Metadaten
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indizes für schnelle Abfragen
CREATE INDEX idx_trades_strategy ON trades(strategy_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);

-- 3. BOT_LOGS TABELLE
-- Protokolliert alle Bot-Aktivitäten
CREATE TABLE IF NOT EXISTS bot_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'debug')),
  message TEXT NOT NULL,
  
  -- Zusätzliche strukturierte Daten
  data JSONB DEFAULT '{}'::jsonb,
  
  -- Optional: Referenz zu Trade oder Strategy
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Log-Level und Zeitstempel
CREATE INDEX idx_bot_logs_level ON bot_logs(level);
CREATE INDEX idx_bot_logs_created_at ON bot_logs(created_at DESC);

-- 4. MARKET_DATA TABELLE
-- Speichert historische Marktdaten (optional)
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8),
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Zusätzliche Marktdaten
  data JSONB DEFAULT '{}'::jsonb
);

-- Index für Symbol und Zeitstempel
CREATE INDEX idx_market_data_symbol_time ON market_data(symbol, timestamp DESC);

-- 5. BOT_SETTINGS TABELLE
-- Globale Bot-Einstellungen
CREATE TABLE IF NOT EXISTS bot_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- BEISPIEL-DATEN ZUM TESTEN
-- ================================================================

-- Beispiel-Strategie einfügen
INSERT INTO strategies (name, description, active, symbol, config)
VALUES (
  'MA Cross Strategy',
  'Einfache Moving Average Cross-over Strategie für BTC/USDT',
  false, -- Zunächst deaktiviert
  'BTCUSDT',
  '{
    "type": "ma_cross",
    "timeframe": "1h",
    "indicators": {
      "ma_short": 20,
      "ma_long": 50,
      "rsi_period": 14,
      "rsi_overbought": 70,
      "rsi_oversold": 30
    },
    "risk": {
      "max_trade_size_usdt": 100,
      "stop_loss_percent": 2,
      "take_profit_percent": 5,
      "max_concurrent_trades": 3
    }
  }'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Globale Bot-Einstellungen
INSERT INTO bot_settings (key, value, description)
VALUES 
  ('max_daily_trades', '10', 'Maximale Anzahl Trades pro Tag'),
  ('trading_enabled', 'false', 'Master-Switch für Trading (true/false)'),
  ('api_mode', '"testnet"', 'API-Modus: testnet oder live')
ON CONFLICT (key) DO NOTHING;

-- ================================================================
-- TRIGGER: Auto-Update Timestamp
-- ================================================================

-- Function zum automatischen Update des updated_at Feldes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger für strategies Tabelle
DROP TRIGGER IF EXISTS update_strategies_updated_at ON strategies;
CREATE TRIGGER update_strategies_updated_at
    BEFORE UPDATE ON strategies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger für bot_settings Tabelle
DROP TRIGGER IF EXISTS update_bot_settings_updated_at ON bot_settings;
CREATE TRIGGER update_bot_settings_updated_at
    BEFORE UPDATE ON bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- ROW LEVEL SECURITY (RLS) - Optional, aber empfohlen
-- ================================================================
-- Hinweis: Da Sie den Service Role Key verwenden, werden RLS-Regeln
-- umgangen. Für zusätzliche Sicherheit können Sie RLS aktivieren.

-- RLS aktivieren (optional)
-- ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bot_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- NÜTZLICHE VIEWS
-- ================================================================

-- View: Aktive Strategien mit Trade-Statistiken
CREATE OR REPLACE VIEW v_active_strategies AS
SELECT 
  s.*,
  COUNT(t.id) as total_trades,
  SUM(CASE WHEN t.status = 'executed' THEN 1 ELSE 0 END) as executed_trades,
  SUM(CASE WHEN t.pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
  SUM(t.pnl) as total_pnl
FROM strategies s
LEFT JOIN trades t ON s.id = t.strategy_id
WHERE s.active = true
GROUP BY s.id;

-- View: Heutige Trading-Performance
CREATE OR REPLACE VIEW v_today_performance AS
SELECT 
  COUNT(*) as total_trades,
  SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) as buy_trades,
  SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) as sell_trades,
  SUM(pnl) as total_pnl,
  AVG(pnl) as avg_pnl,
  SUM(total) as total_volume
FROM trades
WHERE DATE(created_at) = CURRENT_DATE
  AND status = 'executed';

-- ================================================================
-- SETUP ABGESCHLOSSEN!
-- ================================================================
-- Überprüfen Sie die erstellten Tabellen mit:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public';
-- ================================================================

