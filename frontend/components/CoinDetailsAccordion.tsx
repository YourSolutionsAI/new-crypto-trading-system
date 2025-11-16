// Accordion-Komponente für erweiterte Coin-Details
import React, { useState } from 'react';
import type { BinanceSymbol, BinanceSymbolFilter } from '@/lib/binance-types';
import InfoTooltip from './InfoTooltip';
import { TOOLTIPS } from '@/lib/tooltips';

interface CoinDetailsAccordionProps {
  symbol: BinanceSymbol;
  className?: string;
}

// Helper: Finde spezifischen Filter nach Type
const findFilter = <T extends BinanceSymbolFilter>(
  filters: BinanceSymbolFilter[],
  filterType: string
): T | null => {
  return (filters.find((f) => f.filterType === filterType) as T) || null;
};

// Helper: Formatiere Zahlen mit Dezimalstellen
const formatDecimal = (value: string | number | undefined): string => {
  if (value === undefined || value === null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('de-DE', { maximumFractionDigits: 8 });
};

export const CoinDetailsAccordion: React.FC<CoinDetailsAccordionProps> = ({ symbol, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter extrahieren
  const priceFilter = findFilter<any>(symbol.filters, 'PRICE_FILTER');
  const lotSizeFilter = findFilter<any>(symbol.filters, 'LOT_SIZE');
  const marketLotSizeFilter = findFilter<any>(symbol.filters, 'MARKET_LOT_SIZE');
  const notionalFilter = findFilter<any>(symbol.filters, 'NOTIONAL');
  const icebergPartsFilter = findFilter<any>(symbol.filters, 'ICEBERG_PARTS');
  const trailingDeltaFilter = findFilter<any>(symbol.filters, 'TRAILING_DELTA');
  const percentPriceFilter = findFilter<any>(symbol.filters, 'PERCENT_PRICE_BY_SIDE');
  const maxNumOrdersFilter = findFilter<any>(symbol.filters, 'MAX_NUM_ORDERS');
  const maxNumOrderListsFilter = findFilter<any>(symbol.filters, 'MAX_NUM_ORDER_LISTS');
  const maxNumAlgoOrdersFilter = findFilter<any>(symbol.filters, 'MAX_NUM_ALGO_ORDERS');
  const maxNumOrderAmendsFilter = findFilter<any>(symbol.filters, 'MAX_NUM_ORDER_AMENDS');

  return (
    <div className={`border border-gray-200 rounded-md ${className}`}>
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-md"
      >
        <span className="text-sm font-medium text-gray-700">
          Erweiterte Details anzeigen
        </span>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-6">
          {/* Precision & Commission */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Precision & Gebühren
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">
                  Base Commission Precision
                  <InfoTooltip content={TOOLTIPS.baseCommissionPrecision} />:
                </span>
                <span className="ml-2 font-medium">{symbol.baseCommissionPrecision}</span>
              </div>
              <div>
                <span className="text-gray-500">
                  Quote Commission Precision
                  <InfoTooltip content={TOOLTIPS.quoteCommissionPrecision} />:
                </span>
                <span className="ml-2 font-medium">{symbol.quoteCommissionPrecision}</span>
              </div>
            </div>
          </section>

          {/* Order Features */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Order-Features
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Iceberg', value: symbol.icebergAllowed, tooltip: TOOLTIPS.icebergAllowed },
                { label: 'OCO (One-Cancels-Other)', value: symbol.ocoAllowed, tooltip: TOOLTIPS.ocoAllowed },
                { label: 'OTO (One-Triggers-Other)', value: symbol.otoAllowed, tooltip: TOOLTIPS.otoAllowed },
                { label: 'Cancel Replace', value: symbol.cancelReplaceAllowed, tooltip: TOOLTIPS.cancelReplaceAllowed },
                { label: 'Amend', value: symbol.amendAllowed, tooltip: TOOLTIPS.amendAllowed },
                { label: 'Quote Order Qty Market', value: symbol.quoteOrderQtyMarketAllowed, tooltip: TOOLTIPS.quoteOrderQtyMarketAllowed },
                { label: 'Trailing Stop', value: symbol.allowTrailingStop, tooltip: TOOLTIPS.allowTrailingStop },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full mr-2 ${
                      item.value ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-gray-700">
                    {item.label}
                    <InfoTooltip content={item.tooltip} />
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Self Trade Prevention */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Self Trade Prevention
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">
                  Default Mode
                  <InfoTooltip content={TOOLTIPS.defaultSelfTradePreventionMode} />:
                </span>
                <span className="ml-2 font-medium text-gray-900">
                  {symbol.defaultSelfTradePreventionMode}
                </span>
              </div>
              <div>
                <span className="text-gray-500">
                  Erlaubte Modi
                  <InfoTooltip content={TOOLTIPS.allowedSelfTradePreventionModes} />:
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {symbol.allowedSelfTradePreventionModes.map((mode, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Permissions */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Berechtigungen
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Permissions:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {symbol.permissions.map((perm, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
              {symbol.permissionSets && symbol.permissionSets.length > 0 && (
                <div>
                  <span className="text-gray-500">Permission Sets:</span>
                  <div className="mt-1 space-y-1">
                    {symbol.permissionSets.map((set, idx) => (
                      <div key={idx} className="flex flex-wrap gap-1 pl-4">
                        {set.map((item, itemIdx) => (
                          <span
                            key={itemIdx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Alle Filter Details */}
          <section>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Vollständige Filter-Details
            </h4>
            <div className="space-y-4">
              {/* Price Filter */}
              {priceFilter && (
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">PRICE_FILTER</h5>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Min:</span>
                      <span className="ml-1 font-mono">{formatDecimal(priceFilter.minPrice)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Max:</span>
                      <span className="ml-1 font-mono">{formatDecimal(priceFilter.maxPrice)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tick Size:</span>
                      <span className="ml-1 font-mono">{formatDecimal(priceFilter.tickSize)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Lot Size Filter */}
              {marketLotSizeFilter && (
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">MARKET_LOT_SIZE</h5>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Min Qty:</span>
                      <span className="ml-1 font-mono">{formatDecimal(marketLotSizeFilter.minQty)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Max Qty:</span>
                      <span className="ml-1 font-mono">{formatDecimal(marketLotSizeFilter.maxQty)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Step Size:</span>
                      <span className="ml-1 font-mono">{formatDecimal(marketLotSizeFilter.stepSize)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Iceberg Parts */}
              {icebergPartsFilter && (
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">ICEBERG_PARTS</h5>
                  <div className="text-xs">
                    <span className="text-gray-500">Limit:</span>
                    <span className="ml-1 font-mono">{icebergPartsFilter.limit}</span>
                  </div>
                </div>
              )}

              {/* Trailing Delta */}
              {trailingDeltaFilter && (
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">TRAILING_DELTA</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Min Above:</span>
                      <span className="ml-1 font-mono">{trailingDeltaFilter.minTrailingAboveDelta}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Max Above:</span>
                      <span className="ml-1 font-mono">{trailingDeltaFilter.maxTrailingAboveDelta}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Min Below:</span>
                      <span className="ml-1 font-mono">{trailingDeltaFilter.minTrailingBelowDelta}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Max Below:</span>
                      <span className="ml-1 font-mono">{trailingDeltaFilter.maxTrailingBelowDelta}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Percent Price By Side */}
              {percentPriceFilter && (
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">PERCENT_PRICE_BY_SIDE</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Bid Multiplier Up:</span>
                      <span className="ml-1 font-mono">{percentPriceFilter.bidMultiplierUp}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bid Multiplier Down:</span>
                      <span className="ml-1 font-mono">{percentPriceFilter.bidMultiplierDown}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ask Multiplier Up:</span>
                      <span className="ml-1 font-mono">{percentPriceFilter.askMultiplierUp}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ask Multiplier Down:</span>
                      <span className="ml-1 font-mono">{percentPriceFilter.askMultiplierDown}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Avg Price Mins:</span>
                      <span className="ml-1 font-mono">{percentPriceFilter.avgPriceMins}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Max Numbers */}
              {(maxNumOrdersFilter || maxNumOrderListsFilter || maxNumAlgoOrdersFilter || maxNumOrderAmendsFilter) && (
                <div className="bg-gray-50 rounded p-3">
                  <h5 className="text-xs font-semibold text-gray-700 mb-2">Maximale Anzahlen</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {maxNumOrdersFilter && (
                      <div>
                        <span className="text-gray-500">Max Orders:</span>
                        <span className="ml-1 font-mono">{maxNumOrdersFilter.maxNumOrders}</span>
                      </div>
                    )}
                    {maxNumOrderListsFilter && (
                      <div>
                        <span className="text-gray-500">Max Order Lists:</span>
                        <span className="ml-1 font-mono">{maxNumOrderListsFilter.maxNumOrderLists}</span>
                      </div>
                    )}
                    {maxNumAlgoOrdersFilter && (
                      <div>
                        <span className="text-gray-500">Max Algo Orders:</span>
                        <span className="ml-1 font-mono">{maxNumAlgoOrdersFilter.maxNumAlgoOrders}</span>
                      </div>
                    )}
                    {maxNumOrderAmendsFilter && (
                      <div>
                        <span className="text-gray-500">Max Order Amends:</span>
                        <span className="ml-1 font-mono">{maxNumOrderAmendsFilter.maxNumOrderAmends}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

