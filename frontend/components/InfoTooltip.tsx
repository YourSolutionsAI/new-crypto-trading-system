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
  maxWidth = '500px' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(position);
  const [adjustedPosition, setAdjustedPosition] = useState({ left: 0, top: 0 });
  const iconRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && iconRef.current && position === 'auto') {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipWidth = 500; // Feste Breite für Berechnung
      const tooltipHeight = tooltipRef.current.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spacing = 12;

      // Bevorzuge top/bottom für mehr Breite
      // Prüfe ob unten genug Platz ist
      if (iconRect.bottom + tooltipHeight + spacing < viewportHeight - 20) {
        setTooltipPosition('bottom');
        
        // Berechne horizontale Position (zentriert, aber innerhalb Viewport)
        let leftPos = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2);
        if (leftPos < 20) leftPos = 20;
        if (leftPos + tooltipWidth > viewportWidth - 20) leftPos = viewportWidth - tooltipWidth - 20;
        
        setAdjustedPosition({ left: leftPos, top: iconRect.bottom + spacing });
      } 
      // Prüfe ob oben genug Platz ist
      else if (iconRect.top - tooltipHeight - spacing > 20) {
        setTooltipPosition('top');
        
        let leftPos = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2);
        if (leftPos < 20) leftPos = 20;
        if (leftPos + tooltipWidth > viewportWidth - 20) leftPos = viewportWidth - tooltipWidth - 20;
        
        setAdjustedPosition({ left: leftPos, top: iconRect.top - tooltipHeight - spacing });
      }
      // Fallback: rechts oder links
      else if (iconRect.right + tooltipWidth + spacing < viewportWidth - 20) {
        setTooltipPosition('right');
      } else if (iconRect.left - tooltipWidth - spacing > 20) {
        setTooltipPosition('left');
      } else {
        // Letzter Fallback: bottom mit angepasster Position
        setTooltipPosition('bottom');
      }
    }
  }, [isVisible, position]);

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-[9999] px-5 py-4 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-2xl";
    
    switch (tooltipPosition) {
      case 'top':
        return `${baseClasses} bottom-full mb-3`;
      case 'bottom':
        return `${baseClasses} top-full mt-3`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-3`;
      case 'right':
      default:
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-3`;
    }
  };
  
  const getTooltipStyle = () => {
    if (tooltipPosition === 'top' || tooltipPosition === 'bottom') {
      // Bei top/bottom: feste Breite für bessere Lesbarkeit
      return { 
        width: maxWidth,
        maxWidth: maxWidth,
        minWidth: '400px'
      };
    } else {
      // Bei left/right: maxWidth, aber mindestens 350px
      return { 
        width: maxWidth,
        maxWidth: maxWidth,
        minWidth: '350px'
      };
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
          style={getTooltipStyle()}
        >
          {/* Arrow */}
          <div className={getArrowClasses()} />
          
          {/* Content */}
          <div className="relative z-10 whitespace-pre-line">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

