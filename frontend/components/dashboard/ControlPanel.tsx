// Bot Control Panel Component

'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useBotStore } from '@/store/botStore';
import { useState } from 'react';
import { apiClient } from '@/lib/api';

export function ControlPanel() {
  const { botStatus, setBotStatus, setLoading, setError } = useBotStore();
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.startBot();
      setBotStatus({ status: response.status as any, timestamp: new Date().toISOString() });
      
      // Status nach kurzer Verzögerung aktualisieren
      setTimeout(async () => {
        const status = await apiClient.getStatus();
        setBotStatus(status);
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Fehler beim Starten des Bots');
      console.error('Fehler beim Starten:', error);
    } finally {
      setIsStarting(false);
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.stopBot();
      setBotStatus({ status: response.status as any, timestamp: new Date().toISOString() });
      
      // Status nach kurzer Verzögerung aktualisieren
      setTimeout(async () => {
        const status = await apiClient.getStatus();
        setBotStatus(status);
      }, 1000);
    } catch (error: any) {
      setError(error.message || 'Fehler beim Stoppen des Bots');
      console.error('Fehler beim Stoppen:', error);
    } finally {
      setIsStopping(false);
      setLoading(false);
    }
  };

  const isRunning = botStatus?.status === 'läuft';
  const isStopped = botStatus?.status === 'gestoppt';

  return (
    <Card title="Bot-Steuerung">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Button
          variant="success"
          onClick={handleStart}
          disabled={isRunning || isStarting || isStopping}
          isLoading={isStarting}
          className="flex-1"
        >
          Bot starten
        </Button>
        <Button
          variant="danger"
          onClick={handleStop}
          disabled={isStopped || isStarting || isStopping}
          isLoading={isStopping}
          className="flex-1"
        >
          Bot stoppen
        </Button>
      </div>
      {useBotStore.getState().error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {useBotStore.getState().error}
        </div>
      )}
    </Card>
  );
}

