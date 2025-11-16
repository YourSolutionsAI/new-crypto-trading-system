// Komponente für die immer sichtbaren Kerninformationen eines Coins
import React from 'react';
import type { BinanceSymbol } from '@/lib/binance-types';
import { InfoTooltip } from './InfoTooltip';

interface CoinCoreInfoProps {
  symbol: BinanceSymbol;
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
        {/* Status Badge */}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            symbol.status === 'TRADING'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : symbol.status === 'BREAK'
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
          title={
            symbol.status === 'TRADING' 
              ? 'Trading ist aktiv - Orders können platziert werden'
              : symbol.status === 'BREAK'
              ? 'Trading ist pausiert - Neue Orders werden nicht akzeptiert'
              : 'Trading ist deaktiviert - Keine Orders möglich'
          }
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
          title="Spot Trading erlaubt den direkten Kauf/Verkauf von Kryptowährungen ohne Hebelwirkung"
        >
          Spot: {symbol.isSpotTradingAllowed ? '✓' : '✗'}
        </span>

        {/* Market Order in USDT */}
        {symbol.quoteOrderQtyMarketAllowed && (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
            title="Erlaubt Market Orders, bei denen die Menge in USDT (Quote Asset) angegeben wird statt in Base Asset"
          >
            Market Order in USDT möglich
          </span>
        )}

        {/* Trailing Stop */}
        {symbol.allowTrailingStop && (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200"
            title="Trailing Stop erlaubt automatische Stop-Loss Orders, die dem Preis folgen und so Gewinne schützen"
          >
            Trailing Stop ✓
          </span>
        )}
      </div>

      {/* Asset Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500 block text-xs mb-1 flex items-center gap-1">
            Base Asset
            <InfoTooltip content="Das Base Asset ist die erste Währung im Trading-Paar (z.B. BTC in BTCUSDT).\n\nDies ist die Währung, die Sie kaufen oder verkaufen.\n\nPrecision gibt an, wie viele Dezimalstellen für dieses Asset unterstützt werden." />
          </span>
          <span className="font-medium text-gray-900">{symbol.baseAsset}</span>
          <span className="text-xs text-gray-400 ml-1 flex items-center gap-1">
            (Prec: {symbol.baseAssetPrecision})
            <InfoTooltip content="Base Asset Precision: Anzahl der Dezimalstellen für das Base Asset.\n\nBeispiel: Bei Precision 8 können Mengen wie 0.00000001 BTC angegeben werden.\n\nWichtig für die korrekte Mengenberechnung bei Orders." />
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-xs mb-1 flex items-center gap-1">
            Quote Asset
            <InfoTooltip content="Das Quote Asset ist die zweite Währung im Trading-Paar (z.B. USDT in BTCUSDT).\n\nDies ist die Währung, mit der Sie das Base Asset kaufen oder verkaufen.\n\nPrecision gibt an, wie viele Dezimalstellen für dieses Asset unterstützt werden." />
          </span>
          <span className="font-medium text-gray-900">{symbol.quoteAsset}</span>
          <span className="text-xs text-gray-400 ml-1 flex items-center gap-1">
            (Prec: {symbol.quoteAssetPrecision})
            <InfoTooltip content="Quote Asset Precision: Anzahl der Dezimalstellen für das Quote Asset.\n\nBeispiel: Bei Precision 2 können Beträge wie 10.00 oder 10.50 USDT angegeben werden.\n\nWichtig für die korrekte Preisberechnung bei Orders." />
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-xs mb-1 flex items-center gap-1">
            Quote Precision
            <InfoTooltip content="Die Quote Precision bestimmt, wie viele Dezimalstellen für den Preis (in Quote Asset) verwendet werden können.\n\nBeispiel: Bei Precision 2 können Preise wie 50.00 oder 50.12 angegeben werden, aber nicht 50.123.\n\nWichtig für die korrekte Preisangabe bei Orders." />
          </span>
          <span className="font-medium text-gray-900">{symbol.quotePrecision}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-xs mb-1 flex items-center gap-1">
            Margin Trading
            <InfoTooltip content="Margin Trading erlaubt es, mit geliehenen Mitteln zu handeln (Hebelwirkung).\n\nWenn aktiviert, können Sie Positionen mit mehr Kapital eröffnen als Sie besitzen.\n\nAchtung: Margin Trading birgt höhere Risiken durch mögliche Liquidationsverluste." />
          </span>
          <span className="font-medium text-gray-900">
            {symbol.isMarginTradingAllowed ? '✓ Ja' : '✗ Nein'}
          </span>
        </div>
      </div>

      {/* Order Types */}
      <div>
        <span className="text-gray-500 block text-xs mb-2 flex items-center gap-1">
          Erlaubte Order-Types:
          <InfoTooltip content="Order-Types definieren, welche Arten von Orders für dieses Trading-Paar möglich sind:\n\n• LIMIT: Order zu einem festen Preis\n• MARKET: Sofortige Ausführung zum aktuellen Marktpreis\n• STOP_LOSS: Automatischer Verkauf bei Erreichen eines Stop-Preises\n• STOP_LOSS_LIMIT: Stop-Loss mit Limit-Preis\n• TAKE_PROFIT: Automatischer Verkauf bei Erreichen eines Gewinnziels\n• TAKE_PROFIT_LIMIT: Take-Profit mit Limit-Preis\n• ICEBERG: Große Orders werden in kleine Teile aufgeteilt" />
        </span>
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
          <h4 className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1">
            📊 Preis-Filter (PRICE_FILTER)
            <InfoTooltip content="Der Preis-Filter definiert die Regeln für gültige Preise bei Orders:\n\n• Min Price: Der niedrigste Preis, zu dem eine Order platziert werden kann\n• Max Price: Der höchste Preis, zu dem eine Order platziert werden kann\n• Tick Size: Die kleinste Preisänderung, die möglich ist (z.B. 0.01 bedeutet Preise müssen Vielfache von 0.01 sein)\n\nBeispiel: Bei Tick Size 0.01 sind Preise wie 50.00 oder 50.01 erlaubt, aber nicht 50.005." />
          </h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-blue-700 block mb-1 flex items-center gap-1">
                Min Price
                <InfoTooltip content="Der niedrigste Preis, zu dem eine Order platziert werden kann.\n\nOrders mit einem niedrigeren Preis werden von Binance abgelehnt.\n\nWichtig für die Validierung von Limit-Orders." />
              </span>
              <span className="font-mono text-blue-900 font-medium">
                {formatValue(priceFilter.minPrice)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 block mb-1 flex items-center gap-1">
                Max Price
                <InfoTooltip content="Der höchste Preis, zu dem eine Order platziert werden kann.\n\nOrders mit einem höheren Preis werden von Binance abgelehnt.\n\nSchützt vor versehentlich zu hohen Preisen." />
              </span>
              <span className="font-mono text-blue-900 font-medium">
                {formatValue(priceFilter.maxPrice)}
              </span>
            </div>
            <div>
              <span className="text-blue-700 block mb-1 flex items-center gap-1">
                Tick Size
                <InfoTooltip content="Die kleinste mögliche Preisänderung.\n\nPreise müssen Vielfache des Tick Size sein.\n\nBeispiel: Bei Tick Size 0.01 sind Preise wie 50.00, 50.01, 50.02 erlaubt, aber nicht 50.005.\n\nWichtig für die korrekte Preisberechnung bei automatisierten Trades." />
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
          <h4 className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1">
            📦 Mengen-Filter (LOT_SIZE)
            <InfoTooltip content="Der Mengen-Filter definiert die Regeln für die Handelsmenge (in Base Asset):\n\n• Min Qty: Die minimale Menge, die gehandelt werden kann\n• Max Qty: Die maximale Menge, die in einer Order gehandelt werden kann\n• Step Size: Die kleinste Mengenänderung (Mengen müssen Vielfache davon sein)\n\nBeispiel: Bei Step Size 0.001 sind Mengen wie 0.100, 0.101, 0.102 erlaubt, aber nicht 0.1005.\n\nWichtig für die korrekte Mengenberechnung bei automatisierten Trades." />
          </h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-green-700 block mb-1 flex items-center gap-1">
                Min Qty
                <InfoTooltip content="Die minimale Handelsmenge in Base Asset.\n\nOrders mit einer kleineren Menge werden von Binance abgelehnt.\n\nBeispiel: Bei BTCUSDT könnte Min Qty 0.00001 BTC sein.\n\nWichtig: Bei sehr kleinen Beträgen kann diese Grenze erreicht werden." />
              </span>
              <span className="font-mono text-green-900 font-medium">
                {formatValue(lotSizeFilter.minQty)}
              </span>
            </div>
            <div>
              <span className="text-green-700 block mb-1 flex items-center gap-1">
                Max Qty
                <InfoTooltip content="Die maximale Handelsmenge in Base Asset pro Order.\n\nOrders mit einer größeren Menge werden von Binance abgelehnt.\n\nFür größere Trades müssen mehrere Orders platziert werden.\n\nWichtig für Risikomanagement bei großen Positionen." />
              </span>
              <span className="font-mono text-green-900 font-medium">
                {formatValue(lotSizeFilter.maxQty)}
              </span>
            </div>
            <div>
              <span className="text-green-700 block mb-1 flex items-center gap-1">
                Step Size
                <InfoTooltip content="Die kleinste mögliche Mengenänderung.\n\nMengen müssen Vielfache des Step Size sein.\n\nBeispiel: Bei Step Size 0.001 sind Mengen wie 0.100, 0.101, 0.102 erlaubt, aber nicht 0.1005.\n\nWichtig für die korrekte Mengenberechnung - nicht erfüllte Mengen werden automatisch angepasst." />
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
          <h4 className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
            💰 Mindest-/Maximalwert (NOTIONAL)
            <InfoTooltip content="Der Notional-Filter definiert den Mindest- und Maximalwert einer Order in Quote Asset (z.B. USDT):\n\n• Min Notional: Der Mindestwert der Order (Preis × Menge)\n• Max Notional: Der Maximalwert der Order\n• Apply to Market: Ob die Min Notional auch für Market Orders gilt\n• Avg Price Mins: Zeitfenster für die Durchschnittspreisberechnung\n\nBeispiel: Bei Min Notional 10 USDT muss eine Order mindestens 10 USDT wert sein.\n\nWichtig: Verhindert zu kleine Orders, die nicht wirtschaftlich sind." />
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-amber-700 block mb-1 flex items-center gap-1">
                Min Notional
                <InfoTooltip content="Der Mindestwert einer Order in Quote Asset (z.B. USDT).\n\nBerechnet als: Preis × Menge\n\nOrders mit einem niedrigeren Wert werden abgelehnt.\n\nBeispiel: Bei Min Notional 10 USDT muss eine Order mindestens 10 USDT wert sein.\n\nWichtig: Verhindert zu kleine Orders, die nicht wirtschaftlich sind." />
              </span>
              <span className="font-mono text-amber-900 font-medium">
                {formatValue(notionalFilter.minNotional)}
              </span>
            </div>
            {notionalFilter.maxNotional && (
              <div>
                <span className="text-amber-700 block mb-1 flex items-center gap-1">
                  Max Notional
                  <InfoTooltip content="Der Maximalwert einer Order in Quote Asset (z.B. USDT).\n\nBerechnet als: Preis × Menge\n\nOrders mit einem höheren Wert werden abgelehnt.\n\nFür größere Trades müssen mehrere Orders platziert werden.\n\nWichtig für Risikomanagement bei sehr großen Positionen." />
                </span>
                <span className="font-mono text-amber-900 font-medium">
                  {formatValue(notionalFilter.maxNotional)}
                </span>
              </div>
            )}
            <div>
              <span className="text-amber-700 block mb-1 flex items-center gap-1">
                Apply to Market
                <InfoTooltip content="Gibt an, ob die Min Notional auch für Market Orders gilt.\n\nWenn aktiviert, müssen auch Market Orders den Mindestwert erreichen.\n\nWenn deaktiviert, gelten für Market Orders andere Regeln.\n\nWichtig: Market Orders werden sofort ausgeführt, daher kann der tatsächliche Wert leicht abweichen." />
              </span>
              <span className="font-mono text-amber-900 font-medium">
                {notionalFilter.applyMinToMarket ? '✓ Ja' : '✗ Nein'}
              </span>
            </div>
            {notionalFilter.avgPriceMins !== undefined && (
              <div>
                <span className="text-amber-700 block mb-1 flex items-center gap-1">
                  Avg Price Mins
                  <InfoTooltip content="Zeitfenster in Minuten für die Durchschnittspreisberechnung.\n\nWird verwendet, um den Durchschnittspreis über einen bestimmten Zeitraum zu berechnen.\n\nWichtig für die Validierung von Orders basierend auf dem durchschnittlichen Marktpreis.\n\nBeispiel: Bei 5 Minuten wird der Durchschnittspreis der letzten 5 Minuten verwendet." />
                </span>
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

