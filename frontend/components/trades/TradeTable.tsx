'use client';

import { Trade } from '@/lib/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface TradeTableProps {
  trades: Trade[];
  loading?: boolean;
}

export function TradeTable({ trades, loading }: TradeTableProps) {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Lade Trades...</p>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">Keine Trades gefunden</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="text-left p-4 font-medium text-sm">Datum</th>
            <th className="text-left p-4 font-medium text-sm">Symbol</th>
            <th className="text-left p-4 font-medium text-sm">Seite</th>
            <th className="text-right p-4 font-medium text-sm">Menge</th>
            <th className="text-right p-4 font-medium text-sm">Preis</th>
            <th className="text-right p-4 font-medium text-sm">Wert</th>
            <th className="text-right p-4 font-medium text-sm">PnL</th>
            <th className="text-left p-4 font-medium text-sm">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {trades.map((trade) => (
            <tr key={trade.id} className="hover:bg-muted/30 transition-colors">
              <td className="p-4 text-sm">
                {formatDate(trade.created_at)}
              </td>
              <td className="p-4">
                <span className="font-medium">{trade.symbol.replace('USDT', '')}</span>
                <span className="text-muted-foreground">/USDT</span>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  {trade.side === 'BUY' ? (
                    <ArrowDownCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className={cn(
                    "font-medium",
                    trade.side === 'BUY' ? "text-green-500" : "text-red-500"
                  )}>
                    {trade.side}
                  </span>
                </div>
              </td>
              <td className="p-4 text-right font-mono text-sm">
                {trade.quantity.toFixed(8)}
              </td>
              <td className="p-4 text-right font-mono text-sm">
                {formatCurrency(trade.price)}
              </td>
              <td className="p-4 text-right font-mono text-sm">
                {formatCurrency(trade.quantity * trade.price)}
              </td>
              <td className="p-4 text-right">
                {trade.pnl !== undefined && trade.side === 'SELL' ? (
                  <span className={cn(
                    "font-semibold",
                    trade.pnl >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-4">
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  trade.status === 'FILLED' 
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                )}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
