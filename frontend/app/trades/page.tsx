'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TradeTable } from '@/components/trades/TradeTable';
import { PerformanceChart } from '@/components/trades/PerformanceChart';
import { TradeFilters } from '@/components/trades/TradeFilters';
import { useTradingStore } from '@/lib/store';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { History, Download, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TradesPage() {
  const { trades, setTrades } = useTradingStore();
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    symbol: 'all',
    side: 'all',
    dateRange: '7d',
  });

  useEffect(() => {
    loadTrades();
  }, []);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const data = await api.getTrades(100); // Load more trades for history
      setTrades(data);
    } catch (error) {
      console.error('Error loading trades:', error);
      toast.error('Fehler beim Laden der Trades');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['Datum', 'Symbol', 'Seite', 'Menge', 'Preis', 'PnL', 'Status'],
      ...trades.map(t => [
        new Date(t.created_at).toISOString(),
        t.symbol,
        t.side,
        t.quantity,
        t.price,
        t.pnl || '',
        t.status,
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Trades exportiert');
  };

  // Filter trades based on selected filters
  const filteredTrades = trades.filter(trade => {
    if (filters.symbol !== 'all' && trade.symbol !== filters.symbol) return false;
    if (filters.side !== 'all' && trade.side !== filters.side) return false;
    
    // Date range filter
    const tradeDate = new Date(trade.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - tradeDate.getTime()) / (1000 * 60 * 60 * 24);
    
    switch (filters.dateRange) {
      case '1d': return daysDiff <= 1;
      case '7d': return daysDiff <= 7;
      case '30d': return daysDiff <= 30;
      case 'all': return true;
      default: return true;
    }
  });

  const uniqueSymbols = [...new Set(trades.map(t => t.symbol))];

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <History className="h-8 w-8" />
              Trading-Historie
            </h1>
            <p className="text-muted-foreground mt-1">
              Analysieren Sie Ihre vergangenen Trades und Performance
            </p>
          </div>
          
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Performance Chart */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Performance Übersicht</h2>
          <PerformanceChart trades={filteredTrades} />
        </div>

        {/* Filters */}
        <TradeFilters
          filters={filters}
          onFiltersChange={setFilters}
          symbols={uniqueSymbols}
        />

        {/* Trade Table */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Trade-Liste ({filteredTrades.length} Trades)
              </h2>
              <button
                onClick={loadTrades}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {loading ? 'Lädt...' : 'Aktualisieren'}
              </button>
            </div>
          </div>
          
          <TradeTable trades={filteredTrades} loading={loading} />
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
