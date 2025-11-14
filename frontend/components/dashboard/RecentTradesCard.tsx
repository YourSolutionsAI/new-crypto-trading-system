'use client';

import { useEffect } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { History, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function RecentTradesCard() {
  const { trades, setTrades } = useTradingStore();

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    try {
      const data = await api.getTrades(10); // Load last 10 trades
      setTrades(data);
    } catch (error) {
      console.error('Error loading trades:', error);
    }
  };

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Letzte Trades
        </h2>
        <button
          onClick={loadTrades}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Aktualisieren
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="py-12 text-center">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Noch keine Trades ausgeführt</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          <AnimatePresence>
            {trades.slice(0, 10).map((trade, index) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      trade.side === 'BUY' ? "bg-green-500/10" : "bg-red-500/10"
                    )}>
                      {trade.side === 'BUY' ? (
                        <ArrowDownCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowUpCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{trade.symbol.replace('USDT', '')}</h4>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium",
                          trade.side === 'BUY' 
                            ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                        )}>
                          {trade.side}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{trade.quantity} @ {formatCurrency(trade.price)}</span>
                        <span>•</span>
                        <span>{formatDate(trade.created_at)}</span>
                      </div>

                      {trade.metadata?.signal && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Signal:</span>
                          <span className="text-xs font-medium">
                            {trade.metadata.signal}
                            {trade.metadata.confidence && 
                              ` (${(trade.metadata.confidence * 100).toFixed(0)}%)`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {trade.pnl !== undefined && trade.side === 'SELL' && (
                      <>
                        <p className={cn(
                          "font-bold",
                          trade.pnl >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {formatCurrency(trade.pnl)}
                        </p>
                        <p className="text-xs text-muted-foreground">PnL</p>
                      </>
                    )}
                    {trade.status && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        trade.status === 'FILLED' 
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      )}>
                        {trade.status}
                      </span>
                    )}
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
