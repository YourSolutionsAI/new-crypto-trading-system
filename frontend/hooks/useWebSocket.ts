import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface WebSocketMessage {
  type: 'price' | 'trade' | 'signal' | 'position' | 'status' | 'performance';
  data: any;
  timestamp: string;
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const {
    setWsConnected,
    updateMarketData,
    addTrade,
    setPositions,
    updatePosition,
    removePosition,
    setPerformance,
    setBotStatus,
  } = useTradingStore();

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:10000';
    console.log('Connecting to WebSocket:', wsUrl);

    try {
      ws.current = new WebSocket(wsUrl + '/ws');

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        reconnectAttempts.current = 0;
        toast.success('Live-Verbindung hergestellt');
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket Verbindungsfehler');
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        ws.current = null;

        // Auto-reconnect logic
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          toast.warning(`Verbindung verloren. Versuche erneut... (${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimer.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          toast.error('WebSocket Verbindung fehlgeschlagen. Bitte Seite neu laden.');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setWsConnected(false);
    }
  }, [setWsConnected]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    setWsConnected(false);
    reconnectAttempts.current = 0;
  }, [setWsConnected]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'price':
        // Update market data
        const { symbol, price, change24h, volume } = message.data;
        updateMarketData(symbol, {
          price,
          change24h,
          change24hPercent: (change24h / price) * 100,
          volume24h: volume,
        });
        break;

      case 'trade':
        // New trade executed
        addTrade(message.data);
        toast.success(`Trade ausgeführt: ${message.data.side} ${message.data.symbol}`);
        break;

      case 'signal':
        // Trading signal generated
        const { signal, confidence } = message.data;
        if (signal !== 'HOLD') {
          toast(`Signal: ${signal} ${message.data.symbol} (${(confidence * 100).toFixed(0)}%)`, {
            icon: signal === 'BUY' ? '📈' : '📉',
          });
        }
        break;

      case 'position':
        // Position update
        const { action, position } = message.data;
        if (action === 'opened') {
          toast.success(`Position eröffnet: ${position.symbol}`);
        } else if (action === 'closed') {
          const pnlColor = position.pnl >= 0 ? '🟢' : '🔴';
          toast.success(`Position geschlossen: ${position.symbol} ${pnlColor} ${position.pnl.toFixed(2)} USDT`);
          removePosition(position.id);
        } else if (action === 'updated') {
          updatePosition(position.id, position);
        }
        break;

      case 'status':
        // Bot status update
        setBotStatus(message.data);
        break;

      case 'performance':
        // Performance metrics update
        setPerformance(message.data);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [updateMarketData, addTrade, updatePosition, removePosition, setPerformance, setBotStatus]);

  const sendMessage = useCallback((type: string, data: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    } else {
      console.error('WebSocket is not connected');
      toast.error('Keine Verbindung zum Server');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected: useTradingStore((state) => state.wsConnected),
    sendMessage,
    reconnect: connect,
  };
}
