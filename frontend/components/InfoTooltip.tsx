'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: string;
  maxWidth?: string;
}

/**
 * InfoTooltip - Zeigt ein "i" Icon mit Hover-Popup
 * Verwendet React Portal um Clipping-Probleme zu verhindern
 */
export default function InfoTooltip({ 
  content, 
  maxWidth = '450px' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [isClient, setIsClient] = useState(false);
  
  const iconRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Sicherstellen, dass wir auf dem Client sind (für SSR/Next.js)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Positionierungslogik
  useEffect(() => {
    if (isVisible && iconRef.current && tooltipRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipEl = tooltipRef.current;
      
      const tooltipHeight = tooltipEl.offsetHeight;
      const tooltipWidth = tooltipEl.offsetWidth;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spacing = 12;
      const margin = 20;

      let top, left;
      let position = '';

      // 1. Bevorzuge bottom
      if (iconRect.bottom + tooltipHeight + spacing < viewportHeight - margin) {
        position = 'bottom';
        top = iconRect.bottom + spacing + window.scrollY;
        left = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2) + window.scrollX;
      }
      // 2. Fallback: top
      else if (iconRect.top - tooltipHeight - spacing > margin) {
        position = 'top';
        top = iconRect.top - tooltipHeight - spacing + window.scrollY;
        left = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2) + window.scrollX;
      }
      // 3. Fallback: right
      else if (iconRect.right + tooltipWidth + spacing < viewportWidth - margin) {
        position = 'right';
        top = iconRect.top + (iconRect.height / 2) - (tooltipHeight / 2) + window.scrollY;
        left = iconRect.right + spacing + window.scrollX;
      }
      // 4. Letzter Fallback: left
      else {
        position = 'left';
        top = iconRect.top + (iconRect.height / 2) - (tooltipHeight / 2) + window.scrollY;
        left = iconRect.left - tooltipWidth - spacing + window.scrollX;
      }

      // Horizontale Position an Viewport anpassen
      if (left < margin + window.scrollX) {
        left = margin + window.scrollX;
      }
      if (left + tooltipWidth > viewportWidth - margin + window.scrollX) {
        left = viewportWidth - tooltipWidth - margin + window.scrollX;
      }
      
      // Vertikale Position an Viewport anpassen
      if (top < margin + window.scrollY) {
        top = margin + window.scrollY;
      }
      
      setCoords({ top, left });
      
      // Arrow-Position anpassen
      if (tooltipEl) {
        tooltipEl.dataset.position = position;
      }
    }
  }, [isVisible]);

  const TooltipComponent = (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] px-5 py-4 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-2xl transition-opacity duration-200"
      style={{
        ...coords,
        width: maxWidth,
        maxWidth: `calc(100vw - ${2 * 20}px)`,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div className="relative z-10 whitespace-pre-line">
        {content}
      </div>
    </div>
  );

  return (
    <div className="inline-block" ref={iconRef}>
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

      {isClient && createPortal(TooltipComponent, document.body)}
    </div>
  );
}

