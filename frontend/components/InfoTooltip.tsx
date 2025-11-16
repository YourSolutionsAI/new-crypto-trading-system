'use client';

import { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  maxWidth?: string;
}

/**
 * InfoTooltip - Zeigt ein "i" Icon mit Hover-Popup
 * Automatische Positionierung verhindert Überlauf über den Bildschirmrand
 */
export default function InfoTooltip({ 
  content, 
  position = 'auto',
  maxWidth = '450px' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(position);
  const iconRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && iconRef.current && position === 'auto') {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Prüfe ob Tooltip rechts über den Rand läuft
      if (iconRect.right + tooltipRect.width > viewportWidth - 10) {
        // Prüfe ob links genug Platz ist
        if (iconRect.left - tooltipRect.width > 10) {
          setTooltipPosition('left');
        } else {
          // Oben oder unten
          if (iconRect.bottom + tooltipRect.height > viewportHeight - 10) {
            setTooltipPosition('top');
          } else {
            setTooltipPosition('bottom');
          }
        }
      } else {
        // Standardmäßig rechts
        setTooltipPosition('right');
      }
    }
  }, [isVisible, position]);

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-50 px-4 py-3 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-xl whitespace-normal";
    
    switch (tooltipPosition) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
      default:
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
    }
  };

  const getArrowClasses = () => {
    const baseArrow = "absolute w-2 h-2 bg-gray-900 transform rotate-45";
    
    switch (tooltipPosition) {
      case 'top':
        return `${baseArrow} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseArrow} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseArrow} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
      default:
        return `${baseArrow} -left-1 top-1/2 -translate-y-1/2`;
    }
  };

  return (
    <div className="inline-block relative" ref={iconRef}>
      {/* Info Icon */}
      <div
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-xs text-gray-400 border border-gray-300 rounded-full cursor-help hover:text-blue-500 hover:border-blue-500 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
        role="tooltip"
        aria-label="Information"
      >
        i
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={getTooltipClasses()}
          style={{ maxWidth }}
        >
          {/* Arrow */}
          <div className={getArrowClasses()} />
          
          {/* Content */}
          <div className="relative z-10">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

