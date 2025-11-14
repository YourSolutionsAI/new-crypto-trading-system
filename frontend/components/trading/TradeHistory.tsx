// Trade History Component

'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useState, useEffect } from 'react';
import { getTrades } from '@/lib/supabase';
import type { Trade } from '@/types/api';

export function TradeHistory() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrades();
    
    // Reload alle 30 Sekunden
    const interval = setInterval(loadTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTrades = async () => {
    try {
      setIsLoading(true);
      const data = await getTrades(50);
      setTrades(data as Trade[]);
    } catch (error) {
      console.error('Fehler beim Laden der Trades:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card title="Trade-Historie">
      {isLoading ? (
        <div className="py-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Lade Trades...
          </p>
        </div>
      ) : trades.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Keine Trades vorhanden
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Zeit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Symbol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Typ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Preis
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Menge
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(trade.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {trade.symbol}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={trade.side === 'buy' ? 'success' : 'danger'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    ${trade.price.toFixed(8)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    {trade.quantity.toFixed(8)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${trade.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge
                      variant={
                        trade.status === 'executed'
                          ? 'success'
                          : trade.status === 'failed'
                          ? 'danger'
                          : 'warning'
                      }
                    >
                      {trade.status}
                    </Badge>
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

