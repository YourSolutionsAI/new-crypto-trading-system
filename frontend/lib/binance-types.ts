// Binance Exchange Info Types
// Basierend auf https://api.binance.com/api/v3/exchangeInfo

export interface BinanceRateLimit {
  rateLimitType: 'REQUEST_WEIGHT' | 'ORDERS' | 'RAW_REQUESTS';
  interval: 'SECOND' | 'MINUTE' | 'DAY';
  intervalNum: number;
  limit: number;
}

export interface BinanceFilter {
  filterType: string;
  [key: string]: any;
}

export interface PriceFilter extends BinanceFilter {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

export interface LotSizeFilter extends BinanceFilter {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface MarketLotSizeFilter extends BinanceFilter {
  filterType: 'MARKET_LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface IcebergPartsFilter extends BinanceFilter {
  filterType: 'ICEBERG_PARTS';
  limit: number;
}

export interface NotionalFilter extends BinanceFilter {
  filterType: 'NOTIONAL';
  minNotional: string;
  applyMinToMarket: boolean;
  maxNotional?: string;
  applyMaxToMarket?: boolean;
  avgPriceMins?: number;
}

export interface TrailingDeltaFilter extends BinanceFilter {
  filterType: 'TRAILING_DELTA';
  minTrailingAboveDelta: number;
  maxTrailingAboveDelta: number;
  minTrailingBelowDelta: number;
  maxTrailingBelowDelta: number;
}

export interface PercentPriceBySideFilter extends BinanceFilter {
  filterType: 'PERCENT_PRICE_BY_SIDE';
  bidMultiplierUp: string;
  bidMultiplierDown: string;
  askMultiplierUp: string;
  askMultiplierDown: string;
  avgPriceMins: number;
}

export interface MaxNumOrdersFilter extends BinanceFilter {
  filterType: 'MAX_NUM_ORDERS';
  maxNumOrders: number;
}

export interface MaxNumOrderListsFilter extends BinanceFilter {
  filterType: 'MAX_NUM_ORDER_LISTS';
  maxNumOrderLists: number;
}

export interface MaxNumAlgoOrdersFilter extends BinanceFilter {
  filterType: 'MAX_NUM_ALGO_ORDERS';
  maxNumAlgoOrders: number;
}

export interface MaxNumOrderAmendsFilter extends BinanceFilter {
  filterType: 'MAX_NUM_ORDER_AMENDS';
  maxNumOrderAmends: number;
}

export type BinanceSymbolFilter =
  | PriceFilter
  | LotSizeFilter
  | MarketLotSizeFilter
  | IcebergPartsFilter
  | NotionalFilter
  | TrailingDeltaFilter
  | PercentPriceBySideFilter
  | MaxNumOrdersFilter
  | MaxNumOrderListsFilter
  | MaxNumAlgoOrdersFilter
  | MaxNumOrderAmendsFilter;

export interface BinanceSymbol {
  symbol: string;
  status: 'TRADING' | 'BREAK' | 'HALT' | 'PRE_TRADING' | 'POST_TRADING';
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  otoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  amendAllowed: boolean;
  pegInstructionsAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: BinanceSymbolFilter[];
  permissions: string[];
  permissionSets?: string[][];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}

export interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: BinanceRateLimit[];
  exchangeFilters: any[];
  symbols: BinanceSymbol[];
}

// Helper Types für gefilterte Symbole
export interface SpotUSDTSymbol extends BinanceSymbol {
  quoteAsset: 'USDT';
  isSpotTradingAllowed: true;
}

// Cache-Interface für Exchange Info
export interface ExchangeInfoCache {
  data: BinanceExchangeInfo | null;
  timestamp: number;
  isLoading: boolean;
  error: string | null;
}

