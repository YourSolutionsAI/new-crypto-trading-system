'use client';

import { useEffect, useState } from 'react';
import { getStrategies, updateStrategy } from '@/lib/api';
import type { Strategy } from '@/lib/types';
import { formatNumber, parseFormattedNumber } from '@/lib/numberFormat';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    ma_short?: number;
    ma_long?: number;
  }>({});

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

  const handleStartEdit = (strategy: Strategy) => {
    setEditingId(strategy.id);
    setEditForm({
      ma_short: strategy.config?.indicators?.ma_short,
      ma_long: strategy.config?.indicators?.ma_long,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateStrategy(id, {
        config: {
          indicators: {
            ma_short: editForm.ma_short,
            ma_long: editForm.ma_long,
          }
        }
      } as any);
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
          Basis-Strategien verwalten (Indikatoren-Konfiguration). Coin-spezifische Einstellungen werden auf der Coins-Seite verwaltet.
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
                            type="text"
                            value={editForm.ma_short !== undefined ? formatNumber(editForm.ma_short, 0) : ''}
                            onChange={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              setEditForm({
                                ...editForm,
                                ma_short: parsed ? Math.floor(parsed) : undefined,
                              });
                            }}
                            placeholder="0"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            MA Long
                          </label>
                          <input
                            type="text"
                            value={editForm.ma_long !== undefined ? formatNumber(editForm.ma_long, 0) : ''}
                            onChange={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              setEditForm({
                                ...editForm,
                                ma_long: parsed ? Math.floor(parsed) : undefined,
                              });
                            }}
                            placeholder="0"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
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
                            {strategy.config?.indicators?.ma_short !== undefined 
                              ? formatNumber(strategy.config.indicators.ma_short, 0) 
                              : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">MA Long:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.indicators?.ma_long !== undefined 
                              ? formatNumber(strategy.config.indicators.ma_long, 0) 
                              : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Typ:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.type ?? '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Timeframe:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {strategy.config?.timeframe ?? '-'}
                          </span>
                        </div>
                      </div>
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

      {strategies.length === 0 && (
        <div className="mt-4 text-center text-gray-500">
          Keine Strategien gefunden. Erstellen Sie eine neue Strategie in Supabase.
        </div>
      )}
    </div>
  );
}
