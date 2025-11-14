// Supabase Database Types (vereinfacht)
// Diese können später mit supabase gen generate types erstellt werden

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      strategies: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          active: boolean;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          active?: boolean;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          active?: boolean;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          strategy_id: string | null;
          symbol: string;
          side: string;
          price: number;
          quantity: number;
          total: number;
          status: string;
          executed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          strategy_id?: string | null;
          symbol: string;
          side: string;
          price: number;
          quantity: number;
          total: number;
          status?: string;
          executed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          strategy_id?: string | null;
          symbol?: string;
          side?: string;
          price?: number;
          quantity?: number;
          total?: number;
          status?: string;
          executed_at?: string | null;
          created_at?: string;
        };
      };
      bot_logs: {
        Row: {
          id: string;
          level: string;
          message: string;
          data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          level: string;
          message: string;
          data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          level?: string;
          message?: string;
          data?: Json | null;
          created_at?: string;
        };
      };
    };
  };
}

