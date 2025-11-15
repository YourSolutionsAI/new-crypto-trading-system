'use client';

import { useEffect, useState } from 'react';
import { getTestnetBalance, sellAsset } from '@/lib/api';
import type { TestnetBalance, Balance } from '@/lib/types';

export default function Wallet() {
  const [balance, setBalance] = useState<TestnetBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState<string | null>(null);
  const [sellQuantity, setSellQuantity] = useState<string>('');
  const [sellError, setSellError] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadBalance();
    const interval = setInterval(loadBalance, 10000); // Alle 10 Sekunden aktualisieren
    return () => clearInterval(interval);
  }, []);

  const loadBalance = async () => {
    try {
      const balanceData = await getTestnetBalance();
      setBalance(balanceData);
    } catch (error) {
      console.error('Fehler beim Laden des Guthabens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSellClick = (asset: string) => {
    const assetBalance = balance?.balances.find(b => b.asset === asset);
    if (assetBalance && assetBalance.free > 0) {
      setSelling(asset);
      setSellQuantity(assetBalance.free.toString());
      setSellError(null);
      setSellSuccess(null);
    }
  };

  const handleSellCancel = () => {
    setSelling(null);
    setSellQuantity('');
    setSellError(null);
    setSellSuccess(null);
  };

  const handleSellConfirm = async () => {
    if (!selling || !sellQuantity) return;

    const assetBalance = balance?.balances.find(b => b.asset === selling);
    if (!assetBalance) return;

    const quantity = parseFloat(sellQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      setSellError('Bitte geben Sie eine gültige Menge ein');
      return;
    }

    if (quantity > assetBalance.free) {
      setSellError(`Nicht genügend ${selling} verfügbar. Verfügbar: ${assetBalance.free.toFixed(8)}`);
      return;
    }

    // Symbol erstellen (z.B. BTC -> BTCUSDT)
    const symbol = `${selling}USDT`;

    setSellError(null);
    setSellSuccess(null);

    try {
      const result = await sellAsset(selling, quantity, symbol);
      
      if (result.success) {
        setSellSuccess(`Verkauf erfolgreich! ${result.order?.quantity || quantity} ${selling} für ${result.order?.total?.toFixed(2) || 'N/A'} USDT`);
        setSelling(null);
        setSellQuantity('');
        // Guthaben neu laden
        setTimeout(() => {
          loadBalance();
        }, 1000);
      } else {
        setSellError(result.error || 'Fehler beim Verkauf');
      }
    } catch (error: any) {
      setSellError(error.message || 'Unbekannter Fehler beim Verkauf');
    }
  };

  const getSymbolForAsset = (asset: string): string => {
    return `${asset}USDT`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Lade Guthaben...</div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Wallet</h1>
        <p className="mt-1 text-sm text-gray-500">
          Übersicht über alle verfügbaren Guthaben im Binance Testnet
        </p>
        <div className="mt-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Testnet
          </span>
        </div>
      </div>

      {sellSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{sellSuccess}</p>
        </div>
      )}

      {balance?.success && balance.balances.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {balance.balances.map((bal) => (
              <li key={bal.asset} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        {bal.asset}
                      </h3>
                      {bal.asset === 'USDT' && (
                        <span 
                          className="ml-2 text-gray-400 cursor-help" 
                          title="USDT kann nicht verkauft werden, da es die Basiswährung ist"
                        >
                          ℹ️
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Verfügbar</p>
                        <p className="font-medium text-gray-900">
                          {bal.free.toFixed(8)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Gesperrt</p>
                        <p className="font-medium text-gray-900">
                          {bal.locked.toFixed(8)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Gesamt</p>
                        <p className="font-medium text-gray-900">
                          {bal.total.toFixed(8)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-6">
                    {bal.asset !== 'USDT' && bal.free > 0 ? (
                      <button
                        onClick={() => handleSellClick(bal.asset)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Verkaufen
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">
                        {bal.asset === 'USDT' ? 'Basiswährung' : 'Kein Guthaben'}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          {balance?.success === false 
            ? 'Guthaben konnte nicht geladen werden' 
            : 'Keine Guthaben vorhanden'}
        </div>
      )}

      {/* Verkaufs-Dialog */}
      {selling && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selling} verkaufen
              </h3>
              
              {sellError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{sellError}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Menge ({selling})
                </label>
                <input
                  type="number"
                  step="any"
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00000000"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Verfügbar: {balance?.balances.find(b => b.asset === selling)?.free.toFixed(8) || '0'} {selling}
                </p>
                <button
                  onClick={() => {
                    const max = balance?.balances.find(b => b.asset === selling)?.free || 0;
                    setSellQuantity(max.toString());
                  }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  Max verwenden
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Symbol: <span className="font-medium">{getSymbolForAsset(selling)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Der Verkauf wird als MARKET-Order ausgeführt
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleSellCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSellConfirm}
                  disabled={!sellQuantity || parseFloat(sellQuantity) <= 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Verkaufen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

