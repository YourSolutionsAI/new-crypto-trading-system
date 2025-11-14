'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent, formatDuration, cn } from '@/lib/utils';
import { Package, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function OpenPositionsCard() {
  const { positions, setPositions } = useTradingStore();

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadPositions = async () => {
    try {
      const data = await api.getPositions();
      setPositions(data);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.currentPrice), 0);

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Offene Positionen
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Gesamt: </span>
            <span className="font-medium">{formatCurrency(totalValue)}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">PnL: </span>
            <span className={cn(
              "font-bold",
              totalPnL >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {formatCurrency(totalPnL)}
            </span>
          </div>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Keine offenen Positionen</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          <AnimatePresence>
            {positions.map((position) => (
              <motion.div
                key={position.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{position.symbol.replace('USDT', '')}</h4>
                      <span className="text-xs text-muted-foreground">
                        {position.quantity} @ {formatCurrency(position.entryPrice)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {formatDuration(position.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Aktuell:</span>
                        <span className="font-medium">{formatCurrency(position.currentPrice)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={cn(
                      "flex items-center gap-1 justify-end mb-1",
                      position.pnl >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {position.pnl >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span className="font-bold">{formatCurrency(position.pnl)}</span>
                    </div>
                    <p className={cn(
                      "text-sm font-medium",
                      position.pnlPercent >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {formatPercent(position.pnlPercent)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
