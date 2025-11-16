'use client';

import { useEffect, useState } from 'react';
import { getStrategies, updateStrategy, createStrategy } from '@/lib/api';
import type { Strategy } from '@/lib/types';
import { formatNumber, parseFormattedNumber } from '@/lib/numberFormat';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editForm, setEditForm] = useState<{
    ma_short?: number;
    ma_long?: number;
  }>({});
  const [createForm, setCreateForm] = useState<{
    name: string;
    description: string;
    type: string;
    timeframe: string;
    ma_short?: number;
    ma_long?: number;
  }>({
    name: '',
    description: '',
    type: 'simple_ma',
    timeframe: '1h',
  });
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [createInputValues, setCreateInputValues] = useState<Record<string, string>>({});

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
    const formData = {
      ma_short: strategy.config?.indicators?.ma_short,
      ma_long: strategy.config?.indicators?.ma_long,
    };
    setEditForm(formData);
    // Initialisiere Input-Werte mit formatierten Zahlen
    setInputValues({
      ma_short: formData.ma_short !== undefined ? formatNumber(formData.ma_short, 0) : '',
      ma_long: formData.ma_long !== undefined ? formatNumber(formData.ma_long, 0) : '',
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
    setInputValues({});
  };

  const handleStartCreate = () => {
    setShowCreateForm(true);
    setCreateForm({
      name: '',
      description: '',
      type: 'simple_ma',
      timeframe: '1h',
    });
    setCreateInputValues({
      ma_short: '',
      ma_long: '',
    });
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setCreateForm({
      name: '',
      description: '',
      type: 'simple_ma',
      timeframe: '1h',
    });
    setCreateInputValues({});
  };

  const handleSaveCreate = async () => {
    try {
      if (!createForm.name.trim()) {
        alert('Bitte geben Sie einen Namen für die Strategie ein.');
        return;
      }

      await createStrategy({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        config: {
          type: createForm.type,
          timeframe: createForm.timeframe,
          indicators: {
            ma_short: createForm.ma_short,
            ma_long: createForm.ma_long,
          }
        }
      });
      
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        description: '',
        type: 'simple_ma',
        timeframe: '1h',
      });
      setCreateInputValues({});
      await loadStrategies();
    } catch (error: any) {
      console.error('Fehler beim Erstellen:', error);
      const errorMessage = error.response?.data?.message || 'Fehler beim Erstellen der Strategie';
      alert(errorMessage);
    }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Strategien</h1>
            <p className="mt-1 text-sm text-gray-500">
              Basis-Strategien verwalten (Indikatoren-Konfiguration). Coin-spezifische Einstellungen werden auf der Coins-Seite verwaltet.
            </p>
          </div>
          {!showCreateForm && (
            <button
              onClick={handleStartCreate}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Neue Strategie erstellen
            </button>
          )}
        </div>
      </div>

      {showCreateForm && (
        <div className="mb-6 bg-white shadow overflow-hidden sm:rounded-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Neue Strategie erstellen</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="z.B. MA Crossover 20/50"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Beschreibung
              </label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optionale Beschreibung der Strategie"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Typ
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                >
                  <option value="simple_ma">Simple MA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Timeframe
                </label>
                <select
                  value={createForm.timeframe}
                  onChange={(e) => setCreateForm({ ...createForm, timeframe: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                >
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minuten</option>
                  <option value="15m">15 Minuten</option>
                  <option value="30m">30 Minuten</option>
                  <option value="1h">1 Stunde</option>
                  <option value="4h">4 Stunden</option>
                  <option value="1d">1 Tag</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  MA Short
                </label>
                <input
                  type="text"
                  value={createInputValues.ma_short ?? ''}
                  onChange={(e) => {
                    setCreateInputValues({ ...createInputValues, ma_short: e.target.value });
                  }}
                  onBlur={(e) => {
                    const parsed = parseFormattedNumber(e.target.value);
                    const value = parsed ? Math.floor(parsed) : undefined;
                    setCreateForm({
                      ...createForm,
                      ma_short: value,
                    });
                    if (value !== undefined) {
                      setCreateInputValues({ ...createInputValues, ma_short: formatNumber(value, 0) });
                    }
                  }}
                  placeholder="z.B. 20"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  MA Long
                </label>
                <input
                  type="text"
                  value={createInputValues.ma_long ?? ''}
                  onChange={(e) => {
                    setCreateInputValues({ ...createInputValues, ma_long: e.target.value });
                  }}
                  onBlur={(e) => {
                    const parsed = parseFormattedNumber(e.target.value);
                    const value = parsed ? Math.floor(parsed) : undefined;
                    setCreateForm({
                      ...createForm,
                      ma_long: value,
                    });
                    if (value !== undefined) {
                      setCreateInputValues({ ...createInputValues, ma_long: formatNumber(value, 0) });
                    }
                  }}
                  placeholder="z.B. 50"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-left px-3 py-2"
                />
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleSaveCreate}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Strategie erstellen
              </button>
              <button
                onClick={handleCancelCreate}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

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
                            value={inputValues.ma_short ?? (editForm.ma_short !== undefined ? formatNumber(editForm.ma_short, 0) : '')}
                            onChange={(e) => {
                              setInputValues({ ...inputValues, ma_short: e.target.value });
                            }}
                            onBlur={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              const value = parsed ? Math.floor(parsed) : undefined;
                              setEditForm({
                                ...editForm,
                                ma_short: value,
                              });
                              if (value !== undefined) {
                                setInputValues({ ...inputValues, ma_short: formatNumber(value, 0) });
                              }
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
                            value={inputValues.ma_long ?? (editForm.ma_long !== undefined ? formatNumber(editForm.ma_long, 0) : '')}
                            onChange={(e) => {
                              setInputValues({ ...inputValues, ma_long: e.target.value });
                            }}
                            onBlur={(e) => {
                              const parsed = parseFormattedNumber(e.target.value);
                              const value = parsed ? Math.floor(parsed) : undefined;
                              setEditForm({
                                ...editForm,
                                ma_long: value,
                              });
                              if (value !== undefined) {
                                setInputValues({ ...inputValues, ma_long: formatNumber(value, 0) });
                              }
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

      {strategies.length === 0 && !showCreateForm && (
        <div className="mt-4 text-center text-gray-500">
          Keine Strategien gefunden. Klicken Sie auf "Neue Strategie erstellen" um eine neue Strategie hinzuzufügen.
        </div>
      )}
    </div>
  );
}
