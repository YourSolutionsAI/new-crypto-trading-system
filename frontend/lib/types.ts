// TypeScript Types für das Frontend

export interface BotStatus {
  status: 'running' | 'stopped' | 'läuft' | 'gestoppt' | 'startet...' | string;
  timestamp: string;
}

export interface Trade {
  id: string;
  strategy_id: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  pnl?: number;
  status: string;
  executed_at?: string;
  created_at: string;
  order_id?: string;
  metadata?: any;
}

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  symbol: string;
  is_active: boolean;
  config: {
    ma_short?: number;
    ma_long?: number;
    trade_size_usdt?: number;
    indicators?: {
      ma_short?: number;
      ma_long?: number;
      rsi_period?: number;
      rsi_overbought?: number;
      rsi_oversold?: number;
      macd_fast_period?: number;
      macd_slow_period?: number;
      macd_signal_period?: number;
      bollinger_period?: number;
      bollinger_std_dev?: number;
    };
    settings?: {
      signal_threshold_percent?: number;
      signal_cooldown_ms?: number;
      trade_cooldown_ms?: number;
    };
    risk?: {
      max_trade_size_usdt?: number;
      stop_loss_percent?: number;
      take_profit_percent?: number;
      max_concurrent_trades?: number;
    };
  };
  total_trades?: number;
  profitable_trades?: number;
  total_pnl?: number;
  win_rate?: number;
  created_at: string;
  updated_at: string;
}

