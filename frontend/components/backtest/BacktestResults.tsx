'use client';

import { BacktestResult } from '@/lib/types';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity,
  DollarSign,
  BarChart3,
  AlertTriangle,
  Award
} from 'lucide-react';

interface BacktestResultsProps {
  result: BacktestResult;
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueColor?: string;
  subValue?: string;
}

function MetricCard({ icon, label, value, valueColor = '', subValue }: MetricCardProps) {
  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-lg bg-muted/50">
          {icon}
        </div>
        <span className={cn("text-2xl font-bold", valueColor)}>
          {value}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      )}
    </div>
  );
}

export function BacktestResults({ result }: BacktestResultsProps) {
  const { metrics } = result;
  const profitColor = metrics.totalPnL >= 0 ? 'text-green-500' : 'text-red-500';
  const winRateColor = metrics.winRate >= 50 ? 'text-green-500' : 'text-orange-500';

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Backtesting Ergebnisse</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{result.symbol}</span>
            <span>•</span>
            <span>{new Date(result.period.start).toLocaleDateString('de-DE')} - {new Date(result.period.end).toLocaleDateString('de-DE')}</span>
          </div>
        </div>

        {/* Strategy Info */}
        <div className="mb-4 p-3 rounded-lg bg-muted/30">
          <p className="text-sm">
            <span className="font-medium">{result.strategy.name}</span> - 
            MA {result.strategy.config.ma_short}/{result.strategy.config.ma_long} • 
            {result.strategy.config.trade_size_usdt} USDT pro Trade
          </p>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<DollarSign className="h-5 w-5" />}
            label="Gesamt PnL"
            value={formatCurrency(metrics.totalPnL)}
            valueColor={profitColor}
            subValue={`Return: ${formatPercent(metrics.totalReturn)}`}
          />
          
          <MetricCard
            icon={<Target className="h-5 w-5" />}
            label="Win Rate"
            value={`${metrics.winRate.toFixed(1)}%`}
            valueColor={winRateColor}
            subValue={`${metrics.winCount} / ${metrics.totalTrades} Trades`}
          />
          
          <MetricCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Profit Factor"
            value={metrics.profitFactor.toFixed(2)}
            valueColor={metrics.profitFactor >= 1.5 ? 'text-green-500' : 'text-orange-500'}
            subValue="Avg Win / Avg Loss"
          />
          
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Max Drawdown"
            value={formatPercent(metrics.maxDrawdown)}
            valueColor="text-orange-500"
            subValue="Maximaler Verlust"
          />
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trade Statistics */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Trade Statistiken
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gesamt Trades:</span>
              <span className="font-medium">{metrics.totalTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gewinn-Trades:</span>
              <span className="font-medium text-green-500">{metrics.winCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verlust-Trades:</span>
              <span className="font-medium text-red-500">{metrics.lossCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg. Trade Dauer:</span>
              <span className="font-medium">
                {(() => {
                  const avgDuration = result.trades.reduce((sum, trade) => {
                    const duration = new Date(trade.exitTime).getTime() - new Date(trade.entryTime).getTime();
                    return sum + duration;
                  }, 0) / result.trades.length;
                  const hours = Math.floor(avgDuration / (1000 * 60 * 60));
                  const minutes = Math.floor((avgDuration % (1000 * 60 * 60)) / (1000 * 60));
                  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Profit/Loss Analysis */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Award className="h-4 w-4" />
            Gewinn/Verlust Analyse
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durchschn. Gewinn:</span>
              <span className="font-medium text-green-500">
                {formatCurrency(metrics.avgWin)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durchschn. Verlust:</span>
              <span className="font-medium text-red-500">
                {formatCurrency(metrics.avgLoss)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Größter Gewinn:</span>
              <span className="font-medium text-green-500">
                {formatCurrency(Math.max(...result.trades.map(t => t.pnl)))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Größter Verlust:</span>
              <span className="font-medium text-red-500">
                {formatCurrency(Math.min(...result.trades.map(t => t.pnl)))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
