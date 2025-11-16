'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface InfoTooltipProps {
  content: string;
  maxWidth?: string;
}

// ============================================================================
// Tooltip Portal Komponente
// ============================================================================
// Diese Komponente rendert den Tooltip-Inhalt über ein Portal direkt im <body>.
// So wird verhindert, dass der Tooltip von übergeordneten Containern
// mit `overflow: hidden` abgeschnitten wird.
// ============================================================================
const TooltipPortal = ({
  content,
  targetRect,
  maxWidth,
  onMouseEnter,
  onMouseLeave,
}: {
  content: string;
  targetRect: DOMRect | null;
  maxWidth: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, opacity: 0 });

  useEffect(() => {
    if (targetRect && tooltipRef.current) {
      const tooltipEl = tooltipRef.current;
      const tooltipHeight = tooltipEl.offsetHeight;
      const tooltipWidth = tooltipEl.offsetWidth;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const spacing = 12;
      const margin = 20;

      let top, left;

      // 1. Bevorzuge 'bottom'
      if (targetRect.bottom + tooltipHeight + spacing < viewportHeight - margin) {
        top = targetRect.bottom + spacing + window.scrollY;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2) + window.scrollX;
      }
      // 2. Fallback: 'top'
      else if (targetRect.top - tooltipHeight - spacing > margin) {
        top = targetRect.top - tooltipHeight - spacing + window.scrollY;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2) + window.scrollX;
      }
      // 3. Fallback: 'right'
      else if (targetRect.right + tooltipWidth + spacing < viewportWidth - margin) {
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2) + window.scrollY;
        left = targetRect.right + spacing + window.scrollX;
      }
      // 4. Letzter Fallback: 'left'
      else {
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2) + window.scrollY;
        left = targetRect.left - tooltipWidth - spacing + window.scrollX;
      }

      // Horizontale Position an Viewport anpassen
      if (left < margin + window.scrollX) {
        left = margin + window.scrollX;
      }
      if (left + tooltipWidth > viewportWidth - margin + window.scrollX) {
        left = viewportWidth - tooltipWidth - margin + window.scrollX;
      }

      setCoords({ top, left, opacity: 1 });
    }
  }, [targetRect, maxWidth]);

  if (!targetRect) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[9999] px-5 py-4 text-sm leading-relaxed text-white bg-gray-900 rounded-lg shadow-2xl transition-opacity duration-200"
      style={{
        ...coords,
        width: maxWidth,
        maxWidth: `calc(100vw - ${2 * 20}px)`, // Verwende 20px direkt
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative z-10 whitespace-pre-line">{content}</div>
    </div>,
    document.body
  );
};


// ============================================================================
// Hauptkomponente: InfoTooltip
// ============================================================================
// Diese Komponente rendert das "i"-Icon und steuert die Sichtbarkeit
// des TooltipPortals. Ein Timeout verhindert das Flackern beim
// Bewegen der Maus vom Icon zum Tooltip.
// ============================================================================
export default function InfoTooltip({ 
  content, 
  maxWidth = '450px' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isClient, setIsClient] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const showTooltip = useCallback(() => {
    if (iconRef.current) {
      clearTimeout(hideTimeoutRef.current);
      setTargetRect(iconRef.current.getBoundingClientRect());
      setIsVisible(true);
    }
  }, []);

  const hideTooltip = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 200); // Kurze Verzögerung, um den Übergang zum Tooltip zu ermöglichen
  }, []);
  
  return (
    <div className="inline-block" ref={iconRef} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {/* Info Icon */}
      <div
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-xs text-gray-400 border border-gray-300 rounded-full cursor-help hover:text-blue-500 hover:border-blue-500 transition-colors"
        tabIndex={0}
        role="tooltip"
        aria-label="Information"
      >
        i
      </div>

      {isClient && isVisible && (
        <TooltipPortal
          content={content}
          targetRect={targetRect}
          maxWidth={maxWidth}
          onMouseEnter={showTooltip} // Hält den Tooltip offen, wenn die Maus darauf ist
          onMouseLeave={hideTooltip}
        />
      )}
    </div>
  );
}

