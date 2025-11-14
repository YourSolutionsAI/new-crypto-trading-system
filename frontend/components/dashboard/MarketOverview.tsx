'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { TrendingUp, TrendingDown, Zap, AlertTriangle, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketStat {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

export function MarketOverview() {
  const [stats, setStats] = useState<MarketStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketStats();
    const interval = setInterval(loadMarketStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMarketStats = async () => {
    try {
      // Lade verschiedene Marktdaten
      const [performance, strategies] = await Promise.all([
        api.getPerformance(),
        api.getStrategies()
      ]);

      const activeStrategies = strategies.filter(s => s.is_active);
      const totalVolume = performance.total_volume || 0;
      const winRate = performance.win_rate || 0;

      const newStats: MarketStat[] = [
        {
          label: '24h Volumen',
          value: formatCurrency(totalVolume, true),
          change: 12.5, // Mock - sollte aus echten Daten kommen
          icon: <BarChart3 className="h-5 w-5" />,
          color: 'text-blue-500'
        },
        {
          label: 'Win Rate',
          value: `${winRate.toFixed(1)}%`,
          change: winRate > 50 ? 5 : -5, // Mock
          icon: winRate > 50 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />,
          color: winRate > 50 ? 'text-green-500' : 'text-red-500'
        },
        {
          label: 'Aktive Strategien',
          value: activeStrategies.length,
          icon: <Zap className="h-5 w-5" />,
          color: 'text-purple-500'
        },
        {
          label: 'Signale/Stunde',
          value: Math.floor(Math.random() * 50 + 10), // Mock - sollte aus echten Daten kommen
          icon: <AlertTriangle className="h-5 w-5" />,
          color: 'text-orange-500'
        }
      ];

      setStats(newStats);
      setLoading(false);
    } catch (error) {
      console.error('Error loading market stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Markt Übersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-muted/50 rounded-lg p-4 hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={stat.color}>{stat.icon}</span>
                {stat.change !== undefined && (
                  <span className={`text-xs ${stat.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stat.change >= 0 ? '+' : ''}{stat.change}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Markt Trend</p>
              <p className="text-sm font-medium text-green-500">Bullish</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Volatilität</p>
              <p className="text-sm font-medium text-orange-500">Mittel</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sentiment</p>
              <p className="text-sm font-medium text-blue-500">Positiv</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
