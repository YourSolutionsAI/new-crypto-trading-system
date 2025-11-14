import axios, { AxiosInstance } from 'axios';
import { 
  BotStatus, 
  Strategy, 
  Trade, 
  Position, 
  PerformanceData, 
  BacktestRequest,
  BacktestResult 
} from './types';

class TradingBotAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor für Error Handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Bot Control
  async getStatus(): Promise<BotStatus> {
    const { data } = await this.client.get<BotStatus>('/api/status');
    return data;
  }

  async startBot(): Promise<{ success: boolean; message: string; data?: any }> {
    const { data } = await this.client.post('/api/start-bot');
    return data;
  }

  async stopBot(): Promise<{ success: boolean; message: string }> {
    const { data } = await this.client.post('/api/stop-bot');
    return data;
  }

  // Strategies
  async getStrategies(): Promise<Strategy[]> {
    const { data } = await this.client.get<{ strategies: Strategy[] }>('/api/strategies');
    return data.strategies;
  }

  async updateStrategy(id: string, updates: Partial<Strategy>): Promise<Strategy> {
    const { data } = await this.client.put<{ strategy: Strategy }>(`/api/strategies/${id}`, updates);
    return data.strategy;
  }

  async toggleStrategy(id: string, isActive: boolean): Promise<Strategy> {
    const { data } = await this.client.patch<{ strategy: Strategy }>(
      `/api/strategies/${id}/toggle`, 
      { is_active: isActive }
    );
    return data.strategy;
  }

  // Trading
  async getTrades(limit = 50, offset = 0): Promise<Trade[]> {
    const { data } = await this.client.get<{ trades: Trade[] }>('/api/trades', {
      params: { limit, offset },
    });
    return data.trades;
  }

  async getPositions(): Promise<Position[]> {
    const { data } = await this.client.get<{ positions: Position[] }>('/api/positions');
    return data.positions;
  }

  // Performance
  async getPerformance(): Promise<PerformanceData> {
    const { data } = await this.client.get<{ performance: PerformanceData }>('/api/performance');
    return data.performance;
  }

  async getStrategyPerformance(): Promise<Array<{
    strategy_id: string;
    strategy_name: string;
    symbol: string;
    total_trades: number;
    win_count: number;
    loss_count: number;
    win_rate: number;
    total_pnl: number;
    avg_pnl: number;
    return_percent: number;
  }>> {
    const { data } = await this.client.get('/api/strategy-performance');
    return data.performance;
  }

  // Backtesting
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const { data } = await this.client.post<{ success: boolean; result: BacktestResult }>(
      '/api/backtest', 
      request
    );
    return data.result;
  }

  // Market Data
  async getMarketPrices(symbols: string[]): Promise<Record<string, number>> {
    const { data } = await this.client.get<{ prices: Record<string, number> }>('/api/market/prices', {
      params: { symbols: symbols.join(',') },
    });
    return data.prices;
  }
}

// Export singleton instance
export const api = new TradingBotAPI();

// Export for testing or custom instances
export default TradingBotAPI;
