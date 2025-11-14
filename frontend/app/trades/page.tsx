'use client';

import { useEffect, useState } from 'react';
import { getTrades, getPositions } from '@/lib/api';
import type { Trade, Position } from '@/lib/types';
import { format } from 'date-fns';

// Helper function to check if trade is a buy
const isBuy = (side: string): boolean => {
  return side.toUpperCase() === 'BUY';
};

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(50);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Alle 5 Sekunden aktualisieren
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [tradesData, positionsData] = await Promise.all([
        getTrades(limit).catch(() => []),
        getPositions().catch(() => []),
      ]);
      setTrades(tradesData);
      setPositions(positionsData);
    } catch (error) {
      console.error('Fehler beim Laden der Trades:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Trades...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Trades</h1>
        <p className="mt-1 text-sm text-gray-500">
          Übersicht über alle Trades und offene Positionen
        </p>
      </div>

      {/* Offene Positionen */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Offene Positionen ({positions.length})
        </h2>
        {positions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            Keine offenen Positionen
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {positions.map((position) => (
                <li key={position.symbol} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-lg font-medium text-gray-900">
                        {position.symbol}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Menge:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {position.quantity.toFixed(8)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Einstiegspreis:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {position.entryPrice.toFixed(8)} USDT
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Aktueller Preis:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {position.currentPrice.toFixed(8)} USDT
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 text-right">
                      <p
                        className={`text-2xl font-bold ${
                          position.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {position.pnl >= 0 ? '+' : ''}
                        {position.pnl.toFixed(2)} USDT
                      </p>
                      <p
                        className={`text-lg font-medium mt-1 ${
                          position.pnlPercent >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {position.pnlPercent >= 0 ? '+' : ''}
                        {position.pnlPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Trade-Historie */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Trade-Historie ({trades.length})
        </h2>
        {trades.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            Keine Trades vorhanden
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zeit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Typ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Menge
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gesamt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PnL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trades.map((trade) => (
                    <tr key={trade.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(
                          new Date(trade.created_at),
                          "dd.MM.yyyy HH:mm:ss"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {trade.symbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isBuy(trade.side)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {trade.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.price.toFixed(8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {trade.quantity.toFixed(8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {((trade as any).total ? (trade as any).total.toFixed(2) : (trade.price * trade.quantity).toFixed(2))} USDT
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {trade.pnl !== undefined ? (
                          <span
                            className={`font-medium ${
                              trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {trade.pnl >= 0 ? '+' : ''}
                            {trade.pnl.toFixed(2)} USDT
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trade.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

