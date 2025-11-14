// API Client für Backend-Integration

import axios from 'axios';
import type { BotStatus, Trade, Position, Strategy } from './types';

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
  const response = await api.get('/api/status');
  return response.data;
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
export const getTrades = async (limit = 50, offset = 0): Promise<Trade[]> => {
  try {
    const response = await api.get('/api/trades', {
      params: { limit, offset },
    });
    const trades = response.data.trades || [];
    // Sicherstellen, dass alle Werte definiert sind
    return trades.map((trade: any) => ({
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
  } catch (error) {
    console.error('Fehler beim Laden der Trades:', error);
    return [];
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
  const response = await api.get('/api/strategies');
  return response.data.strategies || [];
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

