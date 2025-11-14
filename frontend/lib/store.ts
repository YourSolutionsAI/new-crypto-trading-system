import { create } from 'zustand';
import { BotStatus, Strategy, Trade, Position, MarketData, PerformanceData } from './types';

interface TradingStore {
  // Bot Status
  botStatus: BotStatus | null;
  setBotStatus: (status: BotStatus) => void;

  // Strategies
  strategies: Strategy[];
  setStrategies: (strategies: Strategy[]) => void;
  updateStrategy: (id: string, updates: Partial<Strategy>) => void;

  // Trading Data
  trades: Trade[];
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;

  positions: Position[];
  setPositions: (positions: Position[]) => void;
  updatePosition: (id: string, position: Position) => void;
  removePosition: (id: string) => void;

  // Market Data
  marketData: Record<string, MarketData>;
  updateMarketData: (symbol: string, data: Partial<MarketData>) => void;

  // Performance
  performance: PerformanceData | null;
  setPerformance: (performance: PerformanceData) => void;

  // UI State
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // WebSocket
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const useTradingStore = create<TradingStore>((set) => ({
  // Bot Status
  botStatus: null,
  setBotStatus: (status) => set({ botStatus: status }),

  // Strategies
  strategies: [],
  setStrategies: (strategies) => set({ strategies }),
  updateStrategy: (id, updates) =>
    set((state) => ({
      strategies: state.strategies.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  // Trading Data
  trades: [],
  setTrades: (trades) => set({ trades }),
  addTrade: (trade) =>
    set((state) => ({ trades: [trade, ...state.trades] })),

  positions: [],
  setPositions: (positions) => set({ positions }),
  updatePosition: (id, position) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? position : p
      ),
    })),
  removePosition: (id) =>
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
    })),

  // Market Data
  marketData: {},
  updateMarketData: (symbol, data) =>
    set((state) => ({
      marketData: {
        ...state.marketData,
        [symbol]: {
          ...state.marketData[symbol],
          ...data,
          symbol,
          timestamp: new Date().toISOString(),
        },
      },
    })),

  // Performance
  performance: null,
  setPerformance: (performance) => set({ performance }),

  // UI State
  theme: 'dark',
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // WebSocket
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
