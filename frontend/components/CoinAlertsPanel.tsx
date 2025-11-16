// Komponente zur Anzeige von Coin-Alerts
import React, { useState, useEffect } from 'react';
import { getAlerts, acknowledgeAlert, acknowledgeAllAlerts } from '@/lib/api';

interface Alert {
  id: string;
  symbol: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: any;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

interface CoinAlertsPanelProps {
  symbol?: string; // Optional: Nur Alerts für bestimmten Coin
  autoRefresh?: boolean; // Auto-Refresh alle 30 Sekunden
  className?: string;
}

const severityConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    icon: '🚨',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    icon: '⚠️',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800',
    icon: 'ℹ️',
  },
};

export const CoinAlertsPanel: React.FC<CoinAlertsPanelProps> = ({
  symbol,
  autoRefresh = true,
  className = '',
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const loadAlerts = async () => {
    try {
      setError(null);
      const response = await getAlerts({
        symbol,
        acknowledged: showAcknowledged ? undefined : false,
        limit: 50,
      });

      setAlerts(response.alerts);
      setUnacknowledgedCount(response.unacknowledgedCount);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();

    // Auto-Refresh alle 30 Sekunden
    if (autoRefresh) {
      const interval = setInterval(loadAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [showAcknowledged, symbol, autoRefresh]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      await loadAlerts();
    } catch (err: any) {
      alert(`Fehler beim Bestätigen: ${err.message}`);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await acknowledgeAllAlerts({ symbol });
      await loadAlerts();
    } catch (err: any) {
      alert(`Fehler beim Bestätigen aller Alerts: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="text-center text-gray-500">Lade Alerts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-sm text-red-700">❌ {error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-medium text-gray-900">System-Alerts</h3>
            {unacknowledgedCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unacknowledgedCount} offen
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Toggle Show Acknowledged */}
            <button
              onClick={() => setShowAcknowledged(!showAcknowledged)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {showAcknowledged ? 'Nur offene anzeigen' : 'Alle anzeigen'}
            </button>

            {/* Acknowledge All Button */}
            {unacknowledgedCount > 0 && (
              <button
                onClick={handleAcknowledgeAll}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Alle bestätigen
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={loadAlerts}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              🔄 Aktualisieren
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Liste */}
      <div className="divide-y divide-gray-200">
        {alerts.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            {showAcknowledged
              ? 'Keine Alerts vorhanden'
              : '✅ Keine offenen Alerts'}
          </div>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity];

            return (
              <div
                key={alert.id}
                className={`px-6 py-4 ${
                  alert.is_acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Alert Header */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-2xl">{config.icon}</span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badge}`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {alert.symbol}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(alert.created_at).toLocaleString('de-DE')}
                      </span>
                    </div>

                    {/* Alert Message */}
                    <p className={`text-sm font-medium ${config.text} mb-2`}>
                      {alert.message}
                    </p>

                    {/* Alert Details */}
                    {alert.details && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(alert.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Acknowledged Info */}
                    {alert.is_acknowledged && alert.acknowledged_at && (
                      <p className="text-xs text-gray-500 mt-2">
                        ✓ Bestätigt am{' '}
                        {new Date(alert.acknowledged_at).toLocaleString(
                          'de-DE'
                        )}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {!alert.is_acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="ml-4 inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Bestätigen
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

