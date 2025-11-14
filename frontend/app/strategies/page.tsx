'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StrategyCard } from '@/components/strategies/StrategyCard';
import { StrategyStats } from '@/components/strategies/StrategyStats';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Strategy } from '@/lib/types';
import { motion } from 'framer-motion';
import { Loader2, Zap, Filter, Settings, TrendingUp, AlertTriangle, Download, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import toast from 'react-hot-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

interface FilterOptions {
  showActive: boolean;
  showInactive: boolean;
  symbol: string;
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterOptions>({
    showActive: true,
    showInactive: true,
    symbol: 'all'
  });
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      const data = await api.getStrategies();
      setStrategies(data);
    } catch (error) {
      console.error('Error loading strategies:', error);
      toast.error('Fehler beim Laden der Strategien');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await api.toggleStrategy(id, isActive);
      await loadStrategies();
      toast.success(isActive ? 'Strategie aktiviert' : 'Strategie deaktiviert');
    } catch (error) {
      console.error('Error toggling strategy:', error);
      toast.error('Fehler beim Ändern des Strategie-Status');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Strategy>) => {
    try {
      await api.updateStrategy(id, updates);
      await loadStrategies();
      toast.success('Strategie erfolgreich aktualisiert');
    } catch (error) {
      console.error('Error updating strategy:', error);
      toast.error('Fehler beim Aktualisieren der Strategie');
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate') => {
    const promises = Array.from(selectedStrategies).map(id => 
      api.toggleStrategy(id, action === 'activate')
    );
    
    try {
      await Promise.all(promises);
      await loadStrategies();
      setSelectedStrategies(new Set());
      setBulkEditMode(false);
      toast.success(`${selectedStrategies.size} Strategien ${action === 'activate' ? 'aktiviert' : 'deaktiviert'}`);
    } catch (error) {
      toast.error('Fehler bei der Bulk-Aktion');
    }
  };

  const exportStrategies = () => {
    const dataStr = JSON.stringify(strategies, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `strategies_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredStrategies = strategies.filter(strategy => {
    if (!filter.showActive && strategy.is_active) return false;
    if (!filter.showInactive && !strategy.is_active) return false;
    if (filter.symbol !== 'all' && strategy.symbol !== filter.symbol) return false;
    return true;
  });

  const uniqueSymbols = [...new Set(strategies.map(s => s.symbol))];
  
  const activeCount = strategies.filter(s => s.is_active).length;
  const profitableCount = strategies.filter(s => (s.performance?.total_pnl || 0) > 0).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        <motion.div variants={itemVariants} className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              <Zap className="h-8 w-8 text-purple-600" />
              Trading Strategien
            </h1>
            <p className="text-muted-foreground mt-1">
              Verwalten und optimieren Sie Ihre Trading-Strategien
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={exportStrategies}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              onClick={() => setBulkEditMode(!bulkEditMode)}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {bulkEditMode ? 'Abbrechen' : 'Bulk Edit'}
            </button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Gesamt</p>
            <p className="text-2xl font-bold">{strategies.length}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Aktiv</p>
            <p className="text-2xl font-bold text-green-500">{activeCount}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Profitabel</p>
            <p className="text-2xl font-bold text-blue-500">{profitableCount}</p>
          </div>
          <div className="bg-card p-4 rounded-lg border">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold">
              {strategies.length > 0 
                ? (strategies.reduce((sum, s) => sum + (s.performance?.win_rate || 0), 0) / strategies.length).toFixed(1)
                : 0}%
            </p>
          </div>
        </motion.div>

        {/* Bulk Edit Actions */}
        {bulkEditMode && selectedStrategies.size > 0 && (
          <motion.div 
            variants={itemVariants}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center justify-between"
          >
            <p className="text-sm">
              {selectedStrategies.size} Strategie{selectedStrategies.size > 1 ? 'n' : ''} ausgewählt
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('activate')}
                className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Aktivieren
              </button>
              <button
                onClick={() => handleBulkAction('deactivate')}
                className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Deaktivieren
              </button>
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="all">Alle Strategien</TabsTrigger>
                <TabsTrigger value="active">Aktive</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
              </TabsList>
              
              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={filter.symbol}
                  onChange={(e) => setFilter({ ...filter, symbol: e.target.value })}
                  className="px-3 py-1 rounded-md border bg-background"
                >
                  <option value="all">Alle Symbole</option>
                  {uniqueSymbols.map(symbol => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            <TabsContent value="all" className="space-y-4">
              <motion.div 
                variants={containerVariants}
                className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {filteredStrategies.map((strategy) => (
                  <motion.div key={strategy.id} variants={itemVariants}>
                    <StrategyCard
                      strategy={strategy}
                      onToggle={handleToggle}
                      onUpdate={handleUpdate}
                      bulkEditMode={bulkEditMode}
                      selected={selectedStrategies.has(strategy.id)}
                      onSelect={(id) => {
                        const newSelected = new Set(selectedStrategies);
                        if (newSelected.has(id)) {
                          newSelected.delete(id);
                        } else {
                          newSelected.add(id);
                        }
                        setSelectedStrategies(newSelected);
                      }}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </TabsContent>

            <TabsContent value="active">
              <motion.div 
                variants={containerVariants}
                className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {filteredStrategies.filter(s => s.is_active).map((strategy) => (
                  <motion.div key={strategy.id} variants={itemVariants}>
                    <StrategyCard
                      strategy={strategy}
                      onToggle={handleToggle}
                      onUpdate={handleUpdate}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </TabsContent>

            <TabsContent value="performance">
              <StrategyStats strategies={strategies} />
            </TabsContent>

            <TabsContent value="risk">
              <div className="space-y-4">
                <div className="bg-card p-6 rounded-xl border">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risk Analysis
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Risk Metrics per Strategy */}
                    {strategies.map(strategy => {
                      const stopLoss = strategy.config?.risk?.stop_loss_percent || 2;
                      const takeProfit = strategy.config?.risk?.take_profit_percent || 5;
                      const riskRewardRatio = takeProfit / stopLoss;
                      
                      return (
                        <div key={strategy.id} className="space-y-2 p-4 bg-muted/50 rounded-lg">
                          <h4 className="font-medium flex items-center gap-2">
                            <span className="text-sm px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">
                              {strategy.symbol}
                            </span>
                            {strategy.name}
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Stop Loss</span>
                              <span className="text-red-500 font-medium">-{stopLoss}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Take Profit</span>
                              <span className="text-green-500 font-medium">+{takeProfit}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Risk/Reward</span>
                              <span className={`font-medium ${riskRewardRatio >= 2 ? 'text-green-500' : 'text-orange-500'}`}>
                                1:{riskRewardRatio.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                              <span className="text-muted-foreground">Status</span>
                              <span className={`font-medium ${strategy.is_active ? 'text-green-500' : 'text-gray-500'}`}>
                                {strategy.is_active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall Risk Summary */}
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-2">Risk Management Übersicht</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Durchschnittlicher Stop Loss</p>
                        <p className="text-lg font-bold text-red-500">
                          -{(strategies.reduce((sum, s) => sum + (s.config?.risk?.stop_loss_percent || 2), 0) / strategies.length).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Durchschnittlicher Take Profit</p>
                        <p className="text-lg font-bold text-green-500">
                          +{(strategies.reduce((sum, s) => sum + (s.config?.risk?.take_profit_percent || 5), 0) / strategies.length).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Empfohlenes Max. Risiko</p>
                        <p className="text-lg font-bold text-orange-500">
                          2% pro Trade
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}