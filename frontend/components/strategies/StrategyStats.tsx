'use client';

import { Strategy } from '@/lib/types';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { BarChart3, TrendingUp, Activity, DollarSign } from 'lucide-react';

interface StrategyStatsProps {
  strategies: Strategy[];
}

export function StrategyStats({ strategies }: StrategyStatsProps) {
  const activeStrategies = strategies.filter(s => s.is_active);
  const totalTrades = strategies.reduce((sum, s) => sum + (s.total_trades || 0), 0);
  const totalPnL = strategies.reduce((sum, s) => sum + (s.total_pnl || 0), 0);
  const avgWinRate = strategies.length > 0
    ? strategies.reduce((sum, s) => sum + (s.win_rate || 0), 0) / strategies.length
    : 0;

  const bestStrategy = strategies.reduce((best, current) => {
    const currentPnL = current.total_pnl || -Infinity;
    const bestPnL = best?.total_pnl || -Infinity;
    return currentPnL > bestPnL ? current : best;
  }, strategies[0]);

  const worstStrategy = strategies.reduce((worst, current) => {
    const currentPnL = current.total_pnl || Infinity;
    const worstPnL = worst?.total_pnl || Infinity;
    return currentPnL < worstPnL ? current : worst;
  }, strategies[0]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active Strategies */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <span className="text-2xl font-bold">
            {activeStrategies.length}/{strategies.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Aktive Strategien</p>
      </div>

      {/* Total Trades */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span className="text-2xl font-bold">{totalTrades}</span>
        </div>
        <p className="text-sm text-muted-foreground">Gesamt Trades</p>
      </div>

      {/* Total PnL */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <span className={cn(
            "text-2xl font-bold",
            totalPnL >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {formatCurrency(totalPnL)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Gesamt PnL</p>
      </div>

      {/* Average Win Rate */}
      <div className="bg-card p-6 rounded-xl border border-border">
        <div className="flex items-center justify-between mb-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <span className={cn(
            "text-2xl font-bold",
            avgWinRate >= 50 ? "text-green-500" : "text-orange-500"
          )}>
            {avgWinRate.toFixed(1)}%
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Durchschn. Win Rate</p>
      </div>

      {/* Best and Worst Performers */}
      {bestStrategy && worstStrategy && (totalTrades > 0) && (
        <>
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl col-span-1 md:col-span-2">
            <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
              Beste Performance
            </h3>
            <p className="text-xl font-bold">{bestStrategy.symbol.replace('USDT', '')}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(bestStrategy.total_pnl || 0)} PnL • 
              {bestStrategy.win_rate?.toFixed(1)}% Win Rate
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl col-span-1 md:col-span-2">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
              Schwächste Performance
            </h3>
            <p className="text-xl font-bold">{worstStrategy.symbol.replace('USDT', '')}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(worstStrategy.total_pnl || 0)} PnL • 
              {worstStrategy.win_rate?.toFixed(1)}% Win Rate
            </p>
          </div>
        </>
      )}
    </div>
  );
}
