'use client';

import { useMemo } from 'react';
import { useTradingStore } from '@/lib/store';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TRACKED_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT', 
  'BNBUSDT',
  'SOLUSDT',
  'DOGEUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'SHIBUSDT',
];

interface PriceCardProps {
  symbol: string;
  price: number;
  change24h: number;
  change24hPercent: number;
  volume24h?: number;
}

function PriceCard({ symbol, price, change24h, change24hPercent, volume24h }: PriceCardProps) {
  const isPositive = change24hPercent >= 0;
  const displaySymbol = symbol.replace('USDT', '');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "p-4 rounded-lg border transition-all duration-300 hover:scale-105",
        "bg-card hover:shadow-lg cursor-pointer",
        isPositive ? "hover:border-green-500/50" : "hover:border-red-500/50"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-lg">{displaySymbol}</h3>
          <p className="text-sm text-muted-foreground">USDT</p>
        </div>
        <div className={cn(
          "p-2 rounded-full",
          isPositive ? "bg-green-500/10" : "bg-red-500/10"
        )}>
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">
            {formatCurrency(price)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">24h Änderung</span>
          <span className={cn(
            "text-sm font-medium",
            isPositive ? "text-green-500" : "text-red-500"
          )}>
            {formatPercent(change24hPercent)}
          </span>
        </div>

        {volume24h && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">24h Volumen</span>
            <span className="text-sm font-medium">
              {formatCurrency(volume24h)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function LivePricesCard() {
  const marketData = useTradingStore((state) => state.marketData);

  const prices = useMemo(() => {
    return TRACKED_SYMBOLS.map(symbol => {
      const data = marketData[symbol];
      return {
        symbol,
        price: data?.price || 0,
        change24h: data?.change24h || 0,
        change24hPercent: data?.change24hPercent || 0,
        volume24h: data?.volume24h,
      };
    });
  }, [marketData]);

  const hasData = prices.some(p => p.price > 0);

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Live Preise
        </h2>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
      </div>

      {!hasData ? (
        <div className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Warte auf Marktdaten...</p>
          <p className="text-sm text-muted-foreground mt-1">
            Stellen Sie sicher, dass der Bot läuft
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {prices.map((price) => (
              <PriceCard key={price.symbol} {...price} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
