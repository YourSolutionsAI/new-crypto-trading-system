/**
 * Utility-Funktionen für die Formatierung von Zahlen mit Tausendertrennzeichen
 */

/**
 * Formatiert eine Zahl mit Tausendertrennzeichen für die Anzeige
 * @param value - Die zu formatierende Zahl oder String
 * @param decimals - Anzahl der Dezimalstellen (optional)
 * @returns Formatierter String mit Tausendertrennzeichen
 */
export function formatNumber(value: number | string | undefined | null, decimals?: number): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  
  if (isNaN(numValue)) {
    return '';
  }
  
  // Bestimme die Anzahl der Dezimalstellen
  const decimalPlaces = decimals !== undefined 
    ? decimals 
    : (numValue % 1 === 0 ? 0 : (numValue.toString().split('.')[1]?.length || 2));
  
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(numValue);
}

/**
 * Entfernt Formatierung und gibt den numerischen Wert zurück
 * @param formattedValue - Formatierter String mit Tausendertrennzeichen
 * @returns Numerischer Wert oder undefined
 */
export function parseFormattedNumber(formattedValue: string): number | undefined {
  if (!formattedValue || formattedValue.trim() === '') {
    return undefined;
  }
  
  // Entferne Leerzeichen
  let cleaned = formattedValue.trim();
  
  // Prüfe auf negatives Vorzeichen
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  // Entferne alle Tausendertrennzeichen (Punkte)
  cleaned = cleaned.replace(/\./g, '');
  
  // Ersetze Komma durch Punkt für parseFloat (Dezimaltrennzeichen)
  cleaned = cleaned.replace(',', '.');
  
  // Füge negatives Vorzeichen wieder hinzu
  if (isNegative) {
    cleaned = '-' + cleaned;
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Formatiert eine Zahl beim Eingeben (für Input-Felder)
 * @param value - Der eingegebene Wert
 * @param decimals - Anzahl der Dezimalstellen (optional)
 * @returns Formatierter String für die Anzeige im Input-Feld
 */
export function formatNumberInput(value: string, decimals?: number): string {
  if (!value || value.trim() === '') {
    return '';
  }
  
  // Entferne alle Zeichen außer Ziffern, Komma und Punkt
  const cleaned = value.replace(/[^\d.,-]/g, '');
  
  if (cleaned === '' || cleaned === '-') {
    return cleaned;
  }
  
  // Ersetze Komma durch Punkt für die Verarbeitung
  const normalized = cleaned.replace(',', '.');
  
  // Prüfe ob es eine gültige Zahl ist
  const numValue = parseFloat(normalized);
  if (isNaN(numValue)) {
    return cleaned;
  }
  
  // Formatiere die Zahl
  return formatNumber(numValue, decimals);
}

