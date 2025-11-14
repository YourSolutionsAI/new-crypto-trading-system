// API Response Types

export interface BotStatus {
  status: 'gestoppt' | 'läuft' | 'startet' | 'stoppt';
  timestamp: string;
}

export interface BotControlResponse {
  success: boolean;
  message: string;
  status: string;
  error?: string;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  symbol: string;
  config: {
    ma_short?: number;
    ma_long?: number;
    trade_size_usdt?: number;
    settings?: {
      signal_threshold_percent?: number;
      signal_cooldown_ms?: number;
      trade_cooldown_ms?: number;
    };
    risk?: {
      stop_loss_percent?: number;
      take_profit_percent?: number;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  strategy_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  total: number;
  status: 'pending' | 'executed' | 'failed';
  executed_at: string | null;
  created_at: string;
  pnl?: number;
  pnl_percent?: number;
}

export interface OpenPosition {
  symbol: string;
  strategyId: string;
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  symbol: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  returnPercent: number;
}

export interface BacktestRequest {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  timeframe?: string;
}

export interface BacktestResult {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalPnl: number;
  returnPercent: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  trades: Array<{
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    reason: string;
    timestamp: number;
  }>;
}

export interface LivePrice {
  symbol: string;
  price: number;
  change24h?: number;
  changePercent24h?: number;
}

export interface BotLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  data: Record<string, any> | null;
  created_at: string;
}

