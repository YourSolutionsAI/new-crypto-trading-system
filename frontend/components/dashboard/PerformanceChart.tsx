'use client';

import { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ChartData {
  date: string;
  pnl: number;
  cumulative: number;
  trades: number;
}

interface StrategyPerfData {
  name: string;
  value: number;
  trades: number;
  winRate: number;
}

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export function PerformanceChart() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [strategyData, setStrategyData] = useState<StrategyPerfData[]>([]);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    loadChartData();
    const interval = setInterval(loadChartData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timeframe]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      
      // Lade Trades für Chart
      const trades = await api.getTrades(100, 0);
      
      // Gruppiere Trades nach Zeitraum
      const groupedData = groupTradesByTimeframe(trades, timeframe);
      setChartData(groupedData);

      // Lade Strategy Performance
      const stratPerf = await api.getStrategyPerformance();
      const stratData = stratPerf.map(s => ({
        name: `${s.symbol} - ${s.strategy_name}`,
        value: s.total_pnl,
        trades: s.total_trades,
        winRate: s.win_rate
      }));
      setStrategyData(stratData);

    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupTradesByTimeframe = (trades: any[], timeframe: string): ChartData[] => {
    const grouped = new Map<string, { pnl: number; trades: number }>();
    
    trades.forEach(trade => {
      if (!trade.pnl) return;
      
      const date = new Date(trade.executed_at);
      let key: string;
      
      switch (timeframe) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const week = getWeekNumber(date);
          key = `${date.getFullYear()}-W${week}`;
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      
      const existing = grouped.get(key) || { pnl: 0, trades: 0 };
      existing.pnl += trade.pnl;
      existing.trades += 1;
      grouped.set(key, existing);
    });

    // Konvertiere zu Array und berechne kumulatives PnL
    let cumulative = 0;
    const result = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => {
        cumulative += data.pnl;
        return {
          date,
          pnl: data.pnl,
          cumulative,
          trades: data.trades
        };
      });

    return result;
  };

  const getWeekNumber = (date: Date): number => {
    const firstJanuary = new Date(date.getFullYear(), 0, 1);
    const daysToNextMonday = firstJanuary.getDay() === 1 ? 0 : (7 - firstJanuary.getDay()) % 7;
    const nextMonday = new Date(date.getFullYear(), 0, firstJanuary.getDate() + daysToNextMonday);
    
    return date < nextMonday 
      ? 52 
      : Math.ceil((date.getTime() - nextMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover p-3 rounded-lg border shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-green-600">
            PnL: {formatCurrency(payload[0].value)}
          </p>
          {payload[1] && (
            <p className="text-sm text-blue-600">
              Kumulativ: {formatCurrency(payload[1].value)}
            </p>
          )}
          {payload[2] && (
            <p className="text-sm text-muted-foreground">
              Trades: {payload[2].value}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Performance Analyse</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pnl" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pnl">PnL Verlauf</TabsTrigger>
            <TabsTrigger value="cumulative">Kumulatives PnL</TabsTrigger>
            <TabsTrigger value="strategies">Strategie Performance</TabsTrigger>
          </TabsList>

          <div className="mb-4">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="px-3 py-1 rounded-md border bg-background"
            >
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
          </div>

          <TabsContent value="pnl" className="space-y-4">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  yAxisId="left"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => formatCurrency(value, true)}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="pnl"
                  fill="#10b981"
                  name="PnL"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="trades"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Anzahl Trades"
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="cumulative" className="space-y-4">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickFormatter={(value) => formatCurrency(value, true)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#10b981"
                  fill="url(#colorGradient)"
                  strokeWidth={2}
                  name="Kumulatives PnL"
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="strategies" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-4">PnL nach Strategie</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={strategyData.filter(s => s.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {strategyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-4">Win Rate Vergleich</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={strategyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: 'currentColor' }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis 
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                    />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar 
                      dataKey="winRate" 
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
