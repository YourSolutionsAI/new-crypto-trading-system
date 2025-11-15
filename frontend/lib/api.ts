// API Client für Backend-Integration

import axios from 'axios';
import type { BotStatus, Trade, Position, Strategy, TestnetBalance } from './types';

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
    }));
  } catch (error) {
    console.error('Fehler beim Laden der Positionen:', error);
    return [];
  }
};

// Strategies
export const getStrategies = async (): Promise<Strategy[]> => {
  try {
    const response = await api.get('/api/strategies');
    console.log('📊 API Response:', response.data);
    const strategies = response.data.strategies || [];
    console.log('📊 Strategien geladen:', strategies.length);
    
    // Sicherstellen, dass alle Werte definiert sind
    const normalizedStrategies = strategies.map((strategy: any) => {
      // Normalisiere is_active: PostgreSQL gibt 'active' zurück, aber wir brauchen 'is_active'
      const isActive = strategy.is_active !== undefined 
        ? strategy.is_active 
        : (strategy.active !== undefined ? strategy.active : false);
      
      console.log(`📊 Strategie ${strategy.name}: active=${strategy.active}, is_active=${strategy.is_active}, normalized=${isActive}`);
      
      return {
        ...strategy,
        is_active: isActive, // Sicherstellen, dass is_active gesetzt ist
        win_rate: strategy.win_rate ?? 0,
        total_pnl: strategy.total_pnl ?? 0,
        total_trades: strategy.total_trades ?? 0,
        profitable_trades: strategy.profitable_trades ?? 0,
        config: {
          ...strategy.config,
          // Die API gibt jetzt bereits normalisierte Werte zurück
          ma_short: strategy.config?.ma_short ?? strategy.config?.indicators?.ma_short,
          ma_long: strategy.config?.ma_long ?? strategy.config?.indicators?.ma_long,
          trade_size_usdt: strategy.config?.trade_size_usdt ?? strategy.config?.risk?.max_trade_size_usdt,
          settings: strategy.config?.settings ? {
            signal_threshold_percent: strategy.config.settings.signal_threshold_percent ?? undefined,
            signal_cooldown_ms: strategy.config.settings.signal_cooldown_ms ?? undefined,
            trade_cooldown_ms: strategy.config.settings.trade_cooldown_ms ?? undefined,
          } : undefined,
          risk: strategy.config?.risk ? {
            max_trade_size_usdt: strategy.config.risk.max_trade_size_usdt ?? undefined,
            stop_loss_percent: strategy.config.risk.stop_loss_percent ?? undefined,
            take_profit_percent: strategy.config.risk.take_profit_percent ?? undefined,
          } : undefined,
        },
      };
    });
    
    console.log('📊 Normalisierte Strategien:', normalizedStrategies);
    return normalizedStrategies;
  } catch (error) {
    console.error('Fehler beim Laden der Strategien:', error);
    return [];
  }
};

export const updateStrategy = async (
  id: string,
  updates: Partial<Strategy> | { config: Partial<Strategy['config']> }
): Promise<Strategy> => {
  const response = await api.put(`/api/strategies/${id}`, updates);
  return response.data.strategy;
};

export const toggleStrategy = async (
  id: string,
  isActive: boolean
): Promise<Strategy> => {
  const response = await api.patch(`/api/strategies/${id}/toggle`, {
    is_active: isActive,
  });
  return response.data.strategy;
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

