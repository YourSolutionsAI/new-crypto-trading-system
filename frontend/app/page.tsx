'use client';

import { useEffect, useState } from 'react';
import { getBotStatus, getPositions, getTrades, getStrategies } from '@/lib/api';
import type { BotStatus, Position, Trade, Strategy } from '@/lib/types';
import Link from 'next/link';
import { format } from 'date-fns';

export default function Dashboard() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [activeStrategies, setActiveStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Alle 5 Sekunden aktualisieren
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [status, pos, tradesResult, strategies] = await Promise.all([
        getBotStatus().catch(() => ({ status: 'stopped' as const, timestamp: new Date().toISOString() })),
        getPositions().catch(() => []),
        getTrades(10).catch(() => ({ trades: [], total: 0, limit: 10, offset: 0 })),
        getStrategies().catch(() => []),
      ]);
      setBotStatus(status);
      setPositions(pos);
      setRecentTrades(tradesResult.trades);
      // Filtere nur aktive Strategien
      setActiveStrategies(strategies.filter(s => s.is_active));
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Daten...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Übersicht über den Trading-Bot Status
        </p>
      </div>

      {/* Bot Status */}
      <div className="mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  className={`h-8 w-8 rounded-full ${
                    botStatus?.status === 'running'
                      ? 'bg-green-400'
                      : 'bg-gray-400'
                  }`}
                />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Bot Status
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {botStatus?.status === 'running' || botStatus?.status === 'läuft' ? '🟢 Läuft' : '🔴 Gestoppt'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aktive Strategien */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Aktive Strategien ({activeStrategies.length})
          </h2>
          <Link
            href="/strategies"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Alle anzeigen →
          </Link>
        </div>
        {activeStrategies.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            Keine aktiven Strategien
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {activeStrategies.map((strategy) => (
                <li key={strategy.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">
                          {strategy.name}
                        </p>
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {strategy.symbol}
                        </span>
                      </div>
                      {strategy.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {strategy.description}
                        </p>
                      )}
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        <span>Trades: {strategy.total_trades || 0}</span>
                        <span>Win Rate: {(strategy.win_rate || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="ml-6 text-right">
                      <p
                        className={`text-sm font-medium ${
                          (strategy.total_pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(strategy.total_pnl || 0) >= 0 ? '+' : ''}
                        {(strategy.total_pnl || 0).toFixed(2)} USDT
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Total PnL</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Offene Positionen */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Offene Positionen ({positions.length})
          </h2>
          <Link
            href="/trades"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Alle anzeigen →
          </Link>
        </div>
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
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {position.symbol}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(position.quantity ?? 0).toFixed(8)} @{' '}
                        {(position.entryPrice ?? 0).toFixed(8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-medium ${
                          (position.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(position.pnl || 0) >= 0 ? '+' : ''}
                        {(position.pnl || 0).toFixed(2)} USDT
                      </p>
                      <p
                        className={`text-sm ${
                          (position.pnlPercent || 0) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {(position.pnlPercent || 0) >= 0 ? '+' : ''}
                        {(position.pnlPercent || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Letzte Trades */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Letzte Trades ({recentTrades.length})
          </h2>
          <Link
            href="/trades"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Alle anzeigen →
          </Link>
        </div>
        {recentTrades.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            Keine Trades vorhanden
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {recentTrades.map((trade) => (
                <li key={trade.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            trade.side.toUpperCase() === 'BUY'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {trade.side.toUpperCase()}
                        </span>
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          {trade.symbol}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {format(
                          new Date(trade.created_at),
                          "dd.MM.yyyy HH:mm:ss"
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {(trade.quantity || 0).toFixed(8)} @ {(trade.price || 0).toFixed(8)}
                      </p>
                      {trade.pnl !== undefined && trade.pnl !== null && (
                        <p
                          className={`text-sm font-medium ${
                            trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {trade.pnl >= 0 ? '+' : ''}
                          {(trade.pnl ?? 0).toFixed(2)} USDT
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
