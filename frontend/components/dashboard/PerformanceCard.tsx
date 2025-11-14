'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { TrendingUp, DollarSign, Target, Award } from 'lucide-react';

interface MetricProps {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: string;
}

function Metric({ label, value, change, icon, color = "text-foreground" }: MetricProps) {
  return (
    <div className="flex items-start space-x-3">
      <div className={cn("p-2 rounded-lg bg-muted/50", color)}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-bold", color)}>{value}</p>
        {change !== undefined && (
          <p className={cn(
            "text-sm",
            change >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {formatPercent(change)} heute
          </p>
        )}
      </div>
    </div>
  );
}

export function PerformanceCard() {
  const { performance, setPerformance } = useTradingStore();

  useEffect(() => {
    loadPerformance();
    const interval = setInterval(loadPerformance, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPerformance = async () => {
    try {
      const data = await api.getPerformance();
      setPerformance(data);
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  };

  const totalPnL = performance?.totalPnL || 0;
  const todayPnL = performance?.todayPnL || 0;
  const winRate = performance?.winRate || 0;
  const totalTrades = performance?.totalTrades || 0;

  const pnlColor = totalPnL >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm col-span-1 lg:col-span-2">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5" />
        Performance Übersicht
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Metric
          label="Gesamt PnL"
          value={formatCurrency(totalPnL)}
          change={todayPnL > 0 ? (todayPnL / Math.abs(totalPnL - todayPnL)) * 100 : 0}
          icon={<DollarSign className="h-5 w-5" />}
          color={pnlColor}
        />
        
        <Metric
          label="Heutiger PnL"
          value={formatCurrency(todayPnL)}
          icon={<TrendingUp className="h-5 w-5" />}
          color={todayPnL >= 0 ? "text-green-500" : "text-red-500"}
        />
        
        <Metric
          label="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          icon={<Target className="h-5 w-5" />}
          color={winRate >= 50 ? "text-green-500" : "text-orange-500"}
        />
        
        <Metric
          label="Trades Gesamt"
          value={totalTrades}
          icon={<Award className="h-5 w-5" />}
        />
      </div>

      {performance && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Avg. Gewinn</p>
              <p className="font-medium text-green-500">
                {formatCurrency(performance.avgWin || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Verlust</p>
              <p className="font-medium text-red-500">
                {formatCurrency(performance.avgLoss || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profit Faktor</p>
              <p className="font-medium">
                {(performance.profitFactor || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max Drawdown</p>
              <p className="font-medium text-orange-500">
                {formatPercent(performance.maxDrawdown || 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
