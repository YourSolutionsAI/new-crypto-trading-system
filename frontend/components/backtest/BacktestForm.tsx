'use client';

import { useState, useEffect } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { BacktestResult } from '@/lib/types';
import { Calendar, Zap, Settings, Play } from 'lucide-react';
import toast from 'react-hot-toast';

interface BacktestFormProps {
  onBacktestComplete: (result: BacktestResult) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function BacktestForm({ onBacktestComplete, isLoading, setIsLoading }: BacktestFormProps) {
  const { strategies } = useTradingStore();
  const [formData, setFormData] = useState({
    strategyId: '',
    symbol: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // today
    timeframe: '1h' as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
  });

  useEffect(() => {
    if (strategies.length > 0 && !formData.strategyId) {
      const firstStrategy = strategies[0];
      setFormData(prev => ({
        ...prev,
        strategyId: firstStrategy.id,
        symbol: firstStrategy.symbol,
      }));
    }
  }, [strategies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.strategyId) {
      toast.error('Bitte wählen Sie eine Strategie aus');
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.runBacktest({
        strategyId: formData.strategyId,
        symbol: formData.symbol,
        startDate: formData.startDate,
        endDate: formData.endDate,
        timeframe: formData.timeframe,
      });
      
      onBacktestComplete(result);
      toast.success('Backtesting erfolgreich abgeschlossen');
    } catch (error) {
      console.error('Backtesting error:', error);
      toast.error('Fehler beim Backtesting');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedStrategy = strategies.find(s => s.id === formData.strategyId);

  return (
    <form onSubmit={handleSubmit} className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <Settings className="h-5 w-5" />
        Backtesting Konfiguration
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Strategy Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Strategie</label>
          <select
            value={formData.strategyId}
            onChange={(e) => {
              const strategy = strategies.find(s => s.id === e.target.value);
              setFormData({
                ...formData,
                strategyId: e.target.value,
                symbol: strategy?.symbol || formData.symbol,
              });
            }}
            className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
            disabled={isLoading}
          >
            <option value="">Strategie wählen...</option>
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.symbol.replace('USDT', '')} - {strategy.name}
              </option>
            ))}
          </select>
          {selectedStrategy && (
            <p className="text-xs text-muted-foreground mt-1">
              MA {selectedStrategy.config.ma_short}/{selectedStrategy.config.ma_long} • 
              {selectedStrategy.config.trade_size_usdt} USDT
            </p>
          )}
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Zeitraum
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none text-sm"
              disabled={isLoading}
            />
            <span className="self-center">-</span>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none text-sm"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Timeframe
          </label>
          <select
            value={formData.timeframe}
            onChange={(e) => setFormData({ ...formData, timeframe: e.target.value as any })}
            className="w-full px-4 py-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
            disabled={isLoading}
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minuten</option>
            <option value="15m">15 Minuten</option>
            <option value="1h">1 Stunde</option>
            <option value="4h">4 Stunden</option>
            <option value="1d">1 Tag</option>
          </select>
        </div>
      </div>

      {/* Strategy Details */}
      {selectedStrategy && (
        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
          <h3 className="text-sm font-semibold mb-3">Strategie-Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Threshold:</span>
              <span className="ml-2 font-medium">
                {selectedStrategy.config.settings?.signal_threshold_percent || 0.01}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Stop Loss:</span>
              <span className="ml-2 font-medium text-red-500">
                {selectedStrategy.config.risk?.stop_loss_percent || 2}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Take Profit:</span>
              <span className="ml-2 font-medium text-green-500">
                {selectedStrategy.config.risk?.take_profit_percent || 5}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Indikatoren:</span>
              <span className="ml-2 font-medium">
                {[
                  selectedStrategy.config.indicators?.use_rsi && 'RSI',
                  selectedStrategy.config.indicators?.use_macd && 'MACD',
                  selectedStrategy.config.indicators?.use_bollinger && 'BB',
                  selectedStrategy.config.indicators?.use_stochastic && 'Stoch',
                ].filter(Boolean).join(', ') || 'Keine'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isLoading || !formData.strategyId}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="h-4 w-4" />
          {isLoading ? 'Backtesting läuft...' : 'Backtesting starten'}
        </button>
      </div>
    </form>
  );
}
