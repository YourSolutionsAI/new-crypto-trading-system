'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BotStatusCard } from '@/components/dashboard/BotStatusCard';
import { LivePricesCard } from '@/components/dashboard/LivePricesCard';
import { PerformanceCard } from '@/components/dashboard/PerformanceCard';
import { OpenPositionsCard } from '@/components/dashboard/OpenPositionsCard';
import { RecentTradesCard } from '@/components/dashboard/RecentTradesCard';
import { ActiveStrategiesCard } from '@/components/dashboard/ActiveStrategiesCard';
import { PerformanceChart } from '@/components/dashboard/PerformanceChart';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { RiskMetrics } from '@/components/dashboard/RiskMetrics';
import { motion } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTradingStore } from '@/lib/store';
import { Bell, AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

export default function Dashboard() {
  const { connected } = useWebSocket();
  const botStatus = useTradingStore((state) => state.botStatus);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Zeige Willkommensnachricht beim ersten Laden
  useEffect(() => {
    const isFirstVisit = !localStorage.getItem('dashboard_visited');
    if (isFirstVisit) {
      toast.success('Willkommen im Crypto Trading Dashboard!', {
        duration: 5000,
        icon: '🚀',
      });
      localStorage.setItem('dashboard_visited', 'true');
    }
  }, []);

  // Überwache Bot-Status und zeige Benachrichtigungen
  useEffect(() => {
    if (botStatus?.status === 'running') {
      toast.success('Trading Bot ist aktiv', {
        icon: <CheckCircle className="h-4 w-4" />,
      });
    }
  }, [botStatus?.status]);

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Page Title with Status Indicators */}
        <motion.div variants={itemVariants} className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Trading Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Überwachen Sie Ihre Trading-Bot Performance in Echtzeit
            </p>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center gap-3">
            {connected && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Live</span>
              </div>
            )}
            
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* Alert Banner */}
        {!connected && (
          <motion.div 
            variants={itemVariants}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3"
          >
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              WebSocket-Verbindung getrennt. Versuche erneute Verbindung...
            </p>
          </motion.div>
        )}

        {/* Top Row - Status, Performance and Risk */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <BotStatusCard />
          <PerformanceCard />
          <ActiveStrategiesCard />
          <RiskMetrics />
        </motion.div>

        {/* Market Overview */}
        <motion.div variants={itemVariants}>
          <MarketOverview />
        </motion.div>

        {/* Live Prices Grid */}
        <motion.div variants={itemVariants}>
          <LivePricesCard />
        </motion.div>

        {/* Performance Charts */}
        <motion.div variants={itemVariants}>
          <PerformanceChart />
        </motion.div>

        {/* Trading Data */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <OpenPositionsCard />
          <RecentTradesCard />
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}