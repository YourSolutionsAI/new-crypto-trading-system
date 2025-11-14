// Supabase Client für Realtime-Updates

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase Umgebungsvariablen nicht gesetzt!');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper-Funktionen für Datenbankabfragen
export async function getStrategies() {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fehler beim Laden der Strategien:', error);
    return [];
  }

  return data || [];
}

export async function getTrades(limit: number = 100) {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Fehler beim Laden der Trades:', error);
    return [];
  }

  return data || [];
}

export async function getBotLogs(limit: number = 50) {
  const { data, error } = await supabase
    .from('bot_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Fehler beim Laden der Logs:', error);
    return [];
  }

  return data || [];
}

export async function updateStrategy(id: string, updates: Partial<{ active: boolean; config: any }>) {
  const { data, error } = await supabase
    .from('strategies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Fehler beim Aktualisieren der Strategie:', error);
    throw error;
  }

  return data;
}

