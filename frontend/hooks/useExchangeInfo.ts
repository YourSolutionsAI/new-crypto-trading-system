// Custom Hook für Exchange Info aus Datenbank (mit manuellem Sync)
import { useState, useEffect, useCallback } from 'react';
import { getExchangeInfo } from '@/lib/api';
import type { SpotUSDTSymbol } from '@/lib/binance-types';

export interface ExchangeInfoDB {
  symbol: string;
  status: string;
  base_asset: string;
  quote_asset: string;
  is_spot_trading_allowed: boolean;
  is_margin_trading_allowed: boolean;
  quote_order_qty_market_allowed: boolean;
  allow_trailing_stop: boolean;
  base_asset_precision: number;
  quote_asset_precision: number;
  quote_precision: number;
  base_commission_precision: number;
  quote_commission_precision: number;
  order_types: string[];
  iceberg_allowed: boolean;
  oco_allowed: boolean;
  oto_allowed: boolean;
  cancel_replace_allowed: boolean;
  amend_allowed: boolean;
  filters: any[];
  permissions: string[];
  permission_sets: any;
  last_updated_at: string;
}

interface UseExchangeInfoResult {
  exchangeInfo: ExchangeInfoDB[];
  spotUsdtSymbols: SpotUSDTSymbol[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: string | null;
}

export function useExchangeInfo(): UseExchangeInfoResult {
  const [exchangeInfo, setExchangeInfo] = useState<ExchangeInfoDB[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchExchangeInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Loading Exchange Info from Database...');
      const response = await getExchangeInfo();
      
      if (!response.success) {
        throw new Error(response.lastUpdated || 'Fehler beim Laden');
      }
      
      setExchangeInfo(response.exchangeInfo);
      setLastUpdated(response.lastUpdated);
      
      console.log('✅ Exchange Info loaded:', response.count, 'symbols');
      
      if (response.count === 0) {
        setError('Keine Exchange-Informationen gefunden. Bitte führen Sie eine Synchronisierung durch.');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Fehler beim Laden der Exchange-Informationen';
      setError(errorMsg);
      console.error('❌ Error loading Exchange Info:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialer Load
  useEffect(() => {
    fetchExchangeInfo();
  }, [fetchExchangeInfo]);

  // Filtere Spot USDT Symbole aus den DB-Daten
  const spotUsdtSymbols: SpotUSDTSymbol[] = exchangeInfo
    .filter((info) => {
      return (
        info.is_spot_trading_allowed === true &&
        info.quote_asset === 'USDT' &&
        info.status === 'TRADING'
      );
    })
    .map(info => {
      // Vollständiges Mapping für SpotUSDTSymbol
      return {
        symbol: info.symbol,
        status: info.status || 'TRADING',
        baseAsset: info.base_asset,
        quoteAsset: 'USDT',
        isSpotTradingAllowed: true,
        isMarginTradingAllowed: info.is_margin_trading_allowed,
        quoteOrderQtyMarketAllowed: info.quote_order_qty_market_allowed,
        allowTrailingStop: info.allow_trailing_stop,
        baseAssetPrecision: info.base_asset_precision,
        quoteAssetPrecision: info.quote_asset_precision,
        quotePrecision: info.quote_precision,
        baseCommissionPrecision: info.base_commission_precision,
        quoteCommissionPrecision: info.quote_commission_precision,
        orderTypes: info.order_types || [],
        icebergAllowed: info.iceberg_allowed,
        ocoAllowed: info.oco_allowed,
        otoAllowed: info.oto_allowed,
        cancelReplaceAllowed: info.cancel_replace_allowed,
        amendAllowed: info.amend_allowed,
        pegInstructionsAllowed: false,
        filters: info.filters || [],
        permissions: info.permissions || [],
        permissionSets: info.permission_sets,
        defaultSelfTradePreventionMode: 'NONE',
        allowedSelfTradePreventionModes: [],
      } as SpotUSDTSymbol;
    });

  return {
    exchangeInfo,
    spotUsdtSymbols,
    isLoading,
    error,
    refetch: fetchExchangeInfo,
    lastUpdated,
  };
}
