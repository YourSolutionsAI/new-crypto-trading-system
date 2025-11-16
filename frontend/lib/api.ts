// API Client für Backend-Integration

import axios from 'axios';
import type { BotStatus, Trade, Position, Strategy, CoinStrategy, TestnetBalance } from './types';
import type { BinanceExchangeInfo } from './binance-types';

const API_URL = 
  typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000')
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

// Warnung wenn API_URL nicht gesetzt ist (nur im Browser)
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn('⚠️ NEXT_PUBLIC_API_URL ist nicht gesetzt! Verwende Fallback:', API_URL);
  console.warn('Setze NEXT_PUBLIC_API_URL in Vercel Environment Variables!');
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 Sekunden Timeout
});

// Error Handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('Backend nicht erreichbar. Prüfe NEXT_PUBLIC_API_URL:', API_URL);
    }
    return Promise.reject(error);
  }
);

// Bot Control
export const getBotStatus = async (): Promise<BotStatus> => {
  try {
    const response = await api.get('/api/status');
    console.log('🤖 Bot Status API Response:', response.data);
    const status = response.data.status || 'stopped';
    console.log('🤖 Raw Status:', status);
    
    // Normalisiere Status: 'läuft' -> 'running', 'gestoppt' -> 'stopped'
    const normalizedStatus = 
      status === 'läuft' || status === 'running' ? 'running' :
      status === 'gestoppt' || status === 'stopped' ? 'stopped' :
      status;
    
    console.log('🤖 Normalized Status:', normalizedStatus);
    
    return {
      status: normalizedStatus,
      timestamp: response.data.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Fehler beim Laden des Bot-Status:', error);
    console.error('❌ Error Details:', error);
    return {
      status: 'stopped',
      timestamp: new Date().toISOString()
    };
  }
};

export const startBot = async () => {
  const response = await api.post('/api/start-bot');
  return response.data;
};

export const stopBot = async () => {
  const response = await api.post('/api/stop-bot');
  return response.data;
};

// Trades
export const getTrades = async (limit = 50, offset = 0): Promise<{ trades: Trade[]; total: number; limit: number; offset: number }> => {
  try {
    const response = await api.get('/api/trades', {
      params: { limit, offset },
    });
    const trades = response.data.trades || [];
    // Sicherstellen, dass alle Werte definiert sind
    const normalizedTrades = trades.map((trade: any) => ({
      id: trade.id || '',
      strategy_id: trade.strategy_id || '',
      symbol: trade.symbol || '',
      side: trade.side || 'BUY',
      price: trade.price || 0,
      quantity: trade.quantity || 0,
      total: trade.total || (trade.price || 0) * (trade.quantity || 0),
      pnl: trade.pnl,
      status: trade.status || 'pending',
      executed_at: trade.executed_at,
      created_at: trade.created_at || new Date().toISOString(),
      order_id: trade.order_id,
      metadata: trade.metadata,
    }));
    return {
      trades: normalizedTrades,
      total: response.data.total || 0,
      limit: response.data.limit || limit,
      offset: response.data.offset || offset
    };
  } catch (error) {
    console.error('Fehler beim Laden der Trades:', error);
    return { trades: [], total: 0, limit, offset };
  }
};

// Trade-Statistiken
export interface TradeStats {
  by_strategy: Array<{
    strategy_id: string;
    strategy_name: string;
    buys: number;
    sells: number;
    total_pnl: number;
  }>;
  by_coin: Array<{
    symbol: string;
    buys: number;
    sells: number;
    total_pnl: number;
  }>;
}

// Lädt Trade-Statistiken (Käufe/Verkäufe pro Strategie und Coin, Performance)
export const getTradeStats = async (): Promise<TradeStats> => {
  try {
    const response = await api.get('/api/trades/stats');
    return response.data;
  } catch (error) {
    console.error('Fehler beim Laden der Trade-Statistiken:', error);
    return { by_strategy: [], by_coin: [] };
  }
};

export const getPositions = async (): Promise<Position[]> => {
  try {
    const response = await api.get('/api/positions');
    const positions = response.data.positions || [];
    // Sicherstellen, dass alle Werte definiert sind
    return positions.map((pos: any) => ({
      symbol: pos.symbol || '',
      quantity: pos.quantity || 0,
      entryPrice: pos.entryPrice || 0,
      currentPrice: pos.currentPrice || 0,
      pnl: pos.pnl || 0,
      pnlPercent: pos.pnlPercent || 0,
      // Fehlende Felder hinzufügen:
      id: pos.id,
      strategyId: pos.strategyId,
      strategyName: pos.strategyName,
      createdAt: pos.createdAt,
      // Verkaufsinformationen hinzufügen:
      maShort: pos.maShort ?? null,
      maLong: pos.maLong ?? null,
      maCrossSellPrice: pos.maCrossSellPrice ?? null,
      stopLossPrice: pos.stopLossPrice ?? null,
      takeProfitPrice: pos.takeProfitPrice ?? null,
      trailingStopPrice: pos.trailingStopPrice ?? null,
      useTrailingStop: pos.useTrailingStop ?? false,
      // Cooldown Information
      tradeCooldownMs: pos.tradeCooldownMs ?? 0,
      cooldownRemainingMs: pos.cooldownRemainingMs ?? 0,
      cooldownRemainingSeconds: pos.cooldownRemainingSeconds ?? 0,
      cooldownRemainingMinutes: pos.cooldownRemainingMinutes ?? 0,
      lastTradeTime: pos.lastTradeTime ?? null,
    }));
  } catch (error) {
    console.error('Fehler beim Laden der Positionen:', error);
    return [];
  }
};

// Strategies (Basis-Strategien OHNE Coin-Zuordnung)
export const getStrategies = async (): Promise<Strategy[]> => {
  try {
    const response = await api.get('/api/strategies');
    const strategies = response.data.strategies || [];
    return strategies.map((strategy: any) => ({
      ...strategy,
      config: {
        type: strategy.config?.type,
        timeframe: strategy.config?.timeframe,
        indicators: strategy.config?.indicators || {}
      }
    }));
  } catch (error) {
    console.error('Fehler beim Laden der Strategien:', error);
    return [];
  }
};

export const createStrategy = async (
  strategy: {
    name: string;
    description?: string;
    config?: {
      type?: string;
      timeframe?: string;
      indicators?: {
        ma_short?: number;
        ma_long?: number;
      };
    };
  }
): Promise<Strategy> => {
  const response = await api.post('/api/strategies', strategy);
  return response.data.strategy;
};

export const updateStrategy = async (
  id: string,
  updates: Partial<Strategy> | { config: Partial<Strategy['config']> }
): Promise<Strategy> => {
  const response = await api.put(`/api/strategies/${id}`, updates);
  return response.data.strategy;
};

// Coin-Strategien (Coins mit zugewiesenen Strategien)
export const getCoins = async (): Promise<CoinStrategy[]> => {
  try {
    const response = await api.get('/api/coins');
    return response.data.coins || [];
  } catch (error) {
    console.error('Fehler beim Laden der Coins:', error);
    return [];
  }
};

export const createCoin = async (
  coin: {
    symbol: string;
    strategy_id?: string | null;
    active?: boolean;
    config?: {
      settings?: {
        signal_threshold_percent?: number;
        signal_cooldown_ms?: number;
        trade_cooldown_ms?: number;
      };
      risk?: {
        max_trade_size_usdt?: number;
        stop_loss_percent?: number;
        take_profit_percent?: number;
        use_trailing_stop?: boolean;
        trailing_stop_activation_threshold?: number;
      };
    };
  }
): Promise<CoinStrategy> => {
  const response = await api.put(`/api/coins/${coin.symbol}`, {
    strategy_id: coin.strategy_id || null,
    active: coin.active !== undefined ? coin.active : false,
    config: coin.config
  });
  return response.data.coin;
};

export const updateCoinStrategy = async (
  symbol: string,
  updates: {
    strategy_id?: string | null;
    active?: boolean;
    config?: {
      settings?: Partial<CoinStrategy['config']['settings']>;
      risk?: Partial<CoinStrategy['config']['risk']>;
    };
  }
): Promise<CoinStrategy> => {
  const response = await api.put(`/api/coins/${symbol}`, updates);
  return response.data.coin;
};

export const toggleCoin = async (
  symbol: string,
  active: boolean
): Promise<CoinStrategy> => {
  const response = await api.patch(`/api/coins/${symbol}/toggle`, { active });
  return response.data.coin;
};

// Bot Settings
export interface BotSettings {
  [key: string]: any;
}

export const getBotSettings = async (): Promise<BotSettings> => {
  try {
    const response = await api.get('/api/bot-settings');
    return response.data.settings || {};
  } catch (error) {
    console.error('Fehler beim Laden der Bot-Einstellungen:', error);
    return {};
  }
};

export const updateBotSettings = async (
  settings: Partial<BotSettings>
): Promise<void> => {
  await api.put('/api/bot-settings', { settings });
};

/**
 * Lädt das Testnet-Guthaben von Binance
 * @returns TestnetBalance mit allen Guthaben und USDT-Informationen
 */
export const getTestnetBalance = async (): Promise<TestnetBalance> => {
  try {
    const response = await api.get('/api/testnet-balance');
    return response.data;
  } catch (error) {
    console.error('Fehler beim Laden des Testnet-Guthabens:', error);
    return {
      success: false,
      balances: [],
      usdt: null,
      testnet: true,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Führt einen direkten Verkauf aus dem Wallet aus
 * @param asset Das zu verkaufende Asset (z.B. 'BTC', 'DOGE')
 * @param quantity Die zu verkaufende Menge
 * @param symbol Das Trading-Paar (z.B. 'BTCUSDT', 'DOGEUSDT')
 */
export const sellAsset = async (
  asset: string,
  quantity: number,
  symbol: string
): Promise<{ success: boolean; order?: any; trade?: Trade; error?: string }> => {
  try {
    const response = await api.post('/api/sell', {
      asset,
      quantity,
      symbol
    });
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Verkauf:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Unbekannter Fehler beim Verkauf'
    };
  }
};

/**
 * Lädt Binance Rate Limits aus der Datenbank
 * @returns Rate Limits mit Timestamp
 */
export const getRateLimits = async (): Promise<{
  success: boolean;
  rateLimits: Array<{
    id: number;
    rate_limit_type: string;
    interval: string;
    interval_num: number;
    limit_value: number;
    last_updated_at: string;
  }>;
  count: number;
  lastUpdated: string | null;
}> => {
  try {
    const response = await api.get('/api/rate-limits');
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Laden der Rate Limits:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Fehler beim Laden der Rate Limits'
    );
  }
};

/**
 * Lädt Exchange-Informationen aus der Datenbank
 * @param symbols Optional: Array von Symbolen (z.B. ['BTCUSDT', 'ETHUSDT'])
 * @returns Exchange-Info für die angegebenen oder alle Coins
 */
export const getExchangeInfo = async (symbols?: string[]): Promise<{
  success: boolean;
  exchangeInfo: any[];
  count: number;
  lastUpdated: string | null;
}> => {
  try {
    const params = symbols ? `?symbols=${symbols.join(',')}` : '';
    const response = await api.get(`/api/exchange-info${params}`);
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Laden der Exchange-Info:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Fehler beim Laden der Exchange-Informationen'
    );
  }
};

/**
 * Synchronisiert Exchange-Informationen mit Binance API
 * @param symbols Optional: Array von Symbolen (sonst alle Coins)
 * @returns Sync-Ergebnis mit Statistiken
 */
export const syncExchangeInfo = async (symbols?: string[]): Promise<{
  success: boolean;
  message: string;
  synced: number;
  errors?: Array<{ symbol: string; error: string }>;
  timestamp: string;
}> => {
  try {
    const response = await api.post('/api/exchange-info/sync', { symbols });
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Synchronisieren der Exchange-Info:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Fehler beim Synchronisieren der Exchange-Informationen'
    );
  }
};

/**
 * Lädt Alerts aus der Datenbank
 * @param options Filter-Optionen
 * @returns Alerts mit Zählern
 */
export const getAlerts = async (options?: {
  acknowledged?: boolean;
  severity?: 'critical' | 'warning' | 'info';
  symbol?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  alerts: Array<{
    id: string;
    symbol: string;
    alert_type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    details: any;
    is_acknowledged: boolean;
    acknowledged_at: string | null;
    created_at: string;
  }>;
  count: number;
  unacknowledgedCount: number;
}> => {
  try {
    const params = new URLSearchParams();
    if (options?.acknowledged !== undefined) {
      params.append('acknowledged', String(options.acknowledged));
    }
    if (options?.severity) {
      params.append('severity', options.severity);
    }
    if (options?.symbol) {
      params.append('symbol', options.symbol);
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    
    const response = await api.get(`/api/alerts?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Laden der Alerts:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Fehler beim Laden der Alerts'
    );
  }
};

/**
 * Bestätigt einen Alert
 * @param alertId Alert-ID
 * @returns Aktualisierter Alert
 */
export const acknowledgeAlert = async (alertId: string): Promise<{
  success: boolean;
  message: string;
  alert: any;
}> => {
  try {
    const response = await api.patch(`/api/alerts/${alertId}/acknowledge`);
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Bestätigen des Alerts:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Fehler beim Bestätigen des Alerts'
    );
  }
};

/**
 * Bestätigt alle Alerts (optional gefiltert)
 * @param options Filter-Optionen
 * @returns Anzahl der bestätigten Alerts
 */
export const acknowledgeAllAlerts = async (options?: {
  symbol?: string;
  severity?: 'critical' | 'warning' | 'info';
}): Promise<{
  success: boolean;
  message: string;
  count: number;
}> => {
  try {
    const response = await api.post('/api/alerts/acknowledge-all', options || {});
    return response.data;
  } catch (error: any) {
    console.error('Fehler beim Bestätigen der Alerts:', error);
    throw new Error(
      error.response?.data?.message || 
      error.message || 
      'Fehler beim Bestätigen aller Alerts'
    );
  }
};

