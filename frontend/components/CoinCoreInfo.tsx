// Komponente für die immer sichtbaren Kerninformationen eines Coins
import React from 'react';
import type { BinanceSymbol } from '@/lib/binance-types';
import InfoTooltip from './InfoTooltip';
import { TOOLTIPS } from '@/lib/tooltips';

interface CoinCoreInfoProps {
  symbol: BinanceSymbol & { in_testnet_available?: boolean | null };
  className?: string;
}

// Helper: Finde spezifischen Filter nach Type
const findFilter = <T extends any>(
  filters: any[],
  filterType: string
): T | null => {
  return (filters.find((f) => f.filterType === filterType) as T) || null;
};

// Helper: Formatiere Zahlen
const formatValue = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === 0) return '0';
  if (num < 0.00000001) return num.toExponential(2);
  if (num < 1) return num.toFixed(8).replace(/\.?0+$/, '');
  return num.toLocaleString('de-DE', { maximumFractionDigits: 8 });
};

export const CoinCoreInfo: React.FC<CoinCoreInfoProps> = ({ symbol, className = '' }) => {
  // Extrahiere wichtige Filter
  const priceFilter = findFilter<any>(symbol.filters, 'PRICE_FILTER');
  const lotSizeFilter = findFilter<any>(symbol.filters, 'LOT_SIZE');
  const notionalFilter = findFilter<any>(symbol.filters, 'NOTIONAL');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Status & Basic Info */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Testnet Badge - ZUERST anzeigen */}
        {symbol.in_testnet_available !== undefined && symbol.in_testnet_available !== null && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              symbol.in_testnet_available
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-orange-100 text-orange-800 border border-orange-200'
            }`}
            title={symbol.in_testnet_available ? 'Dieser Coin ist im Binance Testnet verfügbar und kann dort gehandelt werden' : 'Dieser Coin ist NICHT im Binance Testnet verfügbar. Nur Production-Trading möglich.'}
          >
            {symbol.in_testnet_available ? '✓ Testnet verfügbar' : '✗ Testnet nicht verfügbar'}
          </span>
        )}
        
        {/* Status Badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            symbol.status === 'TRADING'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : symbol.status === 'BREAK'
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {symbol.status}
        </span>

        {/* Spot Trading */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            symbol.isSpotTradingAllowed
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : 'bg-gray-100 text-gray-800 border border-gray-200'
          }`}
        >
          Spot: {symbol.isSpotTradingAllowed ? '✓' : '✗'}
        </span>

        {/* Market Order in USDT */}
        {symbol.quoteOrderQtyMarketAllowed && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            Market Order in USDT möglich
          </span>
        )}

        {/* Trailing Stop */}
        {symbol.allowTrailingStop && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
            Trailing Stop ✓
          </span>
        )}
      </div>

      {/* Asset Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block text-xs mb-1">
            Base Asset
            <InfoTooltip content={TOOLTIPS.baseAsset} />
          </span>
          <span className="font-medium text-gray-900">{symbol.baseAsset}</span>
          <span className="text-xs text-gray-400 ml-1">
            (Prec: {symbol.baseAssetPrecision}
            <InfoTooltip content={TOOLTIPS.baseAssetPrecision} />)
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-xs mb-1">
            Quote Asset
            <InfoTooltip content={TOOLTIPS.quoteAsset} />
          </span>
          <span className="font-medium text-gray-900">{symbol.quoteAsset}</span>
          <span className="text-xs text-gray-400 ml-1">
            (Prec: {symbol.quoteAssetPrecision}
            <InfoTooltip content={TOOLTIPS.quoteAssetPrecision} />)
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-xs mb-1">
            Quote Precision
            <InfoTooltip content={TOOLTIPS.quotePrecision} />
          </span>
          <span className="font-medium text-gray-900">{symbol.quotePrecision}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-xs mb-1">
            Margin Trading
            <InfoTooltip content={TOOLTIPS.isMarginTradingAllowed} />
          </span>
          <span className="font-medium text-gray-900">
            {symbol.isMarginTradingAllowed ? '✓ Ja' : '✗ Nein'}
          </span>
        </div>
      </div>

      {/* Order Types */}
      <div>
        <span className="text-gray-500 block text-xs mb-2">Erlaubte Order-Types:</span>
        <div className="flex flex-wrap gap-1">
          {symbol.orderTypes.map((type, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
            >
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Price Filter */}
      {priceFilter && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <h4 className="text-xs font-semibold text-blue-900 mb-2">📊 Preis-Filter (PRICE_FILTER)</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-blue-700 block mb-1">
                Min Price
                <InfoTooltip content={TOOLTIPS.priceFilterMinPrice} />
              </span>
              <span className="font-mono text-blue-900 font-medium">
                {formatValue(priceFilter.minPrice)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 block mb-1">
                Max Price
                <InfoTooltip content={TOOLTIPS.priceFilterMaxPrice} />
              </span>
              <span className="font-mono text-blue-900 font-medium">
                {formatValue(priceFilter.maxPrice)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 block mb-1">
                Tick Size
                <InfoTooltip content={TOOLTIPS.priceFilterTickSize} />
              </span>
              <span className="font-mono text-blue-900 font-medium">
                {formatValue(priceFilter.tickSize)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Lot Size Filter */}
      {lotSizeFilter && (
        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
          <h4 className="text-xs font-semibold text-green-900 mb-2">📦 Mengen-Filter (LOT_SIZE)</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-green-700 block mb-1">
                Min Qty
                <InfoTooltip content={TOOLTIPS.lotSizeMinQty} />
              </span>
              <span className="font-mono text-green-900 font-medium">
                {formatValue(lotSizeFilter.minQty)}
              </span>
            </div>
            <div>
              <span className="text-green-700 block mb-1">
                Max Qty
                <InfoTooltip content={TOOLTIPS.lotSizeMaxQty} />
              </span>
              <span className="font-mono text-green-900 font-medium">
                {formatValue(lotSizeFilter.maxQty)}
              </span>
            </div>
            <div>
              <span className="text-green-700 block mb-1">
                Step Size
                <InfoTooltip content={TOOLTIPS.lotSizeStepSize} />
              </span>
              <span className="font-mono text-green-900 font-medium">
                {formatValue(lotSizeFilter.stepSize)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notional Filter */}
      {notionalFilter && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <h4 className="text-xs font-semibold text-amber-900 mb-2">💰 Mindest-/Maximalwert (NOTIONAL)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-amber-700 block mb-1">
                Min Notional
                <InfoTooltip content={TOOLTIPS.notionalMinNotional} />
              </span>
              <span className="font-mono text-amber-900 font-medium">
                {formatValue(notionalFilter.minNotional)}
              </span>
            </div>
            {notionalFilter.maxNotional && (
              <div>
                <span className="text-amber-700 block mb-1">
                  Max Notional
                  <InfoTooltip content={TOOLTIPS.notionalMaxNotional} />
                </span>
                <span className="font-mono text-amber-900 font-medium">
                  {formatValue(notionalFilter.maxNotional)}
                </span>
              </div>
            )}
            <div>
              <span className="text-amber-700 block mb-1">
                Apply to Market
                <InfoTooltip content={TOOLTIPS.notionalApplyMinToMarket} />
              </span>
              <span className="font-mono text-amber-900 font-medium">
                {notionalFilter.applyMinToMarket ? '✓ Ja' : '✗ Nein'}
              </span>
            </div>
            {notionalFilter.avgPriceMins !== undefined && (
              <div>
                <span className="text-amber-700 block mb-1">Avg Price Mins</span>
                <span className="font-mono text-amber-900 font-medium">
                  {notionalFilter.avgPriceMins}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

