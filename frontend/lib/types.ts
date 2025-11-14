// Type Definitions für das Crypto Trading Bot Frontend

export interface BotStatus {
  status: 'running' | 'stopped' | 'error';
  timestamp: string;
  version?: string;
  tradingBotProcessCount?: number;
  message?: string;
}

export interface Strategy {
  id: string;
  created_at: string;
  symbol: string;
  name: string;
  is_active: boolean;
  config: {
    ma_short: number;
    ma_long: number;
    trade_size_usdt: number;
    max_concurrent_trades: number;
    settings?: {
      signal_threshold_percent: number;
      signal_cooldown_ms: number;
      trade_cooldown_ms: number;
    };
    risk?: {
      stop_loss_percent?: number;
      take_profit_percent?: number;
    };
    indicators?: {
      use_rsi?: boolean;
      use_macd?: boolean;
      use_bollinger?: boolean;
      use_stochastic?: boolean;
      rsi_period?: number;
      rsi_oversold?: number;
      rsi_overbought?: number;
      macd_fast?: number;
      macd_slow?: number;
      macd_signal?: number;
      bollinger_period?: number;
      bollinger_std_dev?: number;
      stochastic_period?: number;
      stochastic_smooth_k?: number;
      stochastic_smooth_d?: number;
    };
  };
  total_trades?: number;
  profitable_trades?: number;
  total_pnl?: number;
  win_rate?: number;
}

export interface Trade {
  id: string;
  created_at: string;
  strategy_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl?: number;
  order_id: string;
  status: string;
  metadata?: {
    signal: string;
    confidence?: number;
    indicators?: any;
    orderDetails?: any;
  };
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  createdAt: string;
  duration: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  change24hPercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: string;
}

export interface PerformanceData {
  totalPnL: number;
  todayPnL: number;
  weekPnL: number;
  monthPnL: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
}

export interface BacktestRequest {
  strategyId: string;
  symbol: string;
  startDate: string;
  endDate: string;
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

export interface BacktestResult {
  strategy: Strategy;
  symbol: string;
  period: {
    start: string;
    end: string;
    timeframe: string;
  };
  metrics: {
    totalTrades: number;
    winCount: number;
    lossCount: number;
    winRate: number;
    totalPnL: number;
    totalReturn: number;
    maxDrawdown: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
  };
  trades: Array<{
    entryTime: string;
    exitTime: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    return: number;
  }>;
}

export interface WebSocketMessage {
  type: 'price' | 'trade' | 'signal' | 'position' | 'status';
  data: any;
  timestamp: string;
}
