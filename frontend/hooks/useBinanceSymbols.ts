// Custom Hook für LIVE Binance Symbole (nicht aus DB)
// Wird für das Symbol-Dropdown beim Hinzufügen neuer Coins verwendet
import { useState, useEffect, useCallback } from 'react';
import { getBinanceSymbols } from '@/lib/api';

export interface BinanceSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minNotional: number;
  tickSize: number;
  stepSize: number;
  orderTypes: string[];
  isMarginTradingAllowed: boolean;
  inTestnetAvailable?: boolean;
}

interface UseBinanceSymbolsResult {
  symbols: BinanceSymbol[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  timestamp: string | null;
}

/**
 * Hook zum Laden aller handelbaren Symbole DIREKT von Binance (Live-Abfrage)
 * 
 * Unterschied zu useExchangeInfo:
 * - useExchangeInfo: Lädt bereits hinzugefügte Coins aus der DB
 * - useBinanceSymbols: Lädt ALLE verfügbaren Symbole von Binance API
 * 
 * @returns {UseBinanceSymbolsResult} Symbole, Loading-State und Fehler
 */
export function useBinanceSymbols(): UseBinanceSymbolsResult {
  const [symbols, setSymbols] = useState<BinanceSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  const fetchSymbols = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📡 Loading symbols from Binance API...');
      const response = await getBinanceSymbols();
      
      if (!response.success) {
        throw new Error('Fehler beim Laden der Symbole');
      }
      
      setSymbols(response.symbols);
      setTimestamp(response.timestamp);
      
      console.log('✅ Binance symbols loaded:', response.count, 'symbols');
    } catch (err: any) {
      const errorMsg = err.message || 'Fehler beim Laden der handelbaren Symbole';
      setError(errorMsg);
      console.error('❌ Error loading Binance symbols:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialer Load
  useEffect(() => {
    fetchSymbols();
  }, [fetchSymbols]);

  return {
    symbols,
    isLoading,
    error,
    refetch: fetchSymbols,
    timestamp,
  };
}

