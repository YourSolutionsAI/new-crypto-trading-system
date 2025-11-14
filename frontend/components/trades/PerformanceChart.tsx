'use client';

import { useMemo } from 'react';
import { Trade } from '@/lib/types';
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
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PerformanceChartProps {
  trades: Trade[];
}

export function PerformanceChart({ trades }: PerformanceChartProps) {
  const chartData = useMemo(() => {
    // Sort trades by date
    const sortedTrades = [...trades]
      .filter(t => t.side === 'SELL' && t.pnl !== undefined)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (sortedTrades.length === 0) return [];

    // Calculate cumulative PnL
    let cumulativePnL = 0;
    const data = sortedTrades.map(trade => {
      cumulativePnL += trade.pnl || 0;
      return {
        date: new Date(trade.created_at).toLocaleDateString('de-DE'),
        pnl: trade.pnl || 0,
        cumulativePnL,
        symbol: trade.symbol.replace('USDT', ''),
      };
    });

    return data;
  }, [trades]);

  const dailyPnL = useMemo(() => {
    const pnlByDate = trades
      .filter(t => t.side === 'SELL' && t.pnl !== undefined)
      .reduce((acc, trade) => {
        const date = new Date(trade.created_at).toLocaleDateString('de-DE');
        acc[date] = (acc[date] || 0) + (trade.pnl || 0);
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(pnlByDate)
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [trades]);

  const symbolPerformance = useMemo(() => {
    const perfBySymbol = trades
      .filter(t => t.side === 'SELL' && t.pnl !== undefined)
      .reduce((acc, trade) => {
        const symbol = trade.symbol.replace('USDT', '');
        if (!acc[symbol]) {
          acc[symbol] = { total: 0, count: 0, wins: 0 };
        }
        acc[symbol].total += trade.pnl || 0;
        acc[symbol].count++;
        if ((trade.pnl || 0) > 0) acc[symbol].wins++;
        return acc;
      }, {} as Record<string, { total: number; count: number; wins: number }>);

    return Object.entries(perfBySymbol)
      .map(([symbol, data]) => ({
        symbol,
        pnl: data.total,
        trades: data.count,
        winRate: (data.wins / data.count) * 100,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Noch keine abgeschlossenen Trades vorhanden
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cumulative PnL Chart */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Kumulative PnL</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="date" 
              stroke="#888"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#888"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Area
              type="monotone"
              dataKey="cumulativePnL"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorPnl)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Daily PnL Bar Chart */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Tägliche PnL</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyPnL}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="date" 
              stroke="#888"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#888"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar 
              dataKey="pnl" 
              fill={(data: any) => data.pnl >= 0 ? '#10b981' : '#ef4444'}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Symbol Performance */}
      <div>
        <h3 className="text-sm font-semibold mb-4">Performance nach Symbol</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={symbolPerformance} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              type="number"
              stroke="#888"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <YAxis 
              type="category"
              dataKey="symbol" 
              stroke="#888"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'pnl') return formatCurrency(value);
                if (name === 'winRate') return `${value.toFixed(1)}%`;
                return value;
              }}
            />
            <Bar 
              dataKey="pnl" 
              fill={(data: any) => data.pnl >= 0 ? '#10b981' : '#ef4444'}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
