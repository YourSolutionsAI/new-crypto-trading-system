'use client';

import { useState } from 'react';
import { Strategy } from '@/lib/types';
import { api } from '@/lib/api';
import { useTradingStore } from '@/lib/store';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { 
  Activity, 
  Settings, 
  ToggleLeft, 
  ToggleRight, 
  TrendingUp,
  TrendingDown,
  Edit,
  Save,
  X,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface StrategyCardProps {
  strategy: Strategy;
  onUpdate: () => void;
}

export function StrategyCard({ strategy, onUpdate }: StrategyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editValues, setEditValues] = useState({
    ma_short: strategy.config.ma_short,
    ma_long: strategy.config.ma_long,
    trade_size_usdt: strategy.config.trade_size_usdt,
    signal_threshold_percent: strategy.config.settings?.signal_threshold_percent || 0.01,
    signal_cooldown_ms: strategy.config.settings?.signal_cooldown_ms || 60000,
    trade_cooldown_ms: strategy.config.settings?.trade_cooldown_ms || 300000,
    stop_loss_percent: strategy.config.risk?.stop_loss_percent || 2,
    take_profit_percent: strategy.config.risk?.take_profit_percent || 5,
  });

  const handleToggle = async () => {
    setLoading(true);
    try {
      await api.toggleStrategy(strategy.id, !strategy.is_active);
      toast.success(`${strategy.symbol} ${!strategy.is_active ? 'aktiviert' : 'deaktiviert'}`);
      onUpdate();
    } catch (error) {
      console.error('Error toggling strategy:', error);
      toast.error('Fehler beim Ändern des Status');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        config: {
          ...strategy.config,
          ma_short: editValues.ma_short,
          ma_long: editValues.ma_long,
          trade_size_usdt: editValues.trade_size_usdt,
          settings: {
            signal_threshold_percent: editValues.signal_threshold_percent,
            signal_cooldown_ms: editValues.signal_cooldown_ms,
            trade_cooldown_ms: editValues.trade_cooldown_ms,
          },
          risk: {
            stop_loss_percent: editValues.stop_loss_percent,
            take_profit_percent: editValues.take_profit_percent,
          },
        },
      };

      await api.updateStrategy(strategy.id, updates);
      toast.success('Strategie-Einstellungen gespeichert');
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating strategy:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const displaySymbol = strategy.symbol.replace('USDT', '');
  const hasPerformanceData = strategy.total_trades !== undefined && strategy.total_trades > 0;

  return (
    <motion.div
      layout
      className={cn(
        "bg-card p-6 rounded-xl border shadow-sm transition-all duration-300",
        strategy.is_active 
          ? "border-green-500/50 shadow-green-500/10" 
          : "border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            {displaySymbol}
            {strategy.is_active && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                AKTIV
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">{strategy.name}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
          </button>
          
          <button
            onClick={handleToggle}
            disabled={loading}
            className={cn(
              "p-2 rounded-lg transition-colors",
              strategy.is_active 
                ? "bg-green-500/20 hover:bg-green-500/30" 
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {strategy.is_active ? (
              <ToggleRight className="h-5 w-5 text-green-600" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Performance Stats */}
      {hasPerformanceData && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Trades</p>
            <p className="text-lg font-semibold">{strategy.total_trades}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className={cn(
              "text-lg font-semibold",
              strategy.win_rate! >= 50 ? "text-green-500" : "text-orange-500"
            )}>
              {strategy.win_rate!.toFixed(1)}%
            </p>
          </div>
          {strategy.total_pnl !== undefined && (
            <div className="col-span-2 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Gesamt PnL</p>
              <p className={cn(
                "text-lg font-semibold",
                strategy.total_pnl >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {formatCurrency(strategy.total_pnl)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Form */}
      <AnimatePresence>
        {isEditing ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* MA Settings */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Moving Average
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">MA Short</label>
                  <input
                    type="number"
                    value={editValues.ma_short}
                    onChange={(e) => setEditValues({ ...editValues, ma_short: parseInt(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">MA Long</label>
                  <input
                    type="number"
                    value={editValues.ma_long}
                    onChange={(e) => setEditValues({ ...editValues, ma_long: parseInt(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Trading Settings */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Trading
              </h4>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Trade Size (USDT)</label>
                  <input
                    type="number"
                    value={editValues.trade_size_usdt}
                    onChange={(e) => setEditValues({ ...editValues, trade_size_usdt: parseFloat(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Signal Threshold (%)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={editValues.signal_threshold_percent}
                    onChange={(e) => setEditValues({ ...editValues, signal_threshold_percent: parseFloat(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Risk Management */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Risk Management
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Stop Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editValues.stop_loss_percent}
                    onChange={(e) => setEditValues({ ...editValues, stop_loss_percent: parseFloat(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Take Profit (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editValues.take_profit_percent}
                    onChange={(e) => setEditValues({ ...editValues, take_profit_percent: parseFloat(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-muted/50 border border-border focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Speichern...' : 'Einstellungen speichern'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {/* Current Settings Overview */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">MA:</span>
                <span className="font-medium">
                  {strategy.config.ma_short}/{strategy.config.ma_long}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span className="font-medium">{strategy.config.trade_size_usdt} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Threshold:</span>
                <span className="font-medium">
                  {strategy.config.settings?.signal_threshold_percent || 0.01}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SL/TP:</span>
                <span className="font-medium">
                  {strategy.config.risk?.stop_loss_percent || 2}% / {strategy.config.risk?.take_profit_percent || 5}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
