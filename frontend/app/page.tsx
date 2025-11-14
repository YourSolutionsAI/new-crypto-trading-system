// Dashboard Hauptseite

import { BotStatusCard } from '@/components/dashboard/BotStatusCard';
import { ControlPanel } from '@/components/dashboard/ControlPanel';
import { ActiveStrategies } from '@/components/dashboard/ActiveStrategies';
import { LivePrices } from '@/components/dashboard/LivePrices';
import { StrategyPerformanceTable } from '@/components/performance/StrategyPerformance';
import { TradeHistory } from '@/components/trading/TradeHistory';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Crypto Trading Bot Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Überwachen und steuern Sie Ihren automatisierten Trading-Bot
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Section: Status & Control */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <BotStatusCard />
          <ControlPanel />
        </div>

        {/* Middle Section: Strategies & Live Prices */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <ActiveStrategies />
          <LivePrices />
        </div>

        {/* Bottom Section: Performance & Trade History */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <StrategyPerformanceTable />
          <TradeHistory />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Crypto Trading Bot Dashboard • Phase 4
          </p>
        </div>
      </footer>
    </div>
  );
}
