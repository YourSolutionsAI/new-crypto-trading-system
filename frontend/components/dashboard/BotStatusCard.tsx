'use client';

import { useEffect, useState } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { Power, Activity, Wifi, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export function BotStatusCard() {
  const { botStatus, setBotStatus } = useTradingStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBotStatus();
  }, []);

  const loadBotStatus = async () => {
    try {
      const status = await api.getStatus();
      setBotStatus(status);
    } catch (error) {
      console.error('Error loading bot status:', error);
      toast.error('Fehler beim Laden des Bot-Status');
    }
  };

  const handleToggleBot = async () => {
    setLoading(true);
    try {
      if (botStatus?.status === 'running') {
        const result = await api.stopBot();
        if (result.success) {
          toast.success('Bot wurde gestoppt');
          setBotStatus({ ...botStatus, status: 'stopped', timestamp: new Date().toISOString() });
        }
      } else {
        const result = await api.startBot();
        if (result.success) {
          toast.success('Bot wurde gestartet');
          setBotStatus({ ...result.data, status: 'running', timestamp: new Date().toISOString() });
        }
      }
    } catch (error) {
      console.error('Error toggling bot:', error);
      toast.error('Fehler beim Ändern des Bot-Status');
    } finally {
      setLoading(false);
      // Reload status after action
      setTimeout(loadBotStatus, 1000);
    }
  };

  const isRunning = botStatus?.status === 'running';

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Bot Status
        </h2>
        <button
          onClick={handleToggleBot}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isRunning
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-green-500 hover:bg-green-600 text-white"
          )}
        >
          <Power className="h-4 w-4" />
          {loading ? 'Lädt...' : isRunning ? 'Stoppen' : 'Starten'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isRunning ? "bg-green-500 animate-pulse" : "bg-red-500"
            )} />
            <span className={cn(
              "font-medium",
              isRunning ? "text-green-500" : "text-red-500"
            )}>
              {isRunning ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
        </div>

        {botStatus?.tradingBotProcessCount !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Aktive Prozesse</span>
            <span className="font-medium">{botStatus.tradingBotProcessCount}</span>
          </div>
        )}

        {botStatus?.version && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">{botStatus.version}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Letztes Update</span>
          <span className="text-sm">
            {botStatus ? formatDate(botStatus.timestamp) : '-'}
          </span>
        </div>
      </div>

      {isRunning && (
        <div className="mt-4 p-3 bg-green-500/10 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">
            Der Bot handelt aktiv. Alle Strategien werden überwacht.
          </p>
        </div>
      )}
    </div>
  );
}
