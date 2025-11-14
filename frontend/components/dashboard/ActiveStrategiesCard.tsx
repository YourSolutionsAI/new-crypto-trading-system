'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Brain, CheckCircle, XCircle } from 'lucide-react';

export function ActiveStrategiesCard() {
  const { strategies, setStrategies } = useTradingStore();

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await api.getStrategies();
      setStrategies(data);
    } catch (error) {
      console.error('Error loading strategies:', error);
    }
  };

  const activeStrategies = strategies.filter(s => s.is_active);
  const totalStrategies = strategies.length;

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5" />
        Aktive Strategien
      </h2>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Aktiv / Gesamt</span>
          <span className="text-2xl font-bold">
            {activeStrategies.length} / {totalStrategies}
          </span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg",
                strategy.is_active ? "bg-green-500/10" : "bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2">
                {strategy.is_active ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">{strategy.symbol.replace('USDT', '')}</p>
                  <p className="text-xs text-muted-foreground">{strategy.name}</p>
                </div>
              </div>
              {strategy.is_active && strategy.total_trades !== undefined && (
                <div className="text-right">
                  <p className="text-sm font-medium">{strategy.total_trades} Trades</p>
                  {strategy.win_rate !== undefined && (
                    <p className={cn(
                      "text-xs",
                      strategy.win_rate >= 50 ? "text-green-500" : "text-orange-500"
                    )}>
                      {strategy.win_rate.toFixed(1)}% Win
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {activeStrategies.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Keine aktiven Strategien
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
