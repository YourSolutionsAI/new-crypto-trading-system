/**
 * ═══════════════════════════════════════════════
 * TRADING BOT FALLBACK KONFIGURATION
 * ═══════════════════════════════════════════════
 * 
 * ⚠️ Diese Datei dient NUR als FALLBACK!
 * Alle Einstellungen werden primär aus SUPABASE geladen.
 * Diese Werte werden nur verwendet, wenn Supabase-Werte fehlen.
 */

module.exports = {
  // Fallback Lot Sizes (falls nicht in Supabase)
  lotSizes: {
    BTCUSDT: {
      minQty: 0.00001,
      maxQty: 9000,
      stepSize: 0.00001,
      decimals: 5,
    },
    
    ETHUSDT: {
      minQty: 0.0001,
      maxQty: 9000,
      stepSize: 0.0001,
      decimals: 4,
    },
    
    BNBUSDT: {
      minQty: 0.001,
      maxQty: 9000,
      stepSize: 0.001,
      decimals: 3,
    },
    
    DOGEUSDT: {
      minQty: 1,
      maxQty: 9000000,
      stepSize: 1,
      decimals: 0,
    },
    
    SHIBUSDT: {
      minQty: 1,
      maxQty: 90000000,
      stepSize: 1,
      decimals: 0,
    },
    
    XRPUSDT: {
      minQty: 0.1,
      maxQty: 9000000,
      stepSize: 0.1,
      decimals: 1,
    },
    
    ADAUSDT: {
      minQty: 0.1,
      maxQty: 9000000,
      stepSize: 0.1,
      decimals: 1,
    },
    
    SOLUSDT: {
      minQty: 0.01,
      maxQty: 9000,
      stepSize: 0.01,
      decimals: 2,
    },
    
    // Fallback für unbekannte Symbole
    DEFAULT: {
      minQty: 1,
      maxQty: 1000000,
      stepSize: 1,
      decimals: 0,
    },
  },
};

