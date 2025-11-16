// Intelligentes Symbol-Dropdown mit Search-Funktion
import React, { useState, useMemo, useRef, useEffect } from 'react';

interface SymbolSearchDropdownProps {
  symbols: Array<{
    symbol: string;
    baseAsset: string;
    status: string;
    minNotional?: number; // Optional: Min USDT für Trading
  }>;
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const SymbolSearchDropdown: React.FC<SymbolSearchDropdownProps> = ({
  symbols,
  value,
  onChange,
  disabled = false,
  placeholder = 'Symbol suchen (z.B. BTC, ETH)...',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtere und sortiere Symbole basierend auf Suchbegriff
  const filteredSymbols = useMemo(() => {
    if (!searchTerm.trim()) {
      // Ohne Suchbegriff: Zeige Top 50 nach Volumen/Popularität (alphabetisch)
      return symbols.slice(0, 50).sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    const search = searchTerm.toUpperCase().trim();
    
    // Filtere nach baseAsset oder vollständigem Symbol
    const filtered = symbols.filter((symbol) => {
      const matchesBaseAsset = symbol.baseAsset.includes(search);
      const matchesFullSymbol = symbol.symbol.includes(search);
      return matchesBaseAsset || matchesFullSymbol;
    });

    // Sortiere: Exakte Treffer zuerst, dann alphabetisch
    return filtered.sort((a, b) => {
      // Exakte Treffer für baseAsset bevorzugen
      const aExact = a.baseAsset === search;
      const bExact = b.baseAsset === search;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Sonst alphabetisch
      return a.symbol.localeCompare(b.symbol);
    });
  }, [symbols, searchTerm]);

  // Begrenze auf 100 Ergebnisse für Performance
  const displayedSymbols = filteredSymbols.slice(0, 100);

  // Schließe Dropdown bei Klick außerhalb
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < displayedSymbols.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayedSymbols[highlightedIndex]) {
          handleSelect(displayedSymbols[highlightedIndex].symbol);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (symbol: string) => {
    onChange(symbol);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value || searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 pr-10"
        />
        
        {/* Dropdown-Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown-Liste */}
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {displayedSymbols.length === 0 ? (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {searchTerm ? 'Keine Symbole gefunden' : 'Keine Symbole verfügbar'}
            </div>
          ) : (
            <>
              {displayedSymbols.map((symbol, index) => (
                <div
                  key={symbol.symbol}
                  onClick={() => handleSelect(symbol.symbol)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                    index === highlightedIndex
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className="font-medium">{symbol.symbol}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {symbol.baseAsset} / USDT
                        </span>
                      </div>
                      {/* Min Notional Info */}
                      {symbol.minNotional !== undefined && symbol.minNotional > 0 && (
                        <div className="mt-0.5">
                          <span className="text-xs text-amber-600 font-medium">
                            Min: {symbol.minNotional.toFixed(2)} USDT
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                        symbol.status === 'TRADING'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {symbol.status}
                    </span>
                  </div>
                </div>
              ))}
              
              {filteredSymbols.length > 100 && (
                <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                  + {filteredSymbols.length - 100} weitere Symbole. Verfeinern Sie Ihre Suche.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hilfetext */}
      {!isOpen && symbols.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {symbols.length.toLocaleString('de-DE')} handelbare Spot-USDT-Paare verfügbar
        </p>
      )}
    </div>
  );
};

