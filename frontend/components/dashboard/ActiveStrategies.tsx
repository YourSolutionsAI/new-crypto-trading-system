// Active Strategies Component

'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useBotStore } from '@/store/botStore';
import { useEffect } from 'react';
import { getStrategies } from '@/lib/supabase';
import type { Strategy } from '@/types/api';

export function ActiveStrategies() {
  const { strategies, setStrategies } = useBotStore();

  useEffect(() => {
    loadStrategies();
    
    // Reload alle 30 Sekunden
    const interval = setInterval(loadStrategies, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await getStrategies();
      setStrategies(data as Strategy[]);
    } catch (error) {
      console.error('Fehler beim Laden der Strategien:', error);
    }
  };

  const activeStrategies = strategies.filter((s) => s.active);
  const inactiveStrategies = strategies.filter((s) => !s.active);

  return (
    <Card title="Strategien">
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Aktiv ({activeStrategies.length})
          </h4>
          {activeStrategies.length > 0 ? (
            <div className="space-y-2">
              {activeStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {strategy.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {strategy.symbol || 'N/A'}
                    </p>
                  </div>
                  <Badge variant="success">Aktiv</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Keine aktiven Strategien
            </p>
          )}
        </div>

        {inactiveStrategies.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Inaktiv ({inactiveStrategies.length})
            </h4>
            <div className="space-y-2">
              {inactiveStrategies.slice(0, 3).map((strategy) => (
                <div
                  key={strategy.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 opacity-60 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {strategy.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {strategy.symbol || 'N/A'}
                    </p>
                  </div>
                  <Badge variant="neutral">Inaktiv</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

