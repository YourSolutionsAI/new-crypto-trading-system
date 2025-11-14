// API Client für Backend-Integration

import axios from 'axios';
import type { BotStatus, Trade, Position, Strategy } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  const response = await api.get('/api/trades', {
    params: { limit, offset },
  });
  return response.data.trades || [];
};

export const getPositions = async (): Promise<Position[]> => {
  const response = await api.get('/api/positions');
  return response.data.positions || [];
};

// Strategies
export const getStrategies = async (): Promise<Strategy[]> => {
  const response = await api.get('/api/strategies');
  return response.data.strategies || [];
};

export const updateStrategy = async (
  id: string,
  updates: Partial<Strategy>
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

