// Custom Hook für Binance Rate Limits aus Datenbank
import { useState, useEffect, useCallback } from 'react';
import { getRateLimits } from '@/lib/api';

export interface RateLimit {
  id: number;
  rate_limit_type: string;
  interval: string;
  interval_num: number;
  limit_value: number;
  last_updated_at: string;
}

interface UseRateLimitsResult {
  rateLimits: RateLimit[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: string | null;
}

export function useRateLimits(): UseRateLimitsResult {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchRateLimits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getRateLimits();
      
      if (!response.success) {
        throw new Error('Fehler beim Laden');
      }
      
      setRateLimits(response.rateLimits);
      setLastUpdated(response.lastUpdated);
      
      if (response.count === 0) {
        setError('Keine Rate Limits gefunden. Bitte führen Sie eine Synchronisierung durch.');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Fehler beim Laden der Rate Limits';
      setError(errorMsg);
      console.error('❌ Error loading Rate Limits:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialer Load
  useEffect(() => {
    fetchRateLimits();
  }, [fetchRateLimits]);

  return {
    rateLimits,
    isLoading,
    error,
    refetch: fetchRateLimits,
    lastUpdated,
  };
}

