// Live Prices Component

'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useBotStore } from '@/store/botStore';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function LivePrices() {
  const { livePrices, updateLivePrice, strategies } = useBotStore();

  useEffect(() => {
    // Abonniere Realtime-Updates für bot_logs (enthält Preis-Updates)
    const channel = supabase
      .channel('live-prices')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bot_logs',
          filter: 'level=info',
        },
        (payload) => {
          // Parse Preis-Updates aus Logs
          const data = payload.new.data as any;
          if (data?.symbol && data?.price) {
            updateLivePrice(data.symbol, {
              symbol: data.symbol,
              price: data.price,
              change24h: data.change24h,
              changePercent24h: data.changePercent24h,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateLivePrice]);

  // Erstelle Liste der Symbole aus aktiven Strategien
  const symbols = Array.from(
    new Set(strategies.filter((s) => s.active).map((s) => s.symbol || s.name.split(' ')[0]))
  );

  const pricesArray = Array.from(livePrices.values());

  return (
    <Card title="Live-Preise">
      {pricesArray.length > 0 ? (
        <div className="space-y-3">
          {pricesArray.map((price) => (
            <div
              key={price.symbol}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {price.symbol}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${price.price.toLocaleString('de-DE', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8,
                  })}
                </p>
              </div>
              {price.changePercent24h !== undefined && (
                <Badge
                  variant={
                    price.changePercent24h >= 0 ? 'success' : 'danger'
                  }
                >
                  {price.changePercent24h >= 0 ? '+' : ''}
                  {price.changePercent24h.toFixed(2)}%
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Warte auf Preis-Updates...
          </p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Aktive Strategien: {symbols.length}
          </p>
        </div>
      )}
    </Card>
  );
}

