# Migration zu explizitem Position-Tracking

## Überblick

Diese Anleitung erklärt die Migration vom alten FIFO-basierten System zum neuen expliziten Position-Tracking mit der `positions` Tabelle.

## Vorteile des neuen Systems

1. **Explizites Tracking**: Keine komplexen FIFO-Berechnungen mehr
2. **Performance**: Direkte Abfrage offener Positionen
3. **Robustheit**: Keine Inkonsistenzen bei manuellen Trades
4. **Transparenz**: Klare Sicht auf alle offenen Positionen

## Schritt-für-Schritt Migration

### 1. Positions-Tabelle erstellen

Führen Sie das SQL-Script in Supabase aus:

```sql
-- Führen Sie das komplette Script aus positions_table.sql aus
```

### 2. Server aktualisieren

Der Server-Code wurde bereits aktualisiert und nutzt automatisch die neue Tabelle.

### 3. Bestehende offene Positionen migrieren

**WICHTIG**: Führen Sie diese Migration nur EINMAL aus!

```sql
-- Migration bestehender offener Positionen
-- Berechnet Netto-Positionen aus der trades Tabelle

DO $$
DECLARE
  v_strategy RECORD;
  v_net_quantity DECIMAL(20, 8);
  v_weighted_avg_price DECIMAL(20, 8);
  v_total_buy_qty DECIMAL(20, 8);
  v_total_buy_value DECIMAL(20, 8);
BEGIN
  -- Für jede aktive Strategie
  FOR v_strategy IN 
    SELECT id, symbol, name FROM strategies WHERE active = true
  LOOP
    -- Berechne Netto-Position und gewichteten Durchschnittspreis
    WITH trade_summary AS (
      SELECT 
        SUM(CASE WHEN side = 'buy' THEN quantity ELSE 0 END) as total_buy_qty,
        SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE 0 END) as total_buy_value,
        SUM(CASE WHEN side = 'sell' THEN quantity ELSE 0 END) as total_sell_qty
      FROM trades
      WHERE strategy_id = v_strategy.id 
        AND symbol = v_strategy.symbol
        AND status = 'executed'
    )
    SELECT 
      COALESCE(total_buy_qty, 0) - COALESCE(total_sell_qty, 0),
      CASE 
        WHEN COALESCE(total_buy_qty, 0) > 0 THEN 
          COALESCE(total_buy_value, 0) / total_buy_qty 
        ELSE 0 
      END,
      COALESCE(total_buy_qty, 0),
      COALESCE(total_buy_value, 0)
    INTO v_net_quantity, v_weighted_avg_price, v_total_buy_qty, v_total_buy_value
    FROM trade_summary;
    
    -- Wenn Netto-Position > 0, erstelle Position
    IF v_net_quantity > 0.00000001 THEN
      INSERT INTO positions (
        strategy_id, 
        symbol, 
        quantity, 
        entry_price, 
        total_buy_quantity, 
        total_buy_value, 
        status,
        opened_at
      ) VALUES (
        v_strategy.id, 
        v_strategy.symbol, 
        v_net_quantity, 
        v_weighted_avg_price,
        v_total_buy_qty,
        v_total_buy_value,
        'open',
        NOW() -- oder MIN(created_at) aus trades für genaueres Datum
      )
      ON CONFLICT DO NOTHING; -- Verhindert doppelte Einträge
      
      RAISE NOTICE 'Migrated position: % % - Quantity: %, Avg Price: %', 
        v_strategy.name, v_strategy.symbol, v_net_quantity, v_weighted_avg_price;
    ELSE
      RAISE NOTICE 'No open position for: % %', v_strategy.name, v_strategy.symbol;
    END IF;
  END LOOP;
END $$;
```

### 4. Verifizierung

Prüfen Sie die migrierten Positionen:

```sql
-- Zeige alle offenen Positionen
SELECT 
  p.id,
  s.name as strategy_name,
  p.symbol,
  p.quantity,
  p.entry_price,
  p.quantity * p.entry_price as position_value,
  p.status,
  p.opened_at
FROM positions p
JOIN strategies s ON s.id = p.strategy_id
WHERE p.status = 'open'
ORDER BY p.opened_at DESC;
```

### 5. Alte Logik bereinigen (Optional)

Nach erfolgreicher Migration und Test können Sie die alte `loadOpenPositions` Funktion aus dem Server entfernen.

## Troubleshooting

### Problem: Doppelte Positionen

Wenn eine Strategie bereits Positionen in der neuen Tabelle hat:

```sql
-- Prüfe auf Duplikate
SELECT strategy_id, symbol, COUNT(*) 
FROM positions 
WHERE status = 'open' 
GROUP BY strategy_id, symbol 
HAVING COUNT(*) > 1;

-- Lösche Duplikate (behalte die mit der höchsten quantity)
DELETE FROM positions p1
WHERE status = 'open'
AND EXISTS (
  SELECT 1 FROM positions p2
  WHERE p2.strategy_id = p1.strategy_id
  AND p2.symbol = p1.symbol
  AND p2.status = 'open'
  AND p2.quantity > p1.quantity
  AND p2.id != p1.id
);
```

### Problem: Falsche Berechnungen

Vergleiche die Positionen mit den Trades:

```sql
-- Vergleiche berechnete mit tatsächlichen Positionen
WITH calculated_positions AS (
  SELECT 
    strategy_id,
    symbol,
    SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END) as net_qty
  FROM trades
  WHERE status = 'executed'
  GROUP BY strategy_id, symbol
  HAVING SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END) > 0
)
SELECT 
  c.strategy_id,
  c.symbol,
  c.net_qty as calculated_qty,
  p.quantity as position_qty,
  c.net_qty - p.quantity as difference
FROM calculated_positions c
LEFT JOIN positions p ON p.strategy_id = c.strategy_id 
  AND p.symbol = c.symbol 
  AND p.status = 'open'
WHERE ABS(c.net_qty - COALESCE(p.quantity, 0)) > 0.00000001;
```

## Rollback (falls nötig)

Falls Probleme auftreten:

```sql
-- Alle Positionen löschen
TRUNCATE TABLE positions CASCADE;

-- Oder Tabelle komplett entfernen
DROP TABLE IF EXISTS positions CASCADE;
```

Danach den alten Server-Code wiederherstellen.
