'use client';

import { useEffect, useState } from 'react';
import { getStrategies, updateStrategy, toggleStrategy } from '@/lib/api';
import type { Strategy } from '@/lib/types';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // Helper type für settings mit optionalen Feldern
  type SettingsForm = {
    signal_threshold_percent?: number;
    signal_cooldown_ms?: number;
    trade_cooldown_ms?: number;
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await getStrategies().catch(() => []);
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
      ma_short: strategy.config?.ma_short ?? strategy.config?.indicators?.ma_short,
      ma_long: strategy.config?.ma_long ?? strategy.config?.indicators?.ma_long,
      trade_size_usdt: strategy.config?.trade_size_usdt ?? strategy.config?.risk?.max_trade_size_usdt,
      settings: strategy.config?.settings ? {
        signal_threshold_percent:
          strategy.config.settings.signal_threshold_percent ?? undefined,
        signal_cooldown_ms: strategy.config.settings.signal_cooldown_ms ?? undefined,
        trade_cooldown_ms: strategy.config.settings.trade_cooldown_ms ?? undefined,
      } : undefined,
      risk: strategy.config?.risk ? {
        max_trade_size_usdt: strategy.config.risk.max_trade_size_usdt ?? undefined,
        stop_loss_percent: strategy.config.risk.stop_loss_percent ?? undefined,
        take_profit_percent: strategy.config.risk.take_profit_percent ?? undefined,
        use_trailing_stop: strategy.config.risk.use_trailing_stop ?? false,
        trailing_stop_activation_threshold: strategy.config.risk.trailing_stop_activation_threshold ?? undefined,
      } : undefined,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateStrategy(id, { config: editForm } as any);
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
                  {(strategy as any).description && (
                    <p className="mt-1 text-sm text-gray-500">
                      {(strategy as any).description}
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
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              const newSettings: SettingsForm = {
                                ...editForm.settings,
                                signal_threshold_percent: isNaN(value) ? undefined : value,
                              };
                              setEditForm({
                                ...editForm,
                                settings: newSettings as Strategy['config']['settings'],
                              });
                            }}
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
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              const newSettings: SettingsForm = {
                                ...editForm.settings,
                                signal_cooldown_ms: isNaN(value) ? undefined : value,
                              };
                              setEditForm({
                                ...editForm,
                                settings: newSettings as Strategy['config']['settings'],
                              });
                            }}
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
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              const newSettings: SettingsForm = {
                                ...editForm.settings,
                                trade_cooldown_ms: isNaN(value) ? undefined : value,
                              };
                              setEditForm({
                                ...editForm,
                                settings: newSettings as Strategy['config']['settings'],
                              });
                            }}
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
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                          Trailing Stop Loss
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id={`trailing-stop-${strategy.id}`}
                              checked={editForm.risk?.use_trailing_stop || false}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  risk: {
                                    ...editForm.risk,
                                    use_trailing_stop: e.target.checked,
                                  },
                                })
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                              htmlFor={`trailing-stop-${strategy.id}`}
                              className="ml-2 block text-sm text-gray-900"
                            >
                              Trailing Stop Loss aktivieren
                              <span className="ml-2 text-xs text-gray-500">
                                (Stop Loss wird automatisch nachgezogen)
                              </span>
                            </label>
                          </div>
                          {editForm.risk?.use_trailing_stop && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Aktivierungs-Schwelle (%)
                                <span className="ml-2 text-xs text-gray-500 font-normal">
                                  (Mindest-Gewinn bevor Trailing aktiv wird, 0 = sofort)
                                </span>
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={editForm.risk?.trailing_stop_activation_threshold || ''}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    risk: {
                                      ...editForm.risk,
                                      trailing_stop_activation_threshold: parseFloat(
                                        e.target.value
                                      ) || 0,
                                    },
                                  })
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                placeholder="0"
                              />
                            </div>
                          )}
                        </div>
                        {editForm.risk?.use_trailing_stop && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-md">
                            <p className="text-xs text-blue-800">
                              <strong>Info:</strong> Bei aktiviertem Trailing Stop wird der Stop Loss automatisch nachgezogen, 
                              wenn der Preis steigt. Take-Profit wird deaktiviert, da Trailing Stop größere Gewinne ermöglicht.
                            </p>
                          </div>
                        )}
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
                            {strategy.config?.ma_short ?? strategy.config?.indicators?.ma_short ?? '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">MA Long:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.ma_long ?? strategy.config?.indicators?.ma_long ?? '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Trade Size:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.trade_size_usdt ?? strategy.config?.risk?.max_trade_size_usdt ?? '-'} USDT
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Threshold:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.settings?.signal_threshold_percent ?? '-'}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Stop-Loss:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.risk?.stop_loss_percent ?? '-'}%
                            {strategy.config?.risk?.use_trailing_stop && (
                              <span className="ml-1 text-xs text-blue-600">(Trailing)</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Take-Profit:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.risk?.take_profit_percent ?? '-'}%
                            {strategy.config?.risk?.use_trailing_stop && (
                              <span className="ml-1 text-xs text-gray-400">(deaktiviert)</span>
                            )}
                          </span>
                        </div>
                        {strategy.config?.risk?.use_trailing_stop && (
                          <div>
                            <span className="text-gray-500">Trailing Aktivierung:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {strategy.config?.risk?.trailing_stop_activation_threshold ?? 0}%
                            </span>
                          </div>
                        )}
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
                              {(strategy.win_rate ?? 0).toFixed(1)}%
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
                              {(strategy.total_pnl ?? 0).toFixed(2)} USDT
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

