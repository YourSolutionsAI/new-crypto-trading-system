'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTradingStore } from '@/lib/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  TrendingUp,
  History,
  ChartBar,
  Settings,
  Menu,
  Moon,
  Sun,
  Power,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  badge?: number;
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Strategien', href: '/strategies', icon: TrendingUp },
  { name: 'Trading-Historie', href: '/trades', icon: History },
  { name: 'Backtesting', href: '/backtest', icon: ChartBar },
  { name: 'Einstellungen', href: '/settings', icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, sidebarOpen, setSidebarOpen, botStatus } = useTradingStore();
  const { connected } = useWebSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isBotRunning = botStatus?.status === 'running';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar Desktop */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="hidden lg:flex lg:flex-shrink-0"
          >
            <div className="flex w-64 flex-col">
              <div className="flex h-full min-h-0 flex-col border-r border-border bg-card">
                {/* Logo */}
                <div className="flex h-16 items-center justify-between px-4 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-8 w-8 text-primary" />
                    <h1 className="text-xl font-bold">Trading Bot</h1>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Bot Status</span>
                    <div className="flex items-center space-x-1">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isBotRunning ? "bg-green-500 animate-pulse" : "bg-red-500"
                      )} />
                      <span className="text-xs font-medium">
                        {isBotRunning ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">WebSocket</span>
                    <div className="flex items-center space-x-1">
                      {connected ? (
                        <Wifi className="h-3 w-3 text-green-500" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-red-500" />
                      )}
                      <span className="text-xs font-medium">
                        {connected ? 'Verbunden' : 'Getrennt'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto scrollbar-thin">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        {item.name}
                        {item.badge && (
                          <span className="ml-auto inline-flex items-center rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Bottom Actions */}
                <div className="flex flex-col gap-2 p-4 border-t border-border">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span>Theme</span>
                    {theme === 'dark' ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-card border-b border-border">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:block p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <h2 className="text-lg font-semibold">
                {navigation.find(item => item.href === pathname)?.name || 'Dashboard'}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              {/* Bot Control Button */}
              <button
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all",
                  isBotRunning
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                )}
              >
                <Power className="h-4 w-4" />
                <span>{isBotRunning ? 'Bot Stoppen' : 'Bot Starten'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
            >
              <motion.div 
                className="fixed inset-0 bg-black/50"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.nav 
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col"
              >
                <div className="flex h-16 items-center justify-between px-4 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-8 w-8 text-primary" />
                    <h1 className="text-xl font-bold">Trading Bot</h1>
                  </div>
                </div>
                
                <div className="flex-1 py-4 overflow-y-auto">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
