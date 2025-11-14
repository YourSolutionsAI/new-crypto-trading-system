'use client';

import { useEffect, useState } from 'react';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Shield, AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface RiskMetric {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: 'green' | 'yellow' | 'red';
}

export function RiskMetrics() {
  const { openPositions } = useTradingStore();
  const [metrics, setMetrics] = useState<RiskMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateRiskMetrics();
    const interval = setInterval(calculateRiskMetrics, 10000);
    return () => clearInterval(interval);
  }, [openPositions]);

  const calculateRiskMetrics = async () => {
    try {
      // Lade Bot-Settings für Limits
      const strategies = await api.getStrategies();
      const performance = await api.getPerformance();
      
      // Mock Risk Values - sollten aus echten Daten berechnet werden
      const totalExposure = performance.total_volume || 0;
      const maxExposure = 1000; // Aus bot_settings
      const exposurePercent = (totalExposure / maxExposure) * 100;

      const maxDrawdown = performance.maxDrawdown || 0;
      const maxAllowedDrawdown = 20; // 20% max
      
      const openPositionCount = Object.keys(openPositions).length;
      const maxConcurrentTrades = 3; // Aus bot_settings

      // Risk Score berechnen (0-100)
      const riskScore = Math.min(100, 
        (exposurePercent * 0.3) + 
        (maxDrawdown * 2) + 
        ((openPositionCount / maxConcurrentTrades) * 100 * 0.2)
      );

      const newMetrics: RiskMetric[] = [
        {
          label: 'Exposure',
          value: exposurePercent,
          max: 100,
          unit: '%',
          color: exposurePercent > 80 ? 'red' : exposurePercent > 60 ? 'yellow' : 'green'
        },
        {
          label: 'Drawdown',
          value: maxDrawdown,
          max: maxAllowedDrawdown,
          unit: '%',
          color: maxDrawdown > 15 ? 'red' : maxDrawdown > 10 ? 'yellow' : 'green'
        },
        {
          label: 'Offene Trades',
          value: openPositionCount,
          max: maxConcurrentTrades,
          unit: '',
          color: openPositionCount >= maxConcurrentTrades ? 'red' : 'green'
        },
        {
          label: 'Risk Score',
          value: riskScore,
          max: 100,
          unit: '',
          color: riskScore > 70 ? 'red' : riskScore > 50 ? 'yellow' : 'green'
        }
      ];

      setMetrics(newMetrics);
      setLoading(false);
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
      setLoading(false);
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return {
          text: 'text-green-500',
          bg: 'bg-green-500/10',
          progress: 'bg-green-500'
        };
      case 'yellow':
        return {
          text: 'text-yellow-500',
          bg: 'bg-yellow-500/10',
          progress: 'bg-yellow-500'
        };
      case 'red':
        return {
          text: 'text-red-500',
          bg: 'bg-red-500/10',
          progress: 'bg-red-500'
        };
      default:
        return {
          text: 'text-muted-foreground',
          bg: 'bg-muted',
          progress: 'bg-muted-foreground'
        };
    }
  };

  const overallRisk = metrics.find(m => m.label === 'Risk Score');
  const riskLevel = overallRisk ? 
    (overallRisk.value > 70 ? 'Hoch' : overallRisk.value > 50 ? 'Mittel' : 'Niedrig') : 
    'Berechne...';

  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Risk Management
        </h2>
        <div className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          overallRisk && getColorClasses(overallRisk.color).bg,
          overallRisk && getColorClasses(overallRisk.color).text
        )}>
          {riskLevel}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-2 bg-muted rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => {
            const colors = getColorClasses(metric.color);
            const percentage = (metric.value / metric.max) * 100;
            
            return (
              <div key={metric.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                  <span className={cn("text-sm font-medium", colors.text)}>
                    {metric.value.toFixed(metric.unit === '%' ? 1 : 0)}{metric.unit}
                    {metric.max && metric.unit !== '%' && (
                      <span className="text-muted-foreground">/{metric.max}</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-500", colors.progress)}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Risk Warnings */}
          {metrics.some(m => m.color === 'red') && (
            <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risikolimits erreicht! Überprüfen Sie Ihre Positionen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
