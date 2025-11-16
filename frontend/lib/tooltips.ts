/**
 * Tooltip-Texte für Binance Exchange Info Felder
 * Detaillierte Erklärungen für alle Trading-Parameter
 */

export const TOOLTIPS = {
  // Assets & Precision
  baseAsset: 
    "Das Base Asset ist die Kryptowährung, die Sie kaufen/verkaufen. " +
    "Bei BTCUSDT ist BTC das Base Asset (die Basis). " +
    "Sie handeln BTC gegen USDT.",
  
  quoteAsset: 
    "Das Quote Asset ist die Währung, mit der Sie bezahlen. " +
    "Bei BTCUSDT ist USDT das Quote Asset. " +
    "Der Preis wird in USDT angegeben (z.B. 45000 USDT pro BTC).",
  
  baseAssetPrecision: 
    "Anzahl der Dezimalstellen für das Base Asset. " +
    "Bei BTC (8 Stellen): 0.00000001 BTC ist die kleinste handelbare Einheit. " +
    "Wichtig für die Anzeige von Mengen.",
  
  quoteAssetPrecision: 
    "Anzahl der Dezimalstellen für das Quote Asset. " +
    "Bei USDT (8 Stellen): 0.00000001 USDT. " +
    "Bestimmt die Präzision des Gesamtwerts.",
  
  quotePrecision: 
    "Anzahl der Dezimalstellen für den Preis. " +
    "Bei 2: Preis = 45000.12 USDT. Bei 8: Preis = 45000.12345678 USDT. " +
    "Definiert die Preis-Genauigkeit beim Trading.",
  
  baseCommissionPrecision: 
    "Dezimalstellen für Gebühren im Base Asset. " +
    "Wenn Sie BTC als Gebühr zahlen, bestimmt dies die Genauigkeit. " +
    "Meist identisch mit baseAssetPrecision.",
  
  quoteCommissionPrecision: 
    "Dezimalstellen für Gebühren im Quote Asset. " +
    "Wenn Sie USDT als Gebühr zahlen, bestimmt dies die Genauigkeit. " +
    "Meist identisch mit quoteAssetPrecision.",

  // Status & Trading
  status: 
    "Handelsstatus des Symbols:\n" +
    "• TRADING: Normal handelbar ✅\n" +
    "• BREAK: Vorübergehend pausiert ⏸️\n" +
    "• HALT: Handel gestoppt 🛑\n" +
    "• PRE_TRADING: Noch nicht aktiv 🕐\n" +
    "• END_OF_DAY: Tagesende erreicht 🌙",
  
  isSpotTradingAllowed: 
    "Gibt an, ob Spot-Trading (direkter Kauf/Verkauf) erlaubt ist. " +
    "✅ true = Sie können dieses Paar direkt handeln. " +
    "❌ false = Spot-Trading nicht verfügbar (z.B. nur Futures).",
  
  isMarginTradingAllowed: 
    "Gibt an, ob Margin-Trading (Hebel-Trading) erlaubt ist. " +
    "✅ true = Sie können mit geliehenem Kapital handeln (höheres Risiko). " +
    "❌ false = Nur mit eigenem Kapital handelbar.",
  
  // Price Filter
  priceFilterMinPrice: 
    "Minimaler erlaubter Preis für eine Order. " +
    "Beispiel: 0.01 USDT bedeutet, Sie können keine Order unter 0.01 USDT platzieren. " +
    "Verhindert unrealistisch niedrige Preise.",
  
  priceFilterMaxPrice: 
    "Maximaler erlaubter Preis für eine Order. " +
    "Beispiel: 100000 USDT bedeutet, keine Order über 100000 USDT. " +
    "Verhindert Eingabefehler (z.B. 1 Million statt 1000).",
  
  priceFilterTickSize: 
    "Kleinste Preisänderung (Preis-Inkrement). " +
    "Bei 0.01: Preise wie 100.00, 100.01, 100.02 sind erlaubt. " +
    "Bei 0.10: Nur 100.0, 100.1, 100.2 möglich. " +
    "Ihr Preis muss ein Vielfaches davon sein.",
  
  // Lot Size Filter
  lotSizeMinQty: 
    "Minimale Menge, die Sie kaufen/verkaufen können. " +
    "Beispiel: 0.001 BTC bedeutet, Sie müssen mindestens 0.001 BTC handeln. " +
    "Orders unter diesem Wert werden abgelehnt.",
  
  lotSizeMaxQty: 
    "Maximale Menge pro Order. " +
    "Beispiel: 9000 BTC bedeutet, Sie können maximal 9000 BTC in einer Order handeln. " +
    "Schützt vor versehentlich zu großen Orders.",
  
  lotSizeStepSize: 
    "Kleinste Mengenänderung (Mengen-Inkrement). " +
    "Bei 0.001: Mengen wie 0.001, 0.002, 0.003 BTC sind erlaubt. " +
    "Bei 0.01: Nur 0.01, 0.02, 0.03 möglich. " +
    "Ihre Menge muss ein Vielfaches davon sein.",
  
  // Notional Filter
  notionalMinNotional: 
    "Minimaler Gesamtwert einer Order (Preis × Menge). " +
    "Beispiel: 10 USDT bedeutet, Ihre Order muss mindestens 10 USDT wert sein. " +
    "Verhindert zu kleine Orders, die wirtschaftlich keinen Sinn machen.",
  
  notionalMaxNotional: 
    "Maximaler Gesamtwert einer Order. " +
    "Beispiel: 1000000 USDT = max. 1 Million USDT pro Order. " +
    "Schützt vor versehentlich zu großen Trades.",
  
  notionalApplyMinToMarket: 
    "Gilt das Minimum auch für Market Orders? " +
    "✅ true = Ja, auch Market Orders müssen den Mindestwert erfüllen. " +
    "❌ false = Market Orders können kleiner sein.",
  
  // Order Types & Features
  orderTypes: 
    "Verfügbare Order-Typen für dieses Symbol:\n" +
    "• LIMIT: Kauf/Verkauf zu festem Preis ⚖️\n" +
    "• MARKET: Sofortige Ausführung zum aktuellen Preis 🚀\n" +
    "• STOP_LOSS: Verkauf bei Preisrückgang 🛡️\n" +
    "• STOP_LOSS_LIMIT: Stop Loss mit Preislimit 🎯\n" +
    "• TAKE_PROFIT: Verkauf bei Gewinn-Ziel 💰\n" +
    "• LIMIT_MAKER: Limit Order ohne Taker-Gebühr 💡",
  
  icebergAllowed: 
    "Iceberg Orders: Nur ein Teil der Order ist sichtbar. " +
    "✅ true = Sie können große Orders aufteilen (z.B. 100 BTC in 10×10 BTC). " +
    "Der Rest bleibt versteckt, um den Markt nicht zu beeinflussen.",
  
  ocoAllowed: 
    "OCO (One-Cancels-Other): Zwei Orders gleichzeitig, wenn eine ausgeführt wird, wird die andere storniert. " +
    "✅ true = Sie können z.B. gleichzeitig Take-Profit und Stop-Loss setzen. " +
    "Praktisch für automatisches Risikomanagement.",
  
  otoAllowed: 
    "OTO (One-Triggers-Other): Wenn Order A ausgeführt wird, wird Order B automatisch platziert. " +
    "✅ true = Nützlich für automatische Folge-Strategien. " +
    "❌ false = Nicht verfügbar für dieses Symbol.",
  
  quoteOrderQtyMarketAllowed: 
    "Kann man Market Orders in Quote-Währung platzieren? " +
    "✅ true = Ja, z.B. 'Kaufe für 100 USDT' statt 'Kaufe 0.002 BTC'. " +
    "Einfacher für Anfänger (Betrag in Dollar statt in BTC).",
  
  allowTrailingStop: 
    "Trailing Stop: Stop-Loss, der sich automatisch nach oben anpasst. " +
    "✅ true = Wenn der Preis steigt, steigt auch Ihr Stop-Loss mit. " +
    "Sichert Gewinne, ohne dass Sie manuell nachziehen müssen.",
  
  cancelReplaceAllowed: 
    "Kann man Orders direkt ändern statt zu löschen und neu zu erstellen? " +
    "✅ true = Schnellere Order-Anpassung möglich. " +
    "❌ false = Order muss gelöscht und neu erstellt werden.",
  
  amendAllowed: 
    "Kann man laufende Orders nachträglich ändern? " +
    "✅ true = Preis/Menge können angepasst werden, ohne Order zu stornieren. " +
    "❌ false = Keine nachträgliche Änderung möglich.",

  // Permissions
  permissions: 
    "Trading-Berechtigungen für dieses Symbol:\n" +
    "• SPOT: Spot-Trading erlaubt 💱\n" +
    "• MARGIN: Margin-Trading erlaubt 📊\n" +
    "• LEVERAGED: Hebel-Trading verfügbar 🎢\n" +
    "Mehrfache Permissions = Symbol in mehreren Märkten handelbar.",
  
  permissionSets: 
    "Gruppierung von Berechtigungen in Sets. " +
    "Definiert, welche Kombinationen von Trading-Modi erlaubt sind. " +
    "Meist leer oder [[\"SPOT\"]].",

  // Self Trade Prevention
  defaultSelfTradePreventionMode: 
    "Verhindert, dass Sie mit sich selbst handeln:\n" +
    "• EXPIRE_TAKER: Taker-Order wird storniert ❌\n" +
    "• EXPIRE_MAKER: Maker-Order wird storniert 🚫\n" +
    "• EXPIRE_BOTH: Beide Orders storniert ⛔\n" +
    "• NONE: Kein Schutz 🔓\n" +
    "Wichtig wenn Sie mehrere Bots/Accounts nutzen.",
  
  allowedSelfTradePreventionModes: 
    "Liste der verfügbaren Self-Trade-Prevention-Modi. " +
    "Sie können bei jeder Order einen dieser Modi wählen. " +
    "Flexibilität für verschiedene Trading-Strategien.",

  // Weitere Filter
  maxNumOrders: 
    "Maximale Anzahl offener Orders für dieses Symbol. " +
    "Beispiel: 200 = Sie können maximal 200 gleichzeitige Orders haben. " +
    "Schützt vor Order-Spam.",
  
  maxNumAlgoOrders: 
    "Maximale Anzahl offener algorithmischer Orders (Stop-Loss, Take-Profit, etc.). " +
    "Beispiel: 5 = Maximal 5 Stop-Orders gleichzeitig. " +
    "Begrenzt komplexe Order-Kombinationen.",
  
  percentPrice: 
    "Prozentuale Preisabweichung vom Durchschnittspreis. " +
    "Beispiel: ±10% bedeutet, Ihr Preis darf maximal 10% vom aktuellen Preis abweichen. " +
    "Verhindert Fehleingaben (z.B. 100 statt 10000).",
  
  marketLotSize: 
    "Spezielle Mengen-Beschränkungen für Market Orders. " +
    "Oft identisch mit LOT_SIZE, aber kann abweichen. " +
    "Relevant für große Instant-Käufe/-Verkäufe.",
  
  maxPosition: 
    "Maximale Position, die Sie in diesem Symbol halten können. " +
    "Beispiel: 100 BTC = Sie können maximal 100 BTC besitzen. " +
    "Risk-Management-Regel von Binance.",

  // Trading Info
  symbol: 
    "Das Trading-Paar (Symbol). " +
    "Format: BASEASSETQUOTEASSET. " +
    "Beispiel: BTCUSDT = Bitcoin (BTC) vs. Tether USD (USDT). " +
    "Das Symbol identifiziert eindeutig das Handelspaar.",
};

