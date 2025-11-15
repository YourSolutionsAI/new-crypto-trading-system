'use client';

import { useEffect, useState } from 'react';
import { getBotSettings, updateBotSettings } from '@/lib/api';
import type { BotSettings } from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<BotSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedSettings, setEditedSettings] = useState<BotSettings>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getBotSettings();
      setSettings(data);
      setEditedSettings(data);
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
                    type="number"
                    step="0.01"
                    value={getSettingValue('max_total_exposure_usdt')}
                    onChange={(e) => updateSetting('max_total_exposure_usdt', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximales Gesamt-Exposure über alle Positionen</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Concurrent Trades
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('max_concurrent_trades')}
                    onChange={(e) => updateSetting('max_concurrent_trades', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Maximale Anzahl gleichzeitiger Trades</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Default Trade Size (USDT)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={getSettingValue('default_trade_size_usdt')}
                    onChange={(e) => updateSetting('default_trade_size_usdt', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Standard Trade-Größe wenn nicht in Strategie definiert</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Trade Cooldown (ms)
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('trade_cooldown_ms')}
                    onChange={(e) => updateSetting('trade_cooldown_ms', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Hinweis: Trade Cooldown wird pro Coin konfiguriert. Diese Einstellung dient nur als Fallback.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Signal Cooldown (ms)
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('signal_cooldown_ms')}
                    onChange={(e) => updateSetting('signal_cooldown_ms', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Pause zwischen Signalen in Millisekunden</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Signal Threshold (%)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={getSettingValue('signal_threshold_percent')}
                    onChange={(e) => updateSetting('signal_threshold_percent', parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                    type="number"
                    value={getSettingValue('default_indicators_ma_short')}
                    onChange={(e) => updateSetting('default_indicators_ma_short', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    MA Long (Default)
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('default_indicators_ma_long')}
                    onChange={(e) => updateSetting('default_indicators_ma_long', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSI Period (Default)
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('default_indicators_rsi_period')}
                    onChange={(e) => updateSetting('default_indicators_rsi_period', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSI Overbought (Default)
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('default_indicators_rsi_overbought')}
                    onChange={(e) => updateSetting('default_indicators_rsi_overbought', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    RSI Oversold (Default)
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('default_indicators_rsi_oversold')}
                    onChange={(e) => updateSetting('default_indicators_rsi_oversold', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Price History
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('max_price_history')}
                    onChange={(e) => updateSetting('max_price_history', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
                    type="number"
                    value={getSettingValue('logging_price_log_interval')}
                    onChange={(e) => updateSetting('logging_price_log_interval', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Preis alle X Updates loggen</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hold Log Interval
                  </label>
                  <input
                    type="number"
                    value={getSettingValue('logging_hold_log_interval')}
                    onChange={(e) => updateSetting('logging_hold_log_interval', parseInt(e.target.value) || 0)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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

