'use client';

import { useEffect, useState } from 'react';
import { getCoins, getStrategies, updateCoinStrategy, toggleCoin } from '@/lib/api';
import type { CoinStrategy, Strategy } from '@/lib/types';
import { formatNumber, parseFormattedNumber, formatNumberInput } from '@/lib/numberFormat';

// Verfügbare Coins (können später aus API geladen werden)
const AVAILABLE_COINS = [
  'DOGEUSDT', 'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 
  'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'SHIBUSDT'
];

export default function CoinsPage() {
  const [coins, setCoins] = useState<CoinStrategy[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    strategy_id?: string | null;
    active?: boolean;
    signal_threshold_percent?: number;
    signal_cooldown_ms?: number;
    trade_cooldown_ms?: number;
    max_trade_size_usdt?: number;
    stop_loss_percent?: number;
    take_profit_percent?: number;
    use_trailing_stop?: boolean;
    trailing_stop_activation_threshold?: number;
  }>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coinsData, strategiesData] = await Promise.all([
        getCoins().catch(() => []),
        getStrategies().catch(() => [])
      ]);
      setCoins(coinsData);
      setStrategies(strategiesData);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (coin: CoinStrategy) => {
    setEditingSymbol(coin.symbol);
    const formData = {
      strategy_id: coin.strategy_id,
      active: coin.active,
      signal_threshold_percent: coin.config?.settings?.signal_threshold_percent,
      signal_cooldown_ms: coin.config?.settings?.signal_cooldown_ms,
      trade_cooldown_ms: coin.config?.settings?.trade_cooldown_ms,
      max_trade_size_usdt: coin.config?.risk?.max_trade_size_usdt,
      stop_loss_percent: coin.config?.risk?.stop_loss_percent,
      take_profit_percent: coin.config?.risk?.take_profit_percent,
      use_trailing_stop: coin.config?.risk?.use_trailing_stop || false,
      trailing_stop_activation_threshold: coin.config?.risk?.trailing_stop_activation_threshold,
    };
    setEditForm(formData);
    // Initialisiere Input-Werte mit formatierten Zahlen
    setInputValues({
      signal_threshold_percent: formData.signal_threshold_percent !== undefined ? formatNumber(formData.signal_threshold_percent, 3) : '',
      signal_cooldown_ms: formData.signal_cooldown_ms !== undefined ? formatNumber(formData.signal_cooldown_ms, 0) : '',
      trade_cooldown_ms: formData.trade_cooldown_ms !== undefined ? formatNumber(formData.trade_cooldown_ms, 0) : '',
      max_trade_size_usdt: formData.max_trade_size_usdt !== undefined ? formatNumber(formData.max_trade_size_usdt, 2) : '',
      stop_loss_percent: formData.stop_loss_percent !== undefined ? formatNumber(formData.stop_loss_percent, 2) : '',
      take_profit_percent: formData.take_profit_percent !== undefined ? formatNumber(formData.take_profit_percent, 2) : '',
      trailing_stop_activation_threshold: formData.trailing_stop_activation_threshold !== undefined ? formatNumber(formData.trailing_stop_activation_threshold, 2) : '',
    });
  };

  const handleSaveEdit = async (symbol: string) => {
    try {
      await updateCoinStrategy(symbol, {
        strategy_id: editForm.strategy_id || null,
        active: editForm.active !== undefined ? editForm.active : false,
        config: {
          settings: {
            signal_threshold_percent: editForm.signal_threshold_percent,
            signal_cooldown_ms: editForm.signal_cooldown_ms,
            trade_cooldown_ms: editForm.trade_cooldown_ms,
          },
          risk: {
            max_trade_size_usdt: editForm.max_trade_size_usdt,
            stop_loss_percent: editForm.stop_loss_percent,
            take_profit_percent: editForm.take_profit_percent,
            use_trailing_stop: editForm.use_trailing_stop,
            trailing_stop_activation_threshold: editForm.trailing_stop_activation_threshold,
          }
        }
      });
      setEditingSymbol(null);
      await loadData();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern der Coin-Konfiguration');
    }
  };

  const handleCancelEdit = () => {
    setEditingSymbol(null);
    setEditForm({});
    setInputValues({});
  };

  const handleToggleActive = async (symbol: string, currentStatus: boolean) => {
    try {
      await toggleCoin(symbol, !currentStatus);
      await loadData();
    } catch (error) {
      console.error('Fehler beim Toggle:', error);
      alert('Fehler beim Aktivieren/Deaktivieren des Coins');
    }
  };

  // Erstelle Map für schnellen Zugriff
  const coinsMap = new Map(coins.map(c => [c.symbol, c]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Coins...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Coins</h1>
        <p className="mt-1 text-sm text-gray-500">
          Coins verwalten, Strategien zuweisen und Coin-spezifische Einstellungen konfigurieren
        </p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {AVAILABLE_COINS.map((symbol) => {
            const coin = coinsMap.get(symbol);
            const isEditing = editingSymbol === symbol;

            return (
              <li key={symbol} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        {symbol}
                      </h3>
                      <button
                        onClick={() => handleToggleActive(symbol, coin?.active || false)}
                        className={`ml-3 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          coin?.active ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            coin?.active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-2 text-sm text-gray-500">
                        {coin?.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 space-y-4">
                        {/* Strategie-Auswahl */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Strategie
                          </label>
                          <select
                            value={editForm.strategy_id || ''}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                strategy_id: e.target.value || null,
                              })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          >
                            <option value="">Keine Strategie</option>
                            {strategies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Settings */}
                        <div className="border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Signal-Einstellungen
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Signal Threshold (%)
                              </label>
                              <input
                                type="text"
                                value={inputValues.signal_threshold_percent ?? (editForm.signal_threshold_percent !== undefined ? formatNumber(editForm.signal_threshold_percent, 3) : '')}
                                onChange={(e) => {
                                  setInputValues({ ...inputValues, signal_threshold_percent: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  setEditForm({
                                    ...editForm,
                                    signal_threshold_percent: parsed,
                                  });
                                  if (parsed !== undefined) {
                                    setInputValues({ ...inputValues, signal_threshold_percent: formatNumber(parsed, 3) });
                                  }
                                }}
                                placeholder="0,000"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Signal Cooldown (ms)
                              </label>
                              <input
                                type="text"
                                value={inputValues.signal_cooldown_ms ?? (editForm.signal_cooldown_ms !== undefined ? formatNumber(editForm.signal_cooldown_ms, 0) : '')}
                                onChange={(e) => {
                                  setInputValues({ ...inputValues, signal_cooldown_ms: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  const value = parsed ? Math.floor(parsed) : undefined;
                                  setEditForm({
                                    ...editForm,
                                    signal_cooldown_ms: value,
                                  });
                                  if (value !== undefined) {
                                    setInputValues({ ...inputValues, signal_cooldown_ms: formatNumber(value, 0) });
                                  }
                                }}
                                placeholder="0"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Trade Cooldown (ms)
                              </label>
                              <input
                                type="text"
                                value={inputValues.trade_cooldown_ms ?? (editForm.trade_cooldown_ms !== undefined ? formatNumber(editForm.trade_cooldown_ms, 0) : '')}
                                onChange={(e) => {
                                  setInputValues({ ...inputValues, trade_cooldown_ms: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  const value = parsed ? Math.floor(parsed) : undefined;
                                  setEditForm({
                                    ...editForm,
                                    trade_cooldown_ms: value,
                                  });
                                  if (value !== undefined) {
                                    setInputValues({ ...inputValues, trade_cooldown_ms: formatNumber(value, 0) });
                                  }
                                }}
                                placeholder="0"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                              />
                              <p className="mt-1 text-xs text-gray-500">Pause zwischen Trades für diesen Coin (pro Coin individuell)</p>
                            </div>
                          </div>
                        </div>

                        {/* Risk Management */}
                        <div className="border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Risk Management
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Trade Size (USDT)
                              </label>
                              <input
                                type="text"
                                value={inputValues.max_trade_size_usdt ?? (editForm.max_trade_size_usdt !== undefined ? formatNumber(editForm.max_trade_size_usdt, 2) : '')}
                                onChange={(e) => {
                                  setInputValues({ ...inputValues, max_trade_size_usdt: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  setEditForm({
                                    ...editForm,
                                    max_trade_size_usdt: parsed,
                                  });
                                  if (parsed !== undefined) {
                                    setInputValues({ ...inputValues, max_trade_size_usdt: formatNumber(parsed, 2) });
                                  }
                                }}
                                placeholder="0,00"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Stop-Loss (%)
                              </label>
                              <input
                                type="text"
                                value={inputValues.stop_loss_percent ?? (editForm.stop_loss_percent !== undefined ? formatNumber(editForm.stop_loss_percent, 2) : '')}
                                onChange={(e) => {
                                  setInputValues({ ...inputValues, stop_loss_percent: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  setEditForm({
                                    ...editForm,
                                    stop_loss_percent: parsed,
                                  });
                                  if (parsed !== undefined) {
                                    setInputValues({ ...inputValues, stop_loss_percent: formatNumber(parsed, 2) });
                                  }
                                }}
                                placeholder="0,00"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Take-Profit (%)
                              </label>
                              <input
                                type="text"
                                value={inputValues.take_profit_percent ?? (editForm.take_profit_percent !== undefined ? formatNumber(editForm.take_profit_percent, 2) : '')}
                                onChange={(e) => {
                                  setInputValues({ ...inputValues, take_profit_percent: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const parsed = parseFormattedNumber(e.target.value);
                                  setEditForm({
                                    ...editForm,
                                    take_profit_percent: parsed,
                                  });
                                  if (parsed !== undefined) {
                                    setInputValues({ ...inputValues, take_profit_percent: formatNumber(parsed, 2) });
                                  }
                                }}
                                placeholder="0,00"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                              />
                            </div>
                          </div>

                          {/* Trailing Stop Loss */}
                          <div className="mt-4 border-t border-gray-200 pt-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">
                              Trailing Stop Loss
                            </h4>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`trailing-stop-${symbol}`}
                                checked={editForm.use_trailing_stop || false}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    use_trailing_stop: e.target.checked,
                                    // Aktivierungsschwelle wird immer auf 0 gesetzt (nicht mehr verwendet)
                                    trailing_stop_activation_threshold: 0
                                  })
                                }
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label
                                htmlFor={`trailing-stop-${symbol}`}
                                className="ml-2 block text-sm text-gray-900"
                              >
                                Trailing Stop Loss aktivieren
                              </label>
                            </div>
                            {editForm.use_trailing_stop && (
                              <div className="mt-2 p-3 bg-purple-50 rounded border border-purple-200">
                                <p className="text-xs text-purple-700">
                                  <strong>ℹ️ Trailing Stop Loss:</strong><br/>
                                  • Sofort aktiv beim Kauf<br/>
                                  • Folgt automatisch dem höchsten Preis<br/>
                                  • Verkauf bei: Höchster Preis - Stop Loss %
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleSaveEdit(symbol)}
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
                            <span className="text-gray-500">Strategie:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {coin?.strategy_name || 'Keine'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Trade Size:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {coin?.config?.risk?.max_trade_size_usdt !== undefined 
                                ? formatNumber(coin.config.risk.max_trade_size_usdt, 2) 
                                : '-'} USDT
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Signal Threshold:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {coin?.config?.settings?.signal_threshold_percent !== undefined 
                                ? formatNumber(coin.config.settings.signal_threshold_percent, 3) 
                                : '-'}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Stop-Loss:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {coin?.config?.risk?.stop_loss_percent !== undefined 
                                ? formatNumber(coin.config.risk.stop_loss_percent, 2) 
                                : '-'}%
                              {coin?.config?.risk?.use_trailing_stop && (
                                <span className="ml-1 text-xs text-blue-600">(Trailing)</span>
                              )}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartEdit(coin || { symbol, strategy_id: null, active: false, config: {}, created_at: '', updated_at: '' })}
                          className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {coin ? 'Bearbeiten' : 'Konfigurieren'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

