'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BacktestForm } from '@/components/backtest/BacktestForm';
import { BacktestResults } from '@/components/backtest/BacktestResults';
import { useState } from 'react';
import { BacktestResult } from '@/lib/types';
import { motion } from 'framer-motion';
import { ChartBar, Zap } from 'lucide-react';

export default function BacktestPage() {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleBacktestComplete = (result: BacktestResult) => {
    setBacktestResult(result);
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ChartBar className="h-8 w-8" />
            Backtesting
          </h1>
          <p className="text-muted-foreground mt-1">
            Testen Sie Ihre Strategien mit historischen Daten
          </p>
        </div>

        {/* Backtest Form */}
        <BacktestForm 
          onBacktestComplete={handleBacktestComplete}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />

        {/* Results */}
        {backtestResult && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Performance Metrics */}
            <BacktestResults result={backtestResult} />

            {/* Charts */}
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Visualisierung
              </h2>
              <p className="text-muted-foreground">Chart-Visualisierung wird später implementiert</p>
            </div>

            {/* Trade Details */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-semibold">
                  Trade-Details ({backtestResult.trades.length} Trades)
                </h2>
              </div>
              
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">Entry</th>
                      <th className="text-left p-4 font-medium text-sm">Exit</th>
                      <th className="text-left p-4 font-medium text-sm">Seite</th>
                      <th className="text-right p-4 font-medium text-sm">Entry Preis</th>
                      <th className="text-right p-4 font-medium text-sm">Exit Preis</th>
                      <th className="text-right p-4 font-medium text-sm">PnL</th>
                      <th className="text-right p-4 font-medium text-sm">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {backtestResult.trades.map((trade, index) => (
                      <tr key={index} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-sm">
                          {new Date(trade.entryTime).toLocaleString('de-DE')}
                        </td>
                        <td className="p-4 text-sm">
                          {new Date(trade.exitTime).toLocaleString('de-DE')}
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${trade.side === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          ${trade.entryPrice.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-sm">
                          ${trade.exitPrice.toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-semibold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-medium ${trade.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {trade.return >= 0 ? '+' : ''}{trade.return.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card p-12 rounded-xl border border-border shadow-sm text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Führe Backtesting durch...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Dies kann einen Moment dauern
            </p>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
