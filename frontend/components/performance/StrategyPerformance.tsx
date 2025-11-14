// Strategy Performance Component

'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { StrategyPerformance } from '@/types/api';

export function StrategyPerformanceTable() {
  const [performance, setPerformance] = useState<StrategyPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPerformance();
    
    // Reload alle 60 Sekunden
    const interval = setInterval(loadPerformance, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadPerformance = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getStrategyPerformance();
      setPerformance(response.performance);
    } catch (error) {
      console.error('Fehler beim Laden der Performance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title="Strategie-Performance">
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Lade Performance-Daten...
          </p>
        </div>
      ) : performance.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Keine Performance-Daten verfügbar
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Strategie
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Trades
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Win Rate
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Total PnL
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Return
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {performance.map((perf) => (
                <tr key={perf.strategyId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {perf.strategyName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {perf.symbol}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    {perf.totalTrades}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant={
                        perf.winRate >= 50 ? 'success' : perf.winRate >= 40 ? 'warning' : 'danger'
                      }
                    >
                      {perf.winRate.toFixed(1)}%
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <span
                      className={
                        perf.totalPnl >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {perf.totalPnl >= 0 ? '+' : ''}
                      {perf.totalPnl.toFixed(2)} USDT
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <span
                      className={
                        perf.returnPercent >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {perf.returnPercent >= 0 ? '+' : ''}
                      {perf.returnPercent.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

