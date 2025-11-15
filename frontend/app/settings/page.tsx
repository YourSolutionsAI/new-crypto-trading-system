'use client';

import { useEffect, useState } from 'react';
import { getBotSettings, updateBotSettings } from '@/lib/api';
import type { BotSettings } from '@/lib/api';
import { formatNumber, parseFormattedNumber } from '@/lib/numberFormat';

export default function SettingsPage() {
  const [settings, setSettings] = useState<BotSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<BotSettings>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getBotSettings();
      setSettings(data);
      setEditedSettings(data);
      // Initialisiere Input-Werte mit formatierten Zahlen
      const initialInputValues: Record<string, string> = {};
      Object.keys(data).forEach(key => {
        const value = data[key];
        if (typeof value === 'number') {
          if (key.includes('percent') || key.includes('threshold')) {
            initialInputValues[key] = formatNumber(value, 2);
          } else if (key.includes('usdt') || key.includes('size')) {
            initialInputValues[key] = formatNumber(value, 2);
          } else {
            initialInputValues[key] = formatNumber(value, 0);
          }
        }
      });
      setInputValues(initialInputValues);
    } catch (error) {
      console.error('Fehler beim Laden der Einstellungen:', error);
      alert('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBotSettings(editedSettings);
      setSettings(editedSettings);
      alert('Einstellungen erfolgreich gespeichert!');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern der Einstellungen');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEditedSettings(settings);
    // Setze Input-Werte zurück
    const resetInputValues: Record<string, string> = {};
    Object.keys(settings).forEach(key => {
      const value = settings[key];
      if (typeof value === 'number') {
        if (key.includes('percent') || key.includes('threshold')) {
          resetInputValues[key] = formatNumber(value, 2);
        } else if (key.includes('usdt') || key.includes('size')) {
          resetInputValues[key] = formatNumber(value, 2);
        } else {
          resetInputValues[key] = formatNumber(value, 0);
        }
      }
    });
    setInputValues(resetInputValues);
  };

  const updateSetting = (key: string, value: any) => {
    setEditedSettings({
      ...editedSettings,
      [key]: value
    });
  };

  const getSettingValue = (key: string): any => {
    return editedSettings[key] ?? settings[key] ?? '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Einstellungen...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Bot-Einstellungen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Globale Bot-Einstellungen verwalten
        </p>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-6 py-4">
          <div className="space-y-6">
            {/* Trading Einstellungen */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Trading-Einstellungen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Total Exposure (USDT)
                  </label>
                  <input
                    type="text"
                    value={inputValues.max_total_exposure_usdt ?? (getSettingValue('max_total_exposure_usdt') ? formatNumber(getSettingValue('max_total_exposure_usdt'), 2) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, max_total_exposure_usdt: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      updateSetting('max_total_exposure_usdt', parsed || 0);
                      if (parsed !== undefined) {
                        setInputValues({ ...inputValues, max_total_exposure_usdt: formatNumber(parsed, 2) });
                      }
                    }}
                    placeholder="0,00"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximales Gesamt-Exposure über alle Positionen</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Concurrent Trades
                  </label>
                  <input
                    type="text"
                    value={inputValues.max_concurrent_trades ?? (getSettingValue('max_concurrent_trades') ? formatNumber(getSettingValue('max_concurrent_trades'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, max_concurrent_trades: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('max_concurrent_trades', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, max_concurrent_trades: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximale Anzahl gleichzeitiger Trades</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Trade Size (USDT)
                  </label>
                  <input
                    type="text"
                    value={inputValues.default_trade_size_usdt ?? (getSettingValue('default_trade_size_usdt') ? formatNumber(getSettingValue('default_trade_size_usdt'), 2) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, default_trade_size_usdt: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      updateSetting('default_trade_size_usdt', parsed || 0);
                      if (parsed !== undefined) {
                        setInputValues({ ...inputValues, default_trade_size_usdt: formatNumber(parsed, 2) });
                      }
                    }}
                    placeholder="0,00"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Standard Trade-Größe wenn nicht in Strategie definiert</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Signal Threshold (%)
                  </label>
                  <input
                    type="text"
                    value={inputValues.signal_threshold_percent ?? (getSettingValue('signal_threshold_percent') ? formatNumber(getSettingValue('signal_threshold_percent'), 3) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, signal_threshold_percent: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      updateSetting('signal_threshold_percent', parsed || 0);
                      if (parsed !== undefined) {
                        setInputValues({ ...inputValues, signal_threshold_percent: formatNumber(parsed, 3) });
                      }
                    }}
                    placeholder="0,000"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimale MA-Differenz für Signale</p>
                </div>
              </div>
            </div>

            {/* Indikator-Defaults */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Indikator-Defaults</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    MA Short (Default)
                  </label>
                  <input
                    type="text"
                    value={inputValues.default_indicators_ma_short ?? (getSettingValue('default_indicators_ma_short') ? formatNumber(getSettingValue('default_indicators_ma_short'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, default_indicators_ma_short: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('default_indicators_ma_short', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, default_indicators_ma_short: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    MA Long (Default)
                  </label>
                  <input
                    type="text"
                    value={inputValues.default_indicators_ma_long ?? (getSettingValue('default_indicators_ma_long') ? formatNumber(getSettingValue('default_indicators_ma_long'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, default_indicators_ma_long: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('default_indicators_ma_long', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, default_indicators_ma_long: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSI Period (Default)
                  </label>
                  <input
                    type="text"
                    value={inputValues.default_indicators_rsi_period ?? (getSettingValue('default_indicators_rsi_period') ? formatNumber(getSettingValue('default_indicators_rsi_period'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, default_indicators_rsi_period: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('default_indicators_rsi_period', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, default_indicators_rsi_period: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSI Overbought (Default)
                  </label>
                  <input
                    type="text"
                    value={inputValues.default_indicators_rsi_overbought ?? (getSettingValue('default_indicators_rsi_overbought') ? formatNumber(getSettingValue('default_indicators_rsi_overbought'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, default_indicators_rsi_overbought: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('default_indicators_rsi_overbought', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, default_indicators_rsi_overbought: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSI Oversold (Default)
                  </label>
                  <input
                    type="text"
                    value={inputValues.default_indicators_rsi_oversold ?? (getSettingValue('default_indicators_rsi_oversold') ? formatNumber(getSettingValue('default_indicators_rsi_oversold'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, default_indicators_rsi_oversold: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('default_indicators_rsi_oversold', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, default_indicators_rsi_oversold: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Price History
                  </label>
                  <input
                    type="text"
                    value={inputValues.max_price_history ?? (getSettingValue('max_price_history') ? formatNumber(getSettingValue('max_price_history'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, max_price_history: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('max_price_history', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, max_price_history: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximale Anzahl gespeicherter Preise</p>
                </div>
              </div>
            </div>

            {/* Logging Einstellungen */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Logging-Einstellungen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Price Log Interval
                  </label>
                  <input
                    type="text"
                    value={inputValues.logging_price_log_interval ?? (getSettingValue('logging_price_log_interval') ? formatNumber(getSettingValue('logging_price_log_interval'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, logging_price_log_interval: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('logging_price_log_interval', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, logging_price_log_interval: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Preis alle X Updates loggen</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hold Log Interval
                  </label>
                  <input
                    type="text"
                    value={inputValues.logging_hold_log_interval ?? (getSettingValue('logging_hold_log_interval') ? formatNumber(getSettingValue('logging_hold_log_interval'), 0) : '')}
                    onChange={(e) => {
                      setInputValues({ ...inputValues, logging_hold_log_interval: e.target.value });
                    }}
                    onBlur={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      const value = parsed ? Math.floor(parsed) : 0;
                      updateSetting('logging_hold_log_interval', value);
                      if (value !== undefined) {
                        setInputValues({ ...inputValues, logging_hold_log_interval: formatNumber(value, 0) });
                      }
                    }}
                    placeholder="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">Hold-Signal alle X Updates loggen</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? 'Speichere...' : 'Speichern'}
              </button>
              <button
                onClick={handleReset}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Zurücksetzen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

