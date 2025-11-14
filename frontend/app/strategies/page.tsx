'use client';

import { useEffect, useState } from 'react';
import { getStrategies, updateStrategy, toggleStrategy } from '@/lib/api';
import type { Strategy } from '@/lib/types';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Strategy['config']>>({});

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await getStrategies();
      setStrategies(data);
    } catch (error) {
      console.error('Fehler beim Laden der Strategien:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await toggleStrategy(id, !currentStatus);
      await loadStrategies();
    } catch (error) {
      console.error('Fehler beim Toggle:', error);
      alert('Fehler beim Aktivieren/Deaktivieren der Strategie');
    }
  };

  const handleStartEdit = (strategy: Strategy) => {
    setEditingId(strategy.id);
    setEditForm({
      ma_short: strategy.config.ma_short,
      ma_long: strategy.config.ma_long,
      trade_size_usdt: strategy.config.trade_size_usdt,
      settings: {
        signal_threshold_percent:
          strategy.config.settings?.signal_threshold_percent,
        signal_cooldown_ms: strategy.config.settings?.signal_cooldown_ms,
        trade_cooldown_ms: strategy.config.settings?.trade_cooldown_ms,
      },
      risk: {
        stop_loss_percent: strategy.config.risk?.stop_loss_percent,
        take_profit_percent: strategy.config.risk?.take_profit_percent,
      },
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateStrategy(id, { config: editForm });
      setEditingId(null);
      await loadStrategies();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern der Strategie');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Strategien...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Strategien</h1>
        <p className="mt-1 text-sm text-gray-500">
          Strategien verwalten und konfigurieren
        </p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {strategies.map((strategy) => (
            <li key={strategy.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {strategy.name}
                    </h3>
                    <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {strategy.symbol}
                    </span>
                    <button
                      onClick={() =>
                        handleToggleActive(strategy.id, strategy.is_active)
                      }
                      className={`ml-3 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        strategy.is_active ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          strategy.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="ml-2 text-sm text-gray-500">
                      {strategy.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  {strategy.description && (
                    <p className="mt-1 text-sm text-gray-500">
                      {strategy.description}
                    </p>
                  )}

                  {editingId === strategy.id ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            MA Short
                          </label>
                          <input
                            type="number"
                            value={editForm.ma_short || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                ma_short: parseInt(e.target.value),
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            MA Long
                          </label>
                          <input
                            type="number"
                            value={editForm.ma_long || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                ma_long: parseInt(e.target.value),
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Trade Size (USDT)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.trade_size_usdt || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                trade_size_usdt: parseFloat(e.target.value),
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Signal Threshold (%)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={
                              editForm.settings?.signal_threshold_percent || ''
                            }
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                settings: {
                                  ...editForm.settings,
                                  signal_threshold_percent: parseFloat(
                                    e.target.value
                                  ),
                                },
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Signal Cooldown (ms)
                          </label>
                          <input
                            type="number"
                            value={editForm.settings?.signal_cooldown_ms || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                settings: {
                                  ...editForm.settings,
                                  signal_cooldown_ms: parseInt(e.target.value),
                                },
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Trade Cooldown (ms)
                          </label>
                          <input
                            type="number"
                            value={editForm.settings?.trade_cooldown_ms || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                settings: {
                                  ...editForm.settings,
                                  trade_cooldown_ms: parseInt(e.target.value),
                                },
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Stop-Loss (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.risk?.stop_loss_percent || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                risk: {
                                  ...editForm.risk,
                                  stop_loss_percent: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Take-Profit (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editForm.risk?.take_profit_percent || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                risk: {
                                  ...editForm.risk,
                                  take_profit_percent: parseFloat(
                                    e.target.value
                                  ),
                                },
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleSaveEdit(strategy.id)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Speichern
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">MA Short:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config.ma_short || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">MA Long:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config.ma_long || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Trade Size:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config.trade_size_usdt || '-'} USDT
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Threshold:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config.settings?.signal_threshold_percent ||
                              '-'}
                            %
                          </span>
                        </div>
                      </div>
                      {strategy.total_trades !== undefined && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Trades:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {strategy.total_trades}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Win Rate:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {strategy.win_rate?.toFixed(1) || '0'}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total PnL:</span>
                            <span
                              className={`ml-2 font-medium ${
                                (strategy.total_pnl || 0) >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {strategy.total_pnl?.toFixed(2) || '0.00'} USDT
                            </span>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => handleStartEdit(strategy)}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Bearbeiten
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

