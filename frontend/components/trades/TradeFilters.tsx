'use client';

import { Filter, Calendar, TrendingUp } from 'lucide-react';

interface TradeFiltersProps {
  filters: {
    symbol: string;
    side: string;
    dateRange: string;
  };
  onFiltersChange: (filters: any) => void;
  symbols: string[];
}

export function TradeFilters({ filters, onFiltersChange, symbols }: TradeFiltersProps) {
  return (
    <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
        </div>

        {/* Symbol Filter */}
        <select
          value={filters.symbol}
          onChange={(e) => onFiltersChange({ ...filters, symbol: e.target.value })}
          className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:border-primary outline-none"
        >
          <option value="all">Alle Symbole</option>
          {symbols.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol.replace('USDT', '')}
            </option>
          ))}
        </select>

        {/* Side Filter */}
        <select
          value={filters.side}
          onChange={(e) => onFiltersChange({ ...filters, side: e.target.value })}
          className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:border-primary outline-none"
        >
          <option value="all">Alle Seiten</option>
          <option value="BUY">Nur Käufe</option>
          <option value="SELL">Nur Verkäufe</option>
        </select>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <select
            value={filters.dateRange}
            onChange={(e) => onFiltersChange({ ...filters, dateRange: e.target.value })}
            className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm focus:border-primary outline-none"
          >
            <option value="1d">Letzter Tag</option>
            <option value="7d">Letzte 7 Tage</option>
            <option value="30d">Letzte 30 Tage</option>
            <option value="all">Alle Zeit</option>
          </select>
        </div>

        {/* Quick Stats */}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">
              {symbols.length} Symbole aktiv
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
