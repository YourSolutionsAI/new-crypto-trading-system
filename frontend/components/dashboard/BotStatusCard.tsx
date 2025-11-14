// Bot Status Card Component

'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useBotStore } from '@/store/botStore';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

export function BotStatusCard() {
  const { botStatus, setBotStatus, isLoading, setLoading } = useBotStore();

  useEffect(() => {
    // Lade initialen Status
    loadStatus();

    // Polling alle 5 Sekunden
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const status = await apiClient.getStatus();
      setBotStatus(status);
    } catch (error) {
      console.error('Fehler beim Laden des Bot-Status:', error);
    }
  };

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'läuft':
        return 'success';
      case 'gestoppt':
        return 'neutral';
      case 'startet':
      case 'stoppt':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'läuft':
        return 'Aktiv';
      case 'gestoppt':
        return 'Gestoppt';
      case 'startet':
        return 'Startet...';
      case 'stoppt':
        return 'Stoppt...';
      default:
        return 'Unbekannt';
    }
  };

  return (
    <Card title="Bot-Status">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Aktueller Status</p>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={getStatusVariant(botStatus?.status || null)}>
              {getStatusText(botStatus?.status || null)}
            </Badge>
            {botStatus?.timestamp && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(botStatus.timestamp).toLocaleTimeString('de-DE')}
              </span>
            )}
          </div>
        </div>
        {isLoading && (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
        )}
      </div>
    </Card>
  );
}

