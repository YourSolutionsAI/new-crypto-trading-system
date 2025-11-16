// Komponente zur Anzeige der Binance Rate Limits (aus DB)
import React from 'react';
import type { RateLimit } from '@/hooks/useRateLimits';

export interface RateLimitsDisplayProps {
  rateLimits: RateLimit[];
  className?: string;
}


// Helper-Funktion für deutsche Beschreibungen
const getRateLimitDescription = (type: string): string => {
  switch (type) {
    case 'REQUEST_WEIGHT':
      return 'Request-Gewichtung';
    case 'ORDERS':
      return 'Order-Anzahl';
    case 'RAW_REQUESTS':
      return 'Rohe Requests';
    default:
      return type;
  }
};

const getIntervalDescription = (interval: string): string => {
  switch (interval) {
    case 'SECOND':
      return 'Sekunde(n)';
    case 'MINUTE':
      return 'Minute(n)';
    case 'DAY':
      return 'Tag(e)';
    default:
      return interval;
  }
};

// Helper-Funktion für Badge-Farben basierend auf Typ
const getRateLimitBadgeColor = (type: string): string => {
  switch (type) {
    case 'REQUEST_WEIGHT':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ORDERS':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'RAW_REQUESTS':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const RateLimitsDisplay: React.FC<RateLimitsDisplayProps> = ({ rateLimits, className = '' }) => {
  if (!rateLimits || rateLimits.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white shadow overflow-hidden sm:rounded-lg ${className}`}>
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Aktuelle Binance Rate Limits
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Übersicht über die geltenden API-Limitierungen von Binance
        </p>
      </div>
      
      <div className="px-4 py-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rateLimits.map((limit, index) => (
            <div
              key={index}
              className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRateLimitBadgeColor(
                    limit.rate_limit_type
                  )}`}
                >
                  {getRateLimitDescription(limit.rate_limit_type)}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-500">Limit:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {limit.limit_value.toLocaleString('de-DE')}
                  </span>
                </div>
                
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-500">Intervall:</span>
                  <span className="text-sm font-medium text-gray-700">
                    {limit.interval_num} {getIntervalDescription(limit.interval)}
                  </span>
                </div>
              </div>

              {/* Zusätzliche Info als Tooltip */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Maximal {limit.limit_value.toLocaleString('de-DE')} {getRateLimitDescription(limit.rate_limit_type).toLowerCase()} 
                  {' '}pro {limit.interval_num > 1 ? limit.interval_num : ''} {getIntervalDescription(limit.interval).toLowerCase()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Info-Banner */}
        <div className="mt-6 rounded-md bg-blue-50 p-4 border border-blue-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Wichtige Hinweise zu Rate Limits</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>Request-Gewichtung:</strong> Jeder API-Call hat ein bestimmtes Gewicht (meist 1-10)
                  </li>
                  <li>
                    <strong>Order-Anzahl:</strong> Begrenzt die maximale Anzahl von Orders
                  </li>
                  <li>
                    <strong>Rohe Requests:</strong> Zählt die tatsächliche Anzahl der HTTP-Requests
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

