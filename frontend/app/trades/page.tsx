'use client';

import { useEffect, useState } from 'react';
import { getTrades, getPositions, getTradeStats } from '@/lib/api';
import type { Trade, Position } from '@/lib/types';
import { format } from 'date-fns';

// Trade-Statistiken Typen
interface TradeStats {
  by_strategy: Array<{
    strategy_id: string;
    strategy_name: string;
    buys: number;
    sells: number;
    total_pnl: number;
  }>;
  by_coin: Array<{
    symbol: string;
    buys: number;
    sells: number;
    total_pnl: number;
  }>;
}

// Helper function to check if trade is a buy
const isBuy = (side: string): boolean => {
  return side.toUpperCase() === 'BUY';
};

const ITEMS_PER_PAGE = 50;

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<TradeStats>({ by_strategy: [], by_coin: [] });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTrades, setTotalTrades] = useState(0);

  const loadData = async () => {
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      const [tradesResult, positionsData, statsData] = await Promise.all([
        getTrades(ITEMS_PER_PAGE, offset).catch(() => ({ trades: [], total: 0, limit: ITEMS_PER_PAGE, offset: 0 })),
        getPositions().catch(() => []),
        getTradeStats().catch(() => ({ by_strategy: [], by_coin: [] })),
      ]);
      setTrades(tradesResult.trades);
      setTotalTrades(tradesResult.total);
      setPositions(positionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Fehler beim Laden der Trades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Alle 5 Sekunden aktualisieren
    return () => clearInterval(interval);
  }, [currentPage]); // currentPage als Dependency

  const totalPages = Math.ceil(totalTrades / ITEMS_PER_PAGE);

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

      {/* Statistiken */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statistiken pro Strategie */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Statistiken pro Strategie
          </h2>
          {stats.by_strategy.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              Keine Statistiken verfügbar
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Strategie
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Käufe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verkäufe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PnL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.by_strategy.map((stat: { strategy_id: string; strategy_name: string; buys: number; sells: number; total_pnl: number }) => (
                    <tr key={stat.strategy_id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.strategy_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {stat.buys}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {stat.sells}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            stat.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {stat.total_pnl >= 0 ? '+' : ''}
                          {stat.total_pnl.toFixed(2)} USDT
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Statistiken pro Coin */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Statistiken pro Coin
          </h2>
          {stats.by_coin.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              Keine Statistiken verfügbar
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Käufe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verkäufe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PnL
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.by_coin.map((stat: { symbol: string; buys: number; sells: number; total_pnl: number }) => (
                    <tr key={stat.symbol}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.symbol}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {stat.buys}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {stat.sells}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            stat.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {stat.total_pnl >= 0 ? '+' : ''}
                          {stat.total_pnl.toFixed(2)} USDT
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                            {(position.quantity || 0).toFixed(8)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Einstiegspreis:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {(position.entryPrice || 0).toFixed(8)} USDT
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Aktueller Preis:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {(position.currentPrice || 0).toFixed(8)} USDT
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 text-right">
                      <p
                        className={`text-2xl font-bold ${
                          (position.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {(position.pnl || 0) >= 0 ? '+' : ''}
                        {(position.pnl || 0).toFixed(2)} USDT
                      </p>
                      <p
                        className={`text-lg font-medium mt-1 ${
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

      {/* Trade-Historie */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Trade-Historie ({totalTrades} insgesamt, Seite {currentPage} von {totalPages})
          </h2>
        </div>
        {trades.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            Keine Trades vorhanden
          </div>
        ) : (
          <>
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
                          {(trade.price || 0).toFixed(8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(trade.quantity || 0).toFixed(8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {((trade as any).total && (trade as any).total !== null) 
                            ? ((trade as any).total ?? 0).toFixed(2) 
                            : ((trade.price || 0) * (trade.quantity || 0)).toFixed(2)} USDT
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {trade.pnl !== undefined && trade.pnl !== null ? (
                            <span
                              className={`font-medium ${
                                trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {trade.pnl >= 0 ? '+' : ''}
                              {(trade.pnl ?? 0).toFixed(2)} USDT
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 sm:px-6 shadow rounded-md">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Zurück
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Weiter
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Zeige <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> bis{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * ITEMS_PER_PAGE, totalTrades)}
                      </span>{' '}
                      von <span className="font-medium">{totalTrades}</span> Trades
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Vorherige</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // Zeige erste Seite, letzte Seite, aktuelle Seite und Seiten daneben
                          return page === 1 || 
                                 page === totalPages || 
                                 (page >= currentPage - 1 && page <= currentPage + 1);
                        })
                        .map((page, index, array) => {
                          // Füge "..." ein wenn Lücken vorhanden sind
                          const showEllipsisBefore = index > 0 && array[index - 1] !== page - 1;
                          return (
                            <div key={page} className="flex">
                              {showEllipsisBefore && (
                                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  page === currentPage
                                    ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                }`}
                              >
                                {page}
                              </button>
                            </div>
                          );
                        })}
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Nächste</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
