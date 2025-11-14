// Zustand Store für Bot-Status und globale State-Verwaltung

import { create } from 'zustand';
import type { BotStatus, Strategy, Trade, LivePrice } from '@/types/api';

interface BotStore {
  // Bot Status
  botStatus: BotStatus | null;
  isLoading: boolean;
  error: string | null;

  // Data
  strategies: Strategy[];
  trades: Trade[];
  livePrices: Map<string, LivePrice>;
  openPositions: Map<string, any>;

  // Actions
  setBotStatus: (status: BotStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStrategies: (strategies: Strategy[]) => void;
  setTrades: (trades: Trade[]) => void;
  updateLivePrice: (symbol: string, price: LivePrice) => void;
  setOpenPositions: (positions: Map<string, any>) => void;
}

export const useBotStore = create<BotStore>((set) => ({
  // Initial State
  botStatus: null,
  isLoading: false,
  error: null,
  strategies: [],
  trades: [],
  livePrices: new Map(),
  openPositions: new Map(),

  // Actions
  setBotStatus: (status) => set({ botStatus: status }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setStrategies: (strategies) => set({ strategies }),
  setTrades: (trades) => set({ trades }),
  updateLivePrice: (symbol, price) =>
    set((state) => {
      const newPrices = new Map(state.livePrices);
      newPrices.set(symbol, price);
      return { livePrices: newPrices };
    }),
  setOpenPositions: (positions) => set({ openPositions: positions }),
}));

