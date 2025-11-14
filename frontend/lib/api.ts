// API Client für Backend-Integration

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Bot Status
  async getStatus() {
    return this.request<{ status: string; timestamp: string }>('/api/status');
  }

  async startBot() {
    return this.request<{
      success: boolean;
      message: string;
      status: string;
    }>('/api/start-bot', {
      method: 'POST',
    });
  }

  async stopBot() {
    return this.request<{
      success: boolean;
      message: string;
      status: string;
    }>('/api/stop-bot', {
      method: 'POST',
    });
  }

  // Strategy Performance
  async getStrategyPerformance() {
    return this.request<{
      success: boolean;
      performance: Array<{
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
      }>;
    }>('/api/strategy-performance');
  }

  // Backtesting
  async runBacktest(params: {
    strategyId: string;
    symbol: string;
    startDate: string;
    endDate: string;
    timeframe?: string;
  }) {
    return this.request<{
      success: boolean;
      results: {
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
      };
    }>('/api/backtest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

export const apiClient = new ApiClient();

